import { Dialog, Meta, DialogMember } from '../models/index.js';
import * as metaUtils from '../utils/metaUtils.js';
import * as eventUtils from '../utils/eventUtils.js';
import { parseFilters, extractMetaFilters, processMemberFilters, parseMemberSort } from '../utils/queryParser.js';
import { sanitizeResponse } from '../utils/responseUtils.js';

export const dialogController = {
  // Get all dialogs for current tenant
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      let dialogIds = null;
      let regularFilters = {};

      // Фильтрация по метаданным и участникам
      if (req.query.filter) {
        try {
          // Парсим фильтры (поддержка как JSON, так и (field,operator,value) формата)
          const parsedFilters = parseFilters(req.query.filter);
          
          // Извлекаем meta фильтры и member фильтры
          const { metaFilters, regularFilters: extractedRegularFilters, memberFilters } = extractMetaFilters(parsedFilters);
          regularFilters = extractedRegularFilters;
          
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
                // Проверяем, является ли condition объектом с MongoDB операторами (например, { $in: [...] })
                if (typeof condition === 'object' && condition !== null && !Array.isArray(condition)) {
                  // Если это объект с операторами MongoDB (например, { $in: [...] })
                  const metaRecords = await Meta.find({
                    ...metaQuery,
                    key: key,
                    value: condition
                  }).select('entityId').lean();
                  
                  foundDialogIds = metaRecords.map(m => m.entityId.toString());
                } else {
                  // Простое равенство (eq)
                const metaRecords = await Meta.find({
                  ...metaQuery,
                  key: key,
                  value: condition
                }).select('entityId').lean();
                
                foundDialogIds = metaRecords.map(m => m.entityId.toString());
                }
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
              // memberDialogIds уже содержит строки dialogId (dlg_*)
              if (dialogIds === null) {
                dialogIds = memberDialogIds;
              } else {
                // Пересечение с уже найденными dialogIds (обе стороны строки dialogId)
                dialogIds = dialogIds.filter(id => memberDialogIds.includes(id));
              }
            }
          }
          
        } catch (error) {
          return res.status(400).json({
            error: 'Bad Request',
            message: `Invalid filter format. ${error.message}. Examples: {"meta":{"key":"value"}} or (meta.key,eq,value) or (meta.key,ne,value)&(meta.key2,in,[val1,val2])`
          });
        }
      }

      const query = { tenantId: req.tenantId };
      
      // Применяем обычные фильтры (например, dialogId) к query
      // Но если есть dialogId в regularFilters, обрабатываем его отдельно
      const { dialogId: regularDialogId, ...otherRegularFilters } = regularFilters;
      Object.assign(query, otherRegularFilters);
      
      // Если есть фильтрация по meta или member, ограничиваем выборку
      if (dialogIds !== null) {
        if (dialogIds.length === 0) {
          // Нет диалогов с такими meta/member
          return res.json({
            data: sanitizeResponse([]),
            pagination: {
              page,
              limit,
              total: 0,
              pages: 0
            }
          });
        }
        
        // Если также есть regularFilters.dialogId, делаем пересечение
        if (regularDialogId !== undefined) {
          // Преобразуем regularDialogId в массив для сравнения
          const regularDialogIdArray = Array.isArray(regularDialogId) ? regularDialogId : [regularDialogId];
          // Пересечение: оставляем только те dialogIds, которые есть и в dialogIds, и в regularDialogId
          dialogIds = dialogIds.filter(id => regularDialogIdArray.includes(id));
          
          if (dialogIds.length === 0) {
            // Нет диалогов, удовлетворяющих обоим условиям
            return res.json({
              data: sanitizeResponse([]),
              pagination: {
                page,
                limit,
                total: 0,
                pages: 0
              }
            });
          }
        }
        
        // Все dialogIds теперь строки dialogId (meta и member фильтры преобразованы)
        query.dialogId = { $in: dialogIds };
      } else if (regularDialogId !== undefined) {
        // Если нет dialogIds из meta/member фильтров, но есть regularDialogId
        query.dialogId = regularDialogId;
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
          // Все dialogIds теперь строки dialogId
          baseQuery.dialogId = { $in: dialogIds };
        }
        
        // Получаем диалоги с участниками
        const dialogsWithMembers = await Dialog.find(baseQuery)
          .populate('tenantId', 'name domain')
          .populate('createdBy', 'username email')
          .lean();
        
        // Получаем участников для каждого диалога
        const dialogIdsForMembers = dialogsWithMembers.map(d => d.dialogId);
        const members = await DialogMember.find({ 
          dialogId: { $in: dialogIdsForMembers },
          userId: userId,
          tenantId: req.tenantId
        }).lean();
        
        // Создаем мапу участников по dialogId
        const membersMap = {};
        members.forEach(member => {
          membersMap[member.dialogId] = member;
        });
        
        // Фильтруем диалоги - оставляем только те, где userId является участником
        // и добавляем поле для сортировки
        const dialogsWithValidMembers = dialogsWithMembers
          .filter(dialog => {
            const member = membersMap[dialog.dialogId];
          if (member) {
            dialog.members = [member];
            dialog.sortField = member[field] || 0;
              return true;
          }
            return false;
        });
        
        // Сортируем по sortField
        dialogsWithValidMembers.sort((a, b) => {
          const aVal = a.sortField || 0;
          const bVal = b.sortField || 0;
          return direction === -1 ? bVal - aVal : aVal - bVal;
        });
        
        // Применяем пагинацию
        dialogs = dialogsWithValidMembers.slice(skip, skip + limit);
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

      // Добавляем метаданные для каждого диалога
      const dialogIdSet = new Set(
        dialogs
          .map((dialog) => {
            if (dialog?.dialogId) {
              return dialog.dialogId.toString();
            }
            if (dialog?.toObject) {
              const obj = dialog.toObject();
              return obj.dialogId ? obj.dialogId.toString() : null;
            }
            return null;
          })
          .filter((id) => typeof id === 'string' && id.length > 0)
      );

      let memberCounts = {};

      if (dialogIdSet.size > 0) {
        const dialogIdArray = Array.from(dialogIdSet);

        const counts = await DialogMember.aggregate([
          {
            $match: {
              tenantId: req.tenantId,
              dialogId: { $in: dialogIdArray }
            }
          },
          {
            $group: {
              _id: '$dialogId',
              count: { $sum: 1 }
            }
          }
        ]);

        counts.forEach(({ _id, count }) => {
          memberCounts[_id] = count;
        });
      }

      const dialogsWithMeta = await Promise.all(
        dialogs.map(async (dialog) => {
          // Получаем метаданные диалога
          const meta = await metaUtils.getEntityMeta(
            req.tenantId,
            'dialog',
            dialog.dialogId
          );

          // Для агрегации dialog уже является объектом, для обычного запроса - Mongoose документ
          const dialogObj = dialog.toObject ? dialog.toObject() : dialog;
          const { members, ...dialogWithoutMembers } = dialogObj;
          
          // Вычисляем общую статистику по диалогу
          // const totalUnreadCount = members.reduce((total, member) => total + (member.unreadCount || 0), 0);
          // const activeMembersCount = members.filter(member => member.isActive).length;
          // const totalMembersCount = members.length;
          
          // Находим самого активного участника (с наибольшим количеством непрочитанных)
          // const mostActiveMember = members.reduce((most, member) => {
          //   return (member.unreadCount || 0) > (most.unreadCount || 0) ? member : most;
          // }, members[0] || {});
          
          const dialogIdForCount = typeof dialogObj.dialogId === 'string'
            ? dialogObj.dialogId
            : dialogObj.dialogId?.toString?.();

          const memberCount = dialogIdForCount ? memberCounts[dialogIdForCount] || 0 : 0;

          return sanitizeResponse({
            ...dialogWithoutMembers,
            meta,
            memberCount
            // dialogStats: {
            //   totalUnreadCount,
            //   activeMembersCount,
            //   totalMembersCount,
            //   mostActiveMember: mostActiveMember ? {
            //     userId: mostActiveMember.userId,
            //     unreadCount: mostActiveMember.unreadCount
            //   } : null
            // }
          });
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
        dialogId: req.params.id,
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
        dialog.dialogId
      );

      const memberCount = await DialogMember.countDocuments({
        tenantId: req.tenantId,
        dialogId: dialog.dialogId
      });

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
        data: sanitizeResponse({
          ...dialogObj,
          meta,
          memberCount
          // dialogStats: {
          //   totalUnreadCount,
          //   activeMembersCount,
          //   totalMembersCount,
          //   mostActiveMember: mostActiveMember ? {
          //     userId: mostActiveMember.userId,
          //     unreadCount: mostActiveMember.unreadCount
          //   } : null
          // }
        })
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
      const { name, createdBy, meta: metaPayload } = req.body;

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

      // Add meta data if provided
      if (metaPayload && typeof metaPayload === 'object') {
        for (const [key, value] of Object.entries(metaPayload)) {
          const metaOptions = {
            createdBy,
            scope: typeof value === 'object' && value !== null ? value.scope : undefined
          };

          if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'value')) {
            // If value is an object with dataType/value/scope properties
            await metaUtils.setEntityMeta(
              req.tenantId,
              'dialog',
              dialog.dialogId,
              key,
              value.value,
              value.dataType || 'string',
              metaOptions
            );
          } else {
            // If value is a simple value
            await metaUtils.setEntityMeta(
              req.tenantId,
              'dialog',
              dialog.dialogId,
              key,
              value,
              typeof value === 'number' ? 'number' :
              typeof value === 'boolean' ? 'boolean' :
              Array.isArray(value) ? 'array' : 'string',
              metaOptions
            );
          }
        }
      }

      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        name,
        createdBy,
        createdAt: dialog.createdAt,
        updatedAt: dialog.updatedAt
      });

      const actorSection = eventUtils.buildActorSection({
        actorId: createdBy,
        actorType: 'user'
      });

      const eventContext = eventUtils.buildEventContext({
        eventType: 'dialog.create',
        dialogId: dialog.dialogId,
        entityId: dialog.dialogId,
        includedSections: ['dialog', 'actor'],
        updatedFields: ['dialog']
      });

      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'dialog.create',
        entityType: 'dialog',
        entityId: dialog.dialogId,
        actorId: createdBy,
        actorType: 'user',
        data: eventUtils.composeEventData({
          context: eventContext,
          dialog: dialogSection,
          actor: actorSection
        })
      });

      // Получаем метаданные диалога (если есть)
      const meta = await metaUtils.getEntityMeta(
        req.tenantId,
        'dialog',
        dialog.dialogId
      );

      const dialogObj = dialog.toObject();

      res.status(201).json({
        data: sanitizeResponse({
          ...dialogObj,
          meta
        }),
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

      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        name: dialog.name,
        createdBy: dialog.createdBy,
        createdAt: dialog.createdAt,
        updatedAt: dialog.updatedAt
      });

      const actorSection = eventUtils.buildActorSection({
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api'
      });

      const eventContext = eventUtils.buildEventContext({
        eventType: 'dialog.delete',
        dialogId: dialog.dialogId,
        entityId: dialog.dialogId,
        includedSections: ['dialog', 'actor'],
        updatedFields: ['dialog']
      });

      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'dialog.delete',
        entityType: 'dialog',
        entityId: dialog.dialogId,
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api',
        data: eventUtils.composeEventData({
          context: eventContext,
          dialog: dialogSection,
          actor: actorSection
        })
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
  }
};
