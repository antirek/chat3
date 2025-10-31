import { Dialog, Meta, DialogMember } from '../models/index.js';
import * as metaUtils from '../utils/metaUtils.js';
import * as eventUtils from '../utils/eventUtils.js';
import { parseFilters, extractMetaFilters, processMemberFilters, parseMemberSort } from '../utils/queryParser.js';

export const dialogController = {
  // Get all dialogs for current tenant
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      let dialogIds = null;

      // Фильтрация по метаданным и участникам
      if (req.query.filter) {
        try {
          // Парсим фильтры (поддержка как JSON, так и (field,operator,value) формата)
          const parsedFilters = parseFilters(req.query.filter);
          
          // Извлекаем meta фильтры и member фильтры
          const { metaFilters, regularFilters, memberFilters } = extractMetaFilters(parsedFilters);
          
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

          // Обрабатываем member фильтры
          if (Object.keys(memberFilters).length > 0) {
            const memberDialogIds = await processMemberFilters(memberFilters, req.tenantId);
            
            if (memberDialogIds === null) {
              // Нет member фильтров, пропускаем
            } else if (memberDialogIds.length === 0) {
              // Нет диалогов с такими участниками
              dialogIds = [];
            } else {
              if (dialogIds === null) {
                dialogIds = memberDialogIds;
              } else {
                // Пересечение с уже найденными dialogIds
                dialogIds = dialogIds.filter(id => memberDialogIds.some(memberId => memberId.toString() === id.toString()));
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

      // Проверяем, нужна ли сортировка по полям DialogMember
      const sortField = req.query.sort;
      const memberSortInfo = parseMemberSort(sortField);
      const isDialogMemberSort = sortField && ['lastSeenAt', 'lastMessageAt', 'unreadCount'].includes(sortField);
      const isMemberSpecificSort = memberSortInfo !== null;
      const isUpdatedAtSort = sortField && sortField.includes('updatedAt');
      
      let dialogs;
      
      if (isUpdatedAtSort) {
        // Простая сортировка по updatedAt диалога
        const sortDirection = sortField.includes('desc') ? -1 : 1;
        
        dialogs = await Dialog.find(query)
          .skip(skip)
          .limit(limit)
          .sort({ updatedAt: sortDirection })
          .select('-__v')
          .populate('tenantId', 'name domain')
          .populate('createdBy', 'username email');
      } else if (isMemberSpecificSort) {
        // Используем агрегацию для сортировки по полям конкретного участника
        const { userId, field, direction } = memberSortInfo;
        
        // Упрощенный подход: сначала получаем диалоги, затем сортируем
        let baseQuery = { tenantId: req.tenantId };
        
        // Если есть ограничения по dialogIds, добавляем их
        if (dialogIds !== null && dialogIds.length > 0) {
          baseQuery._id = { $in: dialogIds };
        }
        
        // Получаем диалоги с участниками
        const dialogsWithMembers = await Dialog.find(baseQuery)
          .populate('tenantId', 'name domain')
          .populate('createdBy', 'username email')
          .lean();
        
        // Получаем участников для каждого диалога
        const dialogIdsForMembers = dialogsWithMembers.map(d => d._id);
        const members = await DialogMember.find({ 
          dialogId: { $in: dialogIdsForMembers },
          userId: userId 
        }).lean();
        
        // Создаем мапу участников по dialogId
        const membersMap = {};
        members.forEach(member => {
          membersMap[member.dialogId.toString()] = member;
        });
        
        // Добавляем участников к диалогам и сортируем
        dialogsWithMembers.forEach(dialog => {
          const member = membersMap[dialog._id.toString()];
          if (member) {
            dialog.members = [member];
            dialog.sortField = member[field] || 0;
          } else {
            dialog.members = [];
            dialog.sortField = 0;
          }
        });
        
        // Сортируем по sortField
        dialogsWithMembers.sort((a, b) => {
          const aVal = a.sortField || 0;
          const bVal = b.sortField || 0;
          return direction === -1 ? bVal - aVal : aVal - bVal;
        });
        
        // Применяем пагинацию
        dialogs = dialogsWithMembers.slice(skip, skip + limit);
      } else if (isDialogMemberSort) {
        // Используем агрегацию для сортировки по полям DialogMember (старый способ)
        const sortDirection = req.query.sortDirection === 'asc' ? 1 : -1;
        
        const pipeline = [
          { $match: query },
          {
            $lookup: {
              from: 'dialogmembers',
              localField: '_id',
              foreignField: 'dialogId',
              as: 'members'
            }
          },
          { $unwind: '$members' },
          {
            $addFields: {
              sortField: `$members.${sortField}`
            }
          },
          { $sort: { sortField: sortDirection } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'tenants',
              localField: 'tenantId',
              foreignField: '_id',
              as: 'tenantId'
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'createdBy',
              foreignField: '_id',
              as: 'createdBy'
            }
          },
          {
            $project: {
              __v: 0,
              'members._id': 0,
              'members.tenantId': 0,
              'members.dialogId': 0,
              'members.createdAt': 0,
              'members.updatedAt': 0,
              sortField: 0
            }
          }
        ];
        
        dialogs = await Dialog.aggregate(pipeline);
      } else {
        // Обычный запрос
        dialogs = await Dialog.find(query)
          .skip(skip)
          .limit(limit)
          .select('-__v')
          .populate('tenantId', 'name domain')
          .populate('createdBy', 'username email');
      }

      // Добавляем метаданные и участников для каждого диалога
      const dialogsWithMetaAndMembers = await Promise.all(
        dialogs.map(async (dialog) => {
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
            .select('userId role joinedAt lastSeenAt lastMessageAt isActive unreadCount')
            .sort({ joinedAt: 1 });
          
          // Для агрегации dialog уже является объектом, для обычного запроса - Mongoose документ
          const dialogObj = dialog.toObject ? dialog.toObject() : dialog;
          
          // Вычисляем общую статистику по диалогу
          // const totalUnreadCount = members.reduce((total, member) => total + (member.unreadCount || 0), 0);
          // const activeMembersCount = members.filter(member => member.isActive).length;
          // const totalMembersCount = members.length;
          
          // Находим самого активного участника (с наибольшим количеством непрочитанных)
          // const mostActiveMember = members.reduce((most, member) => {
          //   return (member.unreadCount || 0) > (most.unreadCount || 0) ? member : most;
          // }, members[0] || {});
          
          return {
            ...dialogObj,
            meta,
            members
            // dialogStats: {
            //   totalUnreadCount,
            //   activeMembersCount,
            //   totalMembersCount,
            //   mostActiveMember: mostActiveMember ? {
            //     userId: mostActiveMember.userId,
            //     unreadCount: mostActiveMember.unreadCount
            //   } : null
            // }
          };
        })
      );

      const total = await Dialog.countDocuments(query);

      res.json({
        data: dialogsWithMetaAndMembers,
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
        .select('userId role joinedAt lastSeenAt lastMessageAt isActive unreadCount')
        .sort({ joinedAt: 1 });

      // Вычисляем общую статистику по диалогу
      // const totalUnreadCount = members.reduce((total, member) => total + (member.unreadCount || 0), 0);
      // const activeMembersCount = members.filter(member => member.isActive).length;
      // const totalMembersCount = members.length;
      
      // Находим самого активного участника (с наибольшим количеством непрочитанных)
      // const mostActiveMember = members.reduce((most, member) => {
      //   return (member.unreadCount || 0) > (most.unreadCount || 0) ? member : most;
      // }, members[0] || {});

      const dialogObj = dialog.toObject();

      res.json({
        data: {
          ...dialogObj,
          meta,
          members
          // dialogStats: {
          //   totalUnreadCount,
          //   activeMembersCount,
          //   totalMembersCount,
          //   mostActiveMember: mostActiveMember ? {
          //     userId: mostActiveMember.userId,
          //     unreadCount: mostActiveMember.unreadCount
          //   } : null
          // }
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

      // Создаем событие dialog.create
      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'dialog.create',
        entityType: 'dialog',
        entityId: dialog._id,
        actorId: createdBy,
        actorType: 'user',
        data: {
          dialogName: name
        },
        metadata: eventUtils.extractMetadataFromRequest(req)
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

      // Создаем событие dialog.delete
      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'dialog.delete',
        entityType: 'dialog',
        entityId: dialog._id,
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api',
        data: {
          dialogName: dialog.name,
          deletedDialog: {
            name: dialog.name,
            createdBy: dialog.createdBy,
            createdAt: dialog.createdAt
          }
        },
        metadata: eventUtils.extractMetadataFromRequest(req)
      });

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

