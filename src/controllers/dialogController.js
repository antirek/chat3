import { Dialog, Meta, DialogMember } from '../models/index.js';
import * as metaUtils from '../utils/metaUtils.js';
import { parseFilters, extractMetaFilters } from '../utils/queryParser.js';

export const dialogController = {
  // Get all dialogs for current tenant
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      let dialogIds = null;

      // Фильтрация по метаданным
      if (req.query.filter) {
        try {
          // Парсим фильтры (поддержка как JSON, так и (field,operator,value) формата)
          const parsedFilters = parseFilters(req.query.filter);
          
          // Извлекаем meta фильтры
          const { metaFilters, regularFilters } = extractMetaFilters(parsedFilters);
          
          // Обрабатываем meta фильтры
          if (Object.keys(metaFilters).length > 0) {
            const metaQuery = {
              tenantId: req.tenantId,
              entityType: 'dialog'
            };

            // Проходим по всем meta фильтрам
            for (const [key, condition] of Object.entries(metaFilters)) {
              let foundDialogIds;
              
              // Обработка негативных операторов ($ne, $nin) требует специальной логики
              const isNegativeOperator = typeof condition === 'object' && (condition.$ne !== undefined || condition.$nin !== undefined);
              
              if (isNegativeOperator) {
                // Для негативных операторов:
                // 1. Получаем все dialogId с этим ключом
                const allWithKey = await Meta.find({
                  ...metaQuery,
                  key: key
                }).select('entityId value').lean();
                
                // 2. Фильтруем по условию
                if (condition.$ne !== undefined) {
                  // $ne: не равно конкретному значению
                  foundDialogIds = allWithKey
                    .filter(m => m.value !== condition.$ne)
                    .map(m => m.entityId.toString());
                } else if (condition.$nin !== undefined) {
                  // $nin: не в массиве значений
                  foundDialogIds = allWithKey
                    .filter(m => !condition.$nin.includes(m.value))
                    .map(m => m.entityId.toString());
                }
              } else {
                // Для позитивных операторов (eq, in, gt, etc.) используем обычный запрос
                const metaRecords = await Meta.find({
                  ...metaQuery,
                  key: key,
                  value: condition
                }).select('entityId').lean();
                
                foundDialogIds = metaRecords.map(m => m.entityId.toString());
              }
              
              // Объединяем с предыдущими результатами (AND логика)
              if (dialogIds === null) {
                dialogIds = foundDialogIds;
              } else {
                // Пересечение (AND логика между фильтрами)
                dialogIds = dialogIds.filter(id => foundDialogIds.includes(id));
              }
            }
          }
          
          // Применяем обычные фильтры к query
          Object.assign(req.query, regularFilters);
          
        } catch (error) {
          return res.status(400).json({
            error: 'Bad Request',
            message: `Invalid filter format. ${error.message}. Examples: {"meta":{"key":"value"}} or (meta.key,eq,value) or (meta.key,ne,value)&(meta.key2,in,[val1,val2])`
          });
        }
      }

      const query = { tenantId: req.tenantId };
      
      // Если есть фильтрация по meta, ограничиваем выборку
      if (dialogIds !== null) {
        if (dialogIds.length === 0) {
          // Нет диалогов с такими meta
          return res.json({
            data: [],
            pagination: {
              page,
              limit,
              total: 0,
              pages: 0
            }
          });
        }
        query._id = { $in: dialogIds };
      }

      const dialogs = await Dialog.find(query)
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .populate('tenantId', 'name domain')
        .populate('createdBy', 'username email');

      // Добавляем метаданные для каждого диалога
      const dialogsWithMeta = await Promise.all(
        dialogs.map(async (dialog) => {
          // Получаем метаданные диалога
          const meta = await metaUtils.getEntityMeta(
            req.tenantId,
            'dialog',
            dialog._id
          );
          
          const dialogObj = dialog.toObject();
          
          return {
            ...dialogObj,
            meta
          };
        })
      );

      const total = await Dialog.countDocuments(query);

      res.json({
        data: dialogsWithMeta,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get dialog by ID
  async getById(req, res) {
    try {
      const dialog = await Dialog.findOne({
        _id: req.params.id,
        tenantId: req.tenantId
      })
        .select('-__v')
        .populate('tenantId', 'name domain')
        .populate('createdBy', 'username email');

      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      // Получаем метаданные диалога
      const meta = await metaUtils.getEntityMeta(
        req.tenantId,
        'dialog',
        dialog._id
      );

      // Получаем участников диалога
      const members = await DialogMember.find({
        dialogId: dialog._id,
        tenantId: req.tenantId
      })
        .select('userId role joinedAt lastSeenAt lastMessageAt isActive')
        .sort({ joinedAt: 1 });

      const dialogObj = dialog.toObject();

      res.json({
        data: {
          ...dialogObj,
          meta,
          members
        }
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid dialog ID'
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Create new dialog
  async create(req, res) {
    try {
      const { name, createdBy } = req.body;

      // Basic validation
      if (!name || !createdBy) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required fields: name, createdBy'
        });
      }

      const dialog = await Dialog.create({
        tenantId: req.tenantId,
        name,
        createdBy
      });

      // Получаем метаданные диалога (если есть)
      const meta = await metaUtils.getEntityMeta(
        req.tenantId,
        'dialog',
        dialog._id
      );

      const dialogObj = dialog.toObject();

      res.status(201).json({
        data: {
          ...dialogObj,
          meta
        },
        message: 'Dialog created successfully'
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          details: error.errors
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Delete dialog
  async delete(req, res) {
    try {
      const dialog = await Dialog.findOneAndDelete({
        _id: req.params.id,
        tenantId: req.tenantId
      });

      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      // Удаляем все метаданные диалога
      await Meta.deleteMany({ entityType: 'dialog', entityId: req.params.id });

      res.json({
        message: 'Dialog deleted successfully'
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid dialog ID'
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Set meta for dialog
  async setMeta(req, res) {
    try {
      const { dialogId, key } = req.params;
      const { value, dataType } = req.body;

      // Проверяем существование диалога
      const dialog = await Dialog.findOne({
        _id: dialogId,
        tenantId: req.tenantId
      });

      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      // Валидация dataType
      const validDataTypes = ['string', 'number', 'boolean', 'object', 'array'];
      if (!validDataTypes.includes(dataType)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid dataType. Must be one of: ${validDataTypes.join(', ')}`
        });
      }

      // Устанавливаем метаданные
      const meta = await metaUtils.setEntityMeta(
        req.tenantId,
        'dialog',
        dialogId,
        key,
        value,
        dataType
      );

      res.json({
        data: meta,
        message: 'Dialog meta set successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get meta for dialog
  async getMeta(req, res) {
    try {
      const { dialogId } = req.params;

      // Проверяем существование диалога
      const dialog = await Dialog.findOne({
        _id: dialogId,
        tenantId: req.tenantId
      });

      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      // Получаем все метаданные
      const meta = await metaUtils.getEntityMeta(
        req.tenantId,
        'dialog',
        dialogId
      );

      res.json({
        data: meta
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get specific meta key for dialog
  async getMetaKey(req, res) {
    try {
      const { dialogId, key } = req.params;

      const value = await metaUtils.getEntityMetaValue(
        req.tenantId,
        'dialog',
        dialogId,
        key
      );

      if (value === null) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Meta key '${key}' not found for this dialog`
        });
      }

      res.json({
        data: {
          key,
          value
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Delete meta key for dialog
  async deleteMeta(req, res) {
    try {
      const { dialogId, key } = req.params;

      const deleted = await metaUtils.deleteEntityMeta(
        req.tenantId,
        'dialog',
        dialogId,
        key
      );

      if (!deleted) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Meta key '${key}' not found`
        });
      }

      res.json({
        message: 'Dialog meta deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

