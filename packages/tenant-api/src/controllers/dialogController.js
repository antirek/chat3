// eslint-disable-next-line no-unused-vars
import { Dialog, Meta, DialogMember,
  UserDialogStats, UserDialogActivity, DialogStats } from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import { parseFilters, extractMetaFilters, processMemberFilters, parseMemberSort } from '../utils/queryParser.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';

import * as userUtils from '../utils/userUtils.js';
import * as dialogMemberUtils from '../utils/dialogMemberUtils.js';
import {
  updateUserStatsDialogCount,
  finalizeCounterUpdateContext,
  updateDialogStats,
  recalculateDialogStats
} from '@chat3/utils/counterUtils.js';

export const dialogController = {
  // Get all dialogs for current tenant
  async getAll(req, res) {
    const routePath = '/';
    const log = (...args) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      log(`Получены параметры: page=${page}, limit=${limit}, filter=${req.query.filter || 'нет'}`);

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
          log(`Ошибка парсинга фильтров: ${error.message}`);
          return res.status(400).json({
            error: 'Bad Request',
            message: `Invalid filter format. ${error.message}. Examples: (meta.key,eq,value) or (meta.key,ne,value)&(meta.key2,in,[val1,val2])`
          });
        }
      }

      log(`Построение запроса: tenantId=${req.tenantId}`);
      const query = { tenantId: req.tenantId };
      
      // Применяем обычные фильтры (например, dialogId) к query
      // Но если есть dialogId в regularFilters, обрабатываем его отдельно
      const { dialogId: regularDialogId, ...otherRegularFilters } = regularFilters;
      Object.assign(query, otherRegularFilters);
      
      // Если есть фильтрация по meta или member, ограничиваем выборку
      if (dialogIds !== null) {
        if (dialogIds.length === 0) {
          // Нет диалогов с такими meta/member
          log(`Нет диалогов, соответствующих фильтрам`);
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
        log(`Найдено диалогов по фильтрам: ${dialogIds.length}`);
        
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
      const isCreatedAtSort = sortField && sortField.includes('createdAt');
      
      log(`Выполнение запроса диалогов: sortField=${sortField || 'нет'}, skip=${skip}, limit=${limit}`);
      let dialogs;
      
      if (isCreatedAtSort) {
        // Простая сортировка по createdAt диалога
        const sortDirection = sortField.includes('desc') ? -1 : 1;
        
        dialogs = await Dialog.find(query)
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: sortDirection })
          .select('-__v')
          .populate('tenantId', 'name domain')
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
          .lean();
        
        // Получаем участников для каждого диалога
        const dialogIdsForMembers = dialogsWithMembers.map(d => d.dialogId);
        const members = await DialogMember.find({ 
          dialogId: { $in: dialogIdsForMembers },
          userId: userId,
          tenantId: req.tenantId
        }).lean();
        
        // Если сортировка по unreadCount, получаем данные из UserDialogStats
        // Если сортировка по lastSeenAt или lastMessageAt, получаем данные из UserDialogActivity
        let statsMap = {};
        let activityMap = {};
        if (field === 'unreadCount') {
          const stats = await UserDialogStats.find({
            dialogId: { $in: dialogIdsForMembers },
            userId: userId,
            tenantId: req.tenantId
          }).lean();
          stats.forEach(stat => {
            statsMap[stat.dialogId] = stat;
          });
        } else if (field === 'lastSeenAt' || field === 'lastMessageAt') {
          const activities = await UserDialogActivity.find({
            dialogId: { $in: dialogIdsForMembers },
            userId: userId,
            tenantId: req.tenantId
          }).lean();
          activities.forEach(activity => {
            activityMap[activity.dialogId] = activity;
          });
        }
        
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
            // Для unreadCount используем UserDialogStats, для lastSeenAt/lastMessageAt - UserDialogActivity, для других полей - DialogMember
            if (field === 'unreadCount') {
              const stats = statsMap[dialog.dialogId];
              dialog.sortField = stats?.unreadCount || 0;
            } else if (field === 'lastSeenAt' || field === 'lastMessageAt') {
              const activity = activityMap[dialog.dialogId];
              dialog.sortField = activity?.[field] || 0;
            } else {
              dialog.sortField = member[field] || 0;
            }
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
        
        // Для unreadCount используем UserDialogStats, для lastSeenAt/lastMessageAt - UserDialogActivity, для других полей - DialogMember
        let lookupCollection, lookupLocalField, lookupForeignField, lookupAs, sortFieldPath;
        if (sortField === 'unreadCount') {
          lookupCollection = 'userdialogstats';
          lookupLocalField = 'dialogId';
          lookupForeignField = 'dialogId';
          lookupAs = 'stats';
          sortFieldPath = `$stats.${sortField}`;
        } else if (sortField === 'lastSeenAt' || sortField === 'lastMessageAt') {
          lookupCollection = 'userdialogactivities';
          lookupLocalField = 'dialogId';
          lookupForeignField = 'dialogId';
          lookupAs = 'activity';
          sortFieldPath = `$activity.${sortField}`;
        } else {
          lookupCollection = 'dialogmembers';
          lookupLocalField = '_id';
          lookupForeignField = 'dialogId';
          lookupAs = 'members';
          sortFieldPath = `$members.${sortField}`;
        }
        
        const pipeline = [
          { $match: query },
          {
            $lookup: {
              from: lookupCollection,
              localField: lookupLocalField,
              foreignField: lookupForeignField,
              as: lookupAs
            }
          },
          { $unwind: `$${lookupAs}` },
          {
            $addFields: {
              sortField: sortFieldPath
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
            $project: {
              __v: 0,
              'members._id': 0,
              'members.tenantId': 0,
              'members.dialogId': 0,
              'members.createdAt': 0,
              'members.updatedAt': 0,
              'stats._id': 0,
              'stats.tenantId': 0,
              'stats.dialogId': 0,
              'stats.createdAt': 0,
              'stats.lastUpdatedAt': 0,
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
      }

      log(`Найдено диалогов: ${dialogs.length}`);
      
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
      
      log(`Получение метаданных для ${dialogIdSet.size} диалогов`);

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
          // eslint-disable-next-line no-unused-vars
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

          // Получаем статистику диалога из DialogStats
          let stats = null;
          try {
            let dialogStats = await DialogStats.findOne({
              tenantId: req.tenantId,
              dialogId: dialogIdForCount
            }).lean();

            // Если DialogStats не найдена, создаем лениво с пересчитанными значениями
            if (!dialogStats) {
              stats = await recalculateDialogStats(req.tenantId, dialogIdForCount);
            } else {
              stats = {
                topicCount: dialogStats.topicCount || 0,
                memberCount: dialogStats.memberCount || 0,
                messageCount: dialogStats.messageCount || 0
              };
            }
          } catch (error) {
            console.error('Error getting dialog stats:', error);
            // Возвращаем дефолтные значения при ошибке
            stats = {
              topicCount: 0,
              memberCount: memberCount,
              messageCount: 0
            };
          }

          return sanitizeResponse({
            ...dialogWithoutMembers,
            meta,
            memberCount,
            stats
          });
        })
      );

      const total = await Dialog.countDocuments(query);
      log(`Всего диалогов: ${total}, страница: ${page}, лимит: ${limit}`);

      log(`Отправка ответа: ${dialogsWithMeta.length} диалогов`);
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
      log(`Ошибка обработки запроса:`, error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Get dialog by ID
  async getById(req, res) {
    const routePath = '/:id';
    const log = (...args) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { id } = req.params;
      log(`Получены параметры: id=${id}, tenantId=${req.tenantId}`);
      
      log(`Поиск диалога: dialogId=${id}, tenantId=${req.tenantId}`);
      const dialog = await Dialog.findOne({
        dialogId: id,
        tenantId: req.tenantId
      })
        .select('-__v')
        .populate('tenantId', 'name domain');

      if (!dialog) {
        log(`Диалог не найден: id=${id}`);
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }
      log(`Диалог найден: dialogId=${dialog.dialogId}`);

      log(`Получение метаданных диалога: dialogId=${dialog.dialogId}`);
      // Получаем метаданные диалога
      const meta = await metaUtils.getEntityMeta(
        req.tenantId,
        'dialog',
        dialog.dialogId
      );

      log(`Подсчет участников: dialogId=${dialog.dialogId}`);
      const memberCount = await DialogMember.countDocuments({
        tenantId: req.tenantId,
        dialogId: dialog.dialogId
      });
      log(`Найдено участников: ${memberCount}`);

      // Получаем статистику диалога из DialogStats
      let stats = null;
      try {
        let dialogStats = await DialogStats.findOne({
          tenantId: req.tenantId,
          dialogId: dialog.dialogId
        }).lean();

        // Если DialogStats не найдена, создаем лениво с пересчитанными значениями
        if (!dialogStats) {
          stats = await recalculateDialogStats(req.tenantId, dialog.dialogId);
        } else {
          stats = {
            topicCount: dialogStats.topicCount || 0,
            memberCount: dialogStats.memberCount || 0,
            messageCount: dialogStats.messageCount || 0
          };
        }
      } catch (error) {
        console.error('Error getting dialog stats:', error);
        // Возвращаем дефолтные значения при ошибке
        stats = {
          topicCount: 0,
          memberCount: memberCount,
          messageCount: 0
        };
      }

      const dialogObj = dialog.toObject();

      log(`Отправка ответа: dialogId=${dialog.dialogId}, memberCount=${memberCount}`);
      res.json({
        data: sanitizeResponse({
          ...dialogObj,
          meta,
          memberCount,
          stats
        })
      });
    } catch (error) {
      log(`Ошибка обработки запроса:`, error.message);
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
    } finally {
      log('>>>>> end');
    }
  },

  // Create new dialog
  async create(req, res) {
    const routePath = '/';
    const log = (...args) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { members, meta: metaPayload } = req.body;
      const membersCount = Array.isArray(members) ? members.length : 0;
      log(`Получены параметры: tenantId=${req.tenantId}, members=${membersCount}, meta=${metaPayload ? 'есть' : 'нет'}`);

      // Определяем actorId для событий (из API ключа или первого участника)
      let actorId = req.apiKey?.name || 'system';
      if (Array.isArray(members) && members.length > 0 && members[0].userId) {
        actorId = members[0].userId;
      }
      log(`ActorId для событий: ${actorId}`);

      log(`Создание диалога: tenantId=${req.tenantId}`);
      // Создаем диалог
      const dialog = await Dialog.create([{
        tenantId: req.tenantId
      }]);

      const createdDialog = dialog[0];
      log(`Диалог создан: dialogId=${createdDialog.dialogId}`);

      // Создаем DialogStats сразу после создания диалога
      const memberCount = Array.isArray(members) ? members.length : 0;
      log(`Создание DialogStats: dialogId=${createdDialog.dialogId}, memberCount=${memberCount}`);
      await updateDialogStats(
        req.tenantId,
        createdDialog.dialogId,
        {
          topicCount: 0,
          memberCount: memberCount,
          messageCount: 0
        },
        null
      );

      // Add meta data if provided (делаем это до обработки участников, чтобы метаданные были доступны)
      if (metaPayload && typeof metaPayload === 'object') {
        log(`Добавление метаданных: dialogId=${createdDialog.dialogId}, keys=${Object.keys(metaPayload).length}`);
        for (const [key, value] of Object.entries(metaPayload)) {
          const metaOptions = {
            createdBy: actorId,
          };

          if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'value')) {
            // If value is an object with dataType/value properties
            await metaUtils.setEntityMeta(
              req.tenantId,
              'dialog',
              createdDialog.dialogId,
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
              createdDialog.dialogId,
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

      // Получаем метаданные диалога один раз для всех событий
      const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', createdDialog.dialogId);
      const dialogSection = eventUtils.buildDialogSection({
        dialogId: createdDialog.dialogId,
        tenantId: createdDialog.tenantId,
        createdAt: createdDialog.createdAt,
        meta: dialogMeta || {}
      });

      // КРИТИЧНО: Собираем уникальных пользователей для предотвращения дублирования обновлений счетчиков
      const processedUserIds = new Set();

      // Обрабатываем участников, если они предоставлены
      if (Array.isArray(members) && members.length > 0) {
        log(`Обработка участников: dialogId=${createdDialog.dialogId}, count=${members.length}`);
        for (const memberData of members) {
          // Пропускаем дубликаты в одном запросе
          if (processedUserIds.has(memberData.userId)) {
            continue;
          }

          // Проверяем, существует ли участник уже в диалоге
          const existingMember = await DialogMember.findOne({
            tenantId: req.tenantId,
            dialogId: createdDialog.dialogId,
            userId: memberData.userId
          }).lean();

          if (existingMember) {
            // Участник уже существует - пропускаем
            continue;
          }

          // Отмечаем пользователя как обработанного
          processedUserIds.add(memberData.userId);

          // Проверяем и создаем пользователя, если его нет
          await userUtils.ensureUserExists(req.tenantId, memberData.userId, {
            type: memberData.type
          });

          // Добавляем участника в диалог
          const member = await dialogMemberUtils.addDialogMember(
            req.tenantId,
            memberData.userId,
            createdDialog.dialogId
          );

          // Получаем данные из UserDialogStats и UserDialogActivity для нового участника
          const memberStats = await UserDialogStats.findOne({
            tenantId: req.tenantId,
            userId: member.userId,
            dialogId: createdDialog.dialogId
          }).lean();
          
          const memberActivity = await UserDialogActivity.findOne({
            tenantId: req.tenantId,
            userId: member.userId,
            dialogId: createdDialog.dialogId
          }).lean();
          
          // Создаем событие dialog.member.add для каждого участника
          const memberSection = eventUtils.buildMemberSection({
            userId: member.userId,
            state: {
              unreadCount: memberStats?.unreadCount || 0,
              lastSeenAt: memberActivity?.lastSeenAt || 0,
              lastMessageAt: memberActivity?.lastMessageAt || 0,
            }
          });

          const memberEventContext = eventUtils.buildEventContext({
            eventType: 'dialog.member.add',
            dialogId: createdDialog.dialogId,
            entityId: createdDialog.dialogId,
            includedSections: ['dialog', 'member'],
            updatedFields: ['member']
          });

          const memberEvent = await eventUtils.createEvent({
            tenantId: req.tenantId,
            eventType: 'dialog.member.add',
            entityType: 'dialogMember',
            entityId: createdDialog.dialogId,
            actorId: actorId,
            actorType: 'user',
            data: eventUtils.composeEventData({
              context: memberEventContext,
              dialog: dialogSection,
              member: memberSection
            })
          });

          const memberEventId = memberEvent?.eventId || null;

          // КРИТИЧНО: Обновляем dialogCount для пользователя, используя dialog.member.add eventId
          // Это создаст user.stats.update с правильным sourceEventId от dialog.member.add
          try {
            await updateUserStatsDialogCount(
              req.tenantId,
              member.userId,
              1, // delta
              'dialog.member.add',
              memberEventId,
              actorId,
              'user'
            );
          } finally {
            // Создаем user.stats.update после обновления счетчика
            try {
              await finalizeCounterUpdateContext(req.tenantId, member.userId, memberEventId);
            } catch (error) {
              console.error(`Failed to finalize context for ${member.userId}:`, error);
            }
          }
        }
      }

      // Создаем событие dialog.create ПОСЛЕ обработки участников
      const eventContext = eventUtils.buildEventContext({
        eventType: 'dialog.create',
        dialogId: createdDialog.dialogId,
        entityId: createdDialog.dialogId,
        includedSections: ['dialog'],
        updatedFields: ['dialog']
      });

      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'dialog.create',
        entityType: 'dialog',
        entityId: createdDialog.dialogId,
        actorId: actorId,
        actorType: 'user',
        data: eventUtils.composeEventData({
          context: eventContext,
          dialog: dialogSection
        })
      });

      // Используем уже полученные метаданные
      const meta = dialogMeta;

      // Получаем статистику диалога для ответа
      const dialogStats = await DialogStats.findOne({
        tenantId: req.tenantId,
        dialogId: createdDialog.dialogId
      }).lean();

      const stats = dialogStats ? {
        topicCount: dialogStats.topicCount || 0,
        memberCount: dialogStats.memberCount || 0,
        messageCount: dialogStats.messageCount || 0
      } : {
        topicCount: 0,
        memberCount: memberCount,
        messageCount: 0
      };

      const dialogObj = createdDialog.toObject();

      log(`Отправка успешного ответа: dialogId=${createdDialog.dialogId}`);
      res.status(201).json({
        data: sanitizeResponse({
          ...dialogObj,
          meta,
          stats
        }),
        message: 'Dialog created successfully'
      });
    } catch (error) {
      log(`Ошибка обработки запроса:`, error.message);
      console.error('Error creating dialog:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          details: error.errors
        });
      }
      
      // Более детальное сообщение об ошибке
      const errorMessage = error.message || 'Неизвестная ошибка при создании диалога';
      res.status(500).json({
        error: 'Internal Server Error',
        message: errorMessage
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Delete dialog
  async delete(req, res) {
    const routePath = '/:id';
    const log = (...args) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { id } = req.params;
      log(`Получены параметры: id=${id}, tenantId=${req.tenantId}`);
      
      log(`Удаление диалога: id=${id}, tenantId=${req.tenantId}`);
      const dialog = await Dialog.findOneAndDelete({
        _id: id,
        tenantId: req.tenantId
      });

      if (!dialog) {
        log(`Диалог не найден: id=${id}`);
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }
      log(`Диалог найден и удален: dialogId=${dialog.dialogId}`);

      log(`Получение метаданных для события: dialogId=${dialog.dialogId}`);
      // Получаем метаданные диалога для события
      const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialog.dialogId);
      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });

      log(`Создание события dialog.delete: dialogId=${dialog.dialogId}`);
      const eventContext = eventUtils.buildEventContext({
        eventType: 'dialog.delete',
        dialogId: dialog.dialogId,
        entityId: dialog.dialogId,
        includedSections: ['dialog'],
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
          dialog: dialogSection
        })
      });

      log(`Удаление метаданных диалога: id=${id}`);
      // Удаляем все метаданные диалога
      await Meta.deleteMany({ entityType: 'dialog', entityId: id });

      log(`Отправка успешного ответа: dialogId=${dialog.dialogId}`);
      res.json({
        message: 'Dialog deleted successfully'
      });
    } catch (error) {
      log(`Ошибка обработки запроса:`, error.message);
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
    } finally {
      log('>>>>> end');
    }
  }
};
