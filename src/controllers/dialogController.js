import { Dialog, DialogParticipant, User, Meta } from '../models/index.js';
import * as participantUtils from '../utils/dialogParticipants.js';
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

      // Добавляем участников и мета из DialogParticipant и Meta
      const dialogsWithParticipants = await Promise.all(
        dialogs.map(async (dialog) => {
          const participants = await participantUtils.getParticipants(
            req.tenantId,
            dialog._id
          );
          
          // Получаем метаданные диалога
          const meta = await metaUtils.getEntityMeta(
            req.tenantId,
            'dialog',
            dialog._id
          );
          
          const dialogObj = dialog.toObject();
          delete dialogObj.participants; // Убираем старое поле
          
          return {
            ...dialogObj,
            participants,
            participantCount: participants.length,
            meta
          };
        })
      );

      const total = await Dialog.countDocuments(query);

      res.json({
        data: dialogsWithParticipants,
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

      // Получаем участников из DialogParticipant
      const participants = await participantUtils.getParticipants(
        req.tenantId,
        dialog._id
      );

      // Получаем детали пользователей
      const participantDetails = await Promise.all(
        participants.map(async (p) => {
          const user = await User.findById(p.userId).select('username email firstName lastName avatar');
          return {
            ...p,
            user
          };
        })
      );

      // Получаем метаданные диалога
      const meta = await metaUtils.getEntityMeta(
        req.tenantId,
        'dialog',
        dialog._id
      );

      const dialogObj = dialog.toObject();
      delete dialogObj.participants; // Убираем старое поле

      res.json({
        data: {
          ...dialogObj,
          participants: participantDetails,
          participantCount: participants.length,
          meta
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
      const dialogData = {
        ...req.body,
        tenantId: req.tenantId,
        createdBy: req.body.createdBy
      };

      const dialog = await Dialog.create(dialogData);

      // Добавляем участников через Meta
      if (req.body.participants && Array.isArray(req.body.participants)) {
        for (const participant of req.body.participants) {
          await participantUtils.addParticipant(
            req.tenantId,
            dialog._id,
            participant.userId || participant,
            participant.role || 'member'
          );
        }
      }

      // Получаем созданных участников
      const participants = await participantUtils.getParticipants(
        req.tenantId,
        dialog._id
      );

      // Получаем метаданные диалога (если есть)
      const meta = await metaUtils.getEntityMeta(
        req.tenantId,
        'dialog',
        dialog._id
      );

      const dialogObj = dialog.toObject();
      delete dialogObj.participants; // Убираем старое поле

      res.status(201).json({
        data: {
          ...dialogObj,
          participants,
          participantCount: participants.length,
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

  // Add participant to dialog
  async addParticipant(req, res) {
    try {
      const { dialogId } = req.params;
      const { userId, role } = req.body;

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

      // Проверяем, не является ли уже участником
      const isAlreadyParticipant = await participantUtils.isParticipant(
        req.tenantId,
        dialogId,
        userId
      );

      if (isAlreadyParticipant) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'User is already a participant'
        });
      }

      // Добавляем участника
      await participantUtils.addParticipant(
        req.tenantId,
        dialogId,
        userId,
        role || 'member'
      );

      res.status(201).json({
        message: 'Participant added successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Remove participant from dialog
  async removeParticipant(req, res) {
    try {
      const { dialogId, userId } = req.params;

      const removed = await participantUtils.removeParticipant(
        req.tenantId,
        dialogId,
        userId
      );

      if (!removed) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Participant not found'
        });
      }

      res.json({
        message: 'Participant removed successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get dialog participants
  async getParticipants(req, res) {
    try {
      const { dialogId } = req.params;

      const participants = await participantUtils.getParticipants(
        req.tenantId,
        dialogId
      );

      // Получаем детали пользователей
      const participantDetails = await Promise.all(
        participants.map(async (p) => {
          const user = await User.findById(p.userId).select('username email firstName lastName avatar');
          return {
            ...p,
            user
          };
        })
      );

      res.json({
        data: participantDetails
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Update participant role
  async updateParticipantRole(req, res) {
    try {
      const { dialogId, userId } = req.params;
      const { role } = req.body;

      if (!['owner', 'admin', 'member'].includes(role)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid role. Must be: owner, admin, or member'
        });
      }

      const updated = await participantUtils.updateParticipantRole(
        req.tenantId,
        dialogId,
        userId,
        role
      );

      if (!updated) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Participant not found'
        });
      }

      res.json({
        message: 'Participant role updated successfully'
      });
    } catch (error) {
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
      const { value, dataType, description, isPublic } = req.body;

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
        dataType,
        {
          description,
          isPublic
        }
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

