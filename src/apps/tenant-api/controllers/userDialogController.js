import { 
  DialogMember, Dialog, Message, 
  Meta, MessageStatus, 
  // MessageReaction, 
  User } from '../../../models/index.js';
import * as metaUtils from '../utils/metaUtils.js';
import { parseFilters, extractMetaFilters, parseSort } from '../utils/queryParser.js';
import { sanitizeResponse } from '../utils/responseUtils.js';
import { validateGetUserDialogMessagesResponse, validateGetUserDialogMessageResponse } from '../validators/schemas/responseSchemas.js';
import * as eventUtils from '../utils/eventUtils.js';
import { generateTimestamp } from '../../../utils/timestampUtils.js';
import * as unreadCountUtils from '../utils/unreadCountUtils.js';
import {
  getSenderInfo,
  mergeMetaRecords,
  buildStatusMessageMatrix,
  buildReactionSet,
  getContextUserInfo
} from '../utils/userDialogUtils.js';

const userDialogController = {
  // Get user's dialogs with optional last message
  async getUserDialogs(req, res) {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const fetchMeta = (entityType, entityId) => metaUtils.getEntityMeta(
        req.tenantId,
        entityType,
        entityId
      );

      let dialogIds = null;
      let regularFilters = {};

      // Фильтрация по метаданным
      if (req.query.filter) {
        console.log('Filter received:', req.query.filter);
        try {
          // Парсим фильтры (поддержка как JSON, так и (field,operator,value) формата)
          const parsedFilters = parseFilters(req.query.filter);
          console.log('Parsed filters:', parsedFilters);
          
          // Извлекаем meta фильтры и member фильтры
          const { metaFilters, regularFilters: extractedRegularFilters, memberFilters } = extractMetaFilters(parsedFilters);
          regularFilters = extractedRegularFilters;
          console.log('Meta filters:', metaFilters);
          console.log('Regular filters:', regularFilters);
          console.log('Member filters:', memberFilters);
          
          // Обрабатываем meta фильтры
          if (Object.keys(metaFilters).length > 0) {
          const metaQuery = {
              tenantId: req.tenantId, // tenantId теперь строка (tnt_*)
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
          
          // Обрабатываем member фильтры (фильтрация по участникам)
          // Важно: нужно найти диалоги где есть И текущий пользователь, И указанные участники
          if (Object.keys(memberFilters).length > 0) {
            // Для фильтрации по участникам используем специальную логику:
            // находим диалоги где есть текущий пользователь И указанные участники
            // DialogMember уже импортирован в начале файла
            
            // Получаем список указанных участников из фильтра
            let targetUserIds = [];
            if (memberFilters.member) {
              const memberValue = memberFilters.member;
              if (typeof memberValue === 'string') {
                // Один участник - обрабатываем как $in с одним элементом
                targetUserIds = [memberValue];
                
                // Находим диалоги текущего пользователя
                const userDialogs = await DialogMember.find({
                  userId: userId,
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                const userDialogIds = userDialogs.map(d => d.dialogId);
                
                if (userDialogIds.length === 0) {
                  return res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                }
                
                // Находим диалоги где есть указанный участник (но только из диалогов текущего пользователя)
                const targetDialogs = await DialogMember.find({
                  userId: memberValue,
                  dialogId: { $in: userDialogIds },
                  tenantId: req.tenantId
                }).select('dialogId').lean();
                
                const memberDialogIds = targetDialogs.map(d => d.dialogId);
                
                console.log('Member filter (single) applied, found dialogs:', memberDialogIds.length, 'with member:', memberValue);
                
                if (memberDialogIds.length === 0) {
                  return res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                }
                
                // Если уже есть фильтр по meta, пересекаем результаты (AND логика)
                if (dialogIds !== null) {
                  dialogIds = dialogIds.filter(id => memberDialogIds.includes(id));
                } else {
                  dialogIds = memberDialogIds;
                }
              } else if (typeof memberValue === 'object' && memberValue.$in) {
                // Для $in: находим диалоги где есть ЛЮБОЙ из указанных участников (OR логика)
                targetUserIds = memberValue.$in;
                
                // Находим диалоги текущего пользователя
                const userDialogs = await DialogMember.find({
                  userId: userId,
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                const userDialogIds = userDialogs.map(d => d.dialogId);
                
                if (userDialogIds.length === 0) {
                  return res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                }
                
                // Находим диалоги где есть ЛЮБОЙ из указанных участников (но только из диалогов текущего пользователя)
                const targetDialogs = await DialogMember.find({
                  userId: { $in: targetUserIds },
                  dialogId: { $in: userDialogIds },
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                // Получаем уникальные dialogId
                const memberDialogIds = [...new Set(targetDialogs.map(d => d.dialogId))];
                
                console.log('Member filter ($in) applied:');
                console.log('  - Target user IDs:', targetUserIds);
                console.log('  - User dialog IDs:', userDialogIds.length);
                console.log('  - Target dialogs found:', targetDialogs.length);
                console.log('  - Unique dialog IDs:', memberDialogIds.length);
                console.log('  - Dialog IDs:', memberDialogIds);
                
                if (memberDialogIds.length === 0) {
                  return res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                }
                
                // Если уже есть фильтр по meta, пересекаем результаты (AND логика)
                if (dialogIds !== null) {
                  dialogIds = dialogIds.filter(id => memberDialogIds.includes(id));
                } else {
                  dialogIds = memberDialogIds;
                }
              } else if (typeof memberValue === 'object' && memberValue.$all) {
                // Для $all: находим диалоги где есть ВСЕ указанные участники (AND логика)
                targetUserIds = memberValue.$all;
                
                // Находим диалоги текущего пользователя
                const userDialogs = await DialogMember.find({
                  userId: userId,
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                const userDialogIds = userDialogs.map(d => d.dialogId);
                
                if (userDialogIds.length === 0) {
                  return res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                }
                
                // Находим все участники для указанных пользователей в диалогах текущего пользователя
                const allTargetMembers = await DialogMember.find({
                  userId: { $in: targetUserIds },
                  dialogId: { $in: userDialogIds },
                  tenantId: req.tenantId,
                }).select('dialogId userId').lean();
                
                // Группируем по dialogId
                const dialogMembersMap = {};
                allTargetMembers.forEach(dm => {
                  if (!dialogMembersMap[dm.dialogId]) {
                    dialogMembersMap[dm.dialogId] = new Set();
                  }
                  dialogMembersMap[dm.dialogId].add(dm.userId);
                });
                
                // Находим диалоги где присутствуют ВСЕ указанные участники
                const memberDialogIds = [];
                for (const dialogId of userDialogIds) {
                  const members = dialogMembersMap[dialogId] || new Set();
                  // Проверяем, что все указанные участники присутствуют в диалоге
                  const hasAllMembers = targetUserIds.every(targetUserId => members.has(targetUserId));
                  if (hasAllMembers) {
                    memberDialogIds.push(dialogId);
                  }
                }
                
                console.log('Member filter ($all) applied, found dialogs:', memberDialogIds.length, 'with all members:', targetUserIds);
                
                if (memberDialogIds.length === 0) {
                  return res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                }
                
                // Если уже есть фильтр по meta, пересекаем результаты (AND логика)
                if (dialogIds !== null) {
                  dialogIds = dialogIds.filter(id => memberDialogIds.includes(id));
                } else {
                  dialogIds = memberDialogIds;
                }
              } else if (typeof memberValue === 'object' && memberValue.$ne) {
                // Для $ne: находим диалоги где НЕТ указанного участника (исключение участника)
                const excludedUserId = memberValue.$ne;
                
                // Находим диалоги текущего пользователя
                const userDialogs = await DialogMember.find({
                  userId: userId,
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                const userDialogIds = userDialogs.map(d => d.dialogId);
                
                if (userDialogIds.length === 0) {
                  return res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                }
                
                // Находим диалоги где есть исключаемый участник
                const dialogsWithExcluded = await DialogMember.find({
                  userId: excludedUserId,
                  dialogId: { $in: userDialogIds },
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                const excludedDialogIds = new Set(dialogsWithExcluded.map(d => d.dialogId));
                
                // Исключаем эти диалоги из списка
                const memberDialogIds = userDialogIds.filter(dialogId => !excludedDialogIds.has(dialogId));
                
                console.log('Member filter ($ne) applied, found dialogs:', memberDialogIds.length, 'excluding member:', excludedUserId);
                
                if (memberDialogIds.length === 0) {
                  return res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                }
                
                // Если уже есть фильтр по meta, пересекаем результаты (AND логика)
                if (dialogIds !== null) {
                  dialogIds = dialogIds.filter(id => memberDialogIds.includes(id));
                } else {
                  dialogIds = memberDialogIds;
                }
              } else if (typeof memberValue === 'object' && memberValue.$nin) {
                // Для $nin: находим диалоги где НЕТ ни одного из указанных участников
                const excludedUserIds = Array.isArray(memberValue.$nin) ? memberValue.$nin : [memberValue.$nin];
                
                // Находим диалоги текущего пользователя
                const userDialogs = await DialogMember.find({
                  userId: userId,
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                const userDialogIds = userDialogs.map(d => d.dialogId);
                
                if (userDialogIds.length === 0) {
                  return res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                }
                
                // Находим диалоги где есть хотя бы один из исключаемых участников
                const dialogsWithExcluded = await DialogMember.find({
                  userId: { $in: excludedUserIds },
                  dialogId: { $in: userDialogIds },
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                const excludedDialogIds = new Set(dialogsWithExcluded.map(d => d.dialogId));
                
                // Исключаем эти диалоги из списка
                const memberDialogIds = userDialogIds.filter(dialogId => !excludedDialogIds.has(dialogId));
                
                console.log('Member filter ($nin) applied, found dialogs:', memberDialogIds.length, 'excluding members:', excludedUserIds);
                
                if (memberDialogIds.length === 0) {
                  return res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                }
                
                // Если уже есть фильтр по meta, пересекаем результаты (AND логика)
                if (dialogIds !== null) {
                  dialogIds = dialogIds.filter(id => memberDialogIds.includes(id));
                } else {
                  dialogIds = memberDialogIds;
                }
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

      // Get user's dialog memberships
      const dialogMembersQuery = {
        userId: userId,
        tenantId: req.tenantId
      };
      
      // Применяем обычные фильтры (например, dialogId) к dialogMembersQuery
      // Но если есть dialogId в regularFilters, обрабатываем его отдельно
      const { dialogId: regularDialogId, ...otherRegularFilters } = regularFilters;
      
      // Применяем другие regularFilters к dialogMembersQuery (unreadCount, lastSeenAt и т.д.)
      // Эти поля есть в модели DialogMember
      if (Object.keys(otherRegularFilters).length > 0) {
        // Применяем фильтры для полей DialogMember
        const allowedFields = ['unreadCount', 'lastSeenAt', 'lastMessageAt'];
        for (const [field, condition] of Object.entries(otherRegularFilters)) {
          if (allowedFields.includes(field)) {
            dialogMembersQuery[field] = condition;
            console.log(`Applied regular filter ${field}:`, condition);
          }
        }
      }

      // Применяем обычные фильтры (unreadCount, lastSeenAt, etc.) из query параметров
      // (для обратной совместимости, если фильтр приходит не через filter параметр)
      if (req.query.unreadCount !== undefined) {
        console.log('req.query.unreadCount:', req.query.unreadCount, 'type:', typeof req.query.unreadCount);
        
        // Поддержка операторов для unreadCount
        const unreadCountValue = req.query.unreadCount;
        
        if (typeof unreadCountValue === 'object' && unreadCountValue !== null) {
          // Объект с операторами MongoDB ($gte, $gt, $lte, $lt)
          dialogMembersQuery.unreadCount = unreadCountValue;
          console.log('Applied unreadCount object filter:', unreadCountValue);
        } else if (typeof unreadCountValue === 'string') {
          // Строка с префиксом оператора
          if (unreadCountValue.startsWith('gte:')) {
            const value = parseInt(unreadCountValue.substring(4));
            if (!isNaN(value)) {
              dialogMembersQuery.unreadCount = { $gte: value };
              console.log('Applied unreadCount gte filter:', value);
            }
          } else if (unreadCountValue.startsWith('gt:')) {
            const value = parseInt(unreadCountValue.substring(3));
            if (!isNaN(value)) {
              dialogMembersQuery.unreadCount = { $gt: value };
              console.log('Applied unreadCount gt filter:', value);
            }
          } else if (unreadCountValue.startsWith('lte:')) {
            const value = parseInt(unreadCountValue.substring(4));
            if (!isNaN(value)) {
              dialogMembersQuery.unreadCount = { $lte: value };
              console.log('Applied unreadCount lte filter:', value);
            }
          } else if (unreadCountValue.startsWith('lt:')) {
            const value = parseInt(unreadCountValue.substring(3));
            if (!isNaN(value)) {
              dialogMembersQuery.unreadCount = { $lt: value };
              console.log('Applied unreadCount lt filter:', value);
            }
          } else {
            // Точное равенство (eq)
            const unreadCount = parseInt(unreadCountValue);
            if (!isNaN(unreadCount)) {
              dialogMembersQuery.unreadCount = unreadCount;
              console.log('Applied unreadCount eq filter:', unreadCount);
            }
          }
        } else {
          // Число - точное равенство
          const unreadCount = parseInt(unreadCountValue);
          if (!isNaN(unreadCount)) {
            dialogMembersQuery.unreadCount = unreadCount;
            console.log('Applied unreadCount eq filter:', unreadCount);
          }
        }
        console.log('dialogMembersQuery after unreadCount:', dialogMembersQuery);
      }
      
      if (req.query.lastSeenAt !== undefined) {
        // Поддержка операторов для lastSeenAt
        const lastSeenAtValue = req.query.lastSeenAt;
        if (lastSeenAtValue.startsWith('gt:')) {
          dialogMembersQuery.lastSeenAt = { $gt: new Date(lastSeenAtValue.substring(3)) };
        } else if (lastSeenAtValue.startsWith('gte:')) {
          dialogMembersQuery.lastSeenAt = { $gte: new Date(lastSeenAtValue.substring(4)) };
        } else if (lastSeenAtValue.startsWith('lt:')) {
          dialogMembersQuery.lastSeenAt = { $lt: new Date(lastSeenAtValue.substring(3)) };
        } else if (lastSeenAtValue.startsWith('lte:')) {
          dialogMembersQuery.lastSeenAt = { $lte: new Date(lastSeenAtValue.substring(4)) };
        } else {
          dialogMembersQuery.lastSeenAt = new Date(lastSeenAtValue);
        }
        console.log('Applied lastSeenAt filter:', dialogMembersQuery.lastSeenAt);
      }

      // Если есть фильтрация по meta или по участникам, ограничиваем выборку
      if (dialogIds !== null) {
        if (dialogIds.length === 0) {
          // Нет диалогов с такими фильтрами
          console.log('No dialogs found after filtering, returning empty result');
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
        
        // Если также есть regularFilters.dialogId, делаем пересечение
        if (regularDialogId !== undefined) {
          // Преобразуем regularDialogId в массив для сравнения
          const regularDialogIdArray = Array.isArray(regularDialogId) ? regularDialogId : [regularDialogId];
          // Пересечение: оставляем только те dialogIds, которые есть и в dialogIds, и в regularDialogId
          dialogIds = dialogIds.filter(id => regularDialogIdArray.includes(id));
          
          if (dialogIds.length === 0) {
            // Нет диалогов, удовлетворяющих обоим условиям
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
        }
        
        console.log('Applying dialogIds filter:', dialogIds.length, 'dialogs');
        dialogMembersQuery.dialogId = { $in: dialogIds };
      } else if (regularDialogId !== undefined) {
        // Если нет dialogIds из meta/member фильтров, но есть regularDialogId
        const regularDialogIdArray = Array.isArray(regularDialogId) ? regularDialogId : [regularDialogId];
        dialogMembersQuery.dialogId = regularDialogIdArray.length === 1 ? regularDialogIdArray[0] : { $in: regularDialogIdArray };
      }

      console.log('Final dialogMembersQuery:', JSON.stringify(dialogMembersQuery, null, 2));
      let dialogMembers = await DialogMember.find(dialogMembersQuery)
        .sort({ lastSeenAt: -1 }) // Sort by last seen (most recent first)
        .lean();
      
      console.log('Found dialogMembers:', dialogMembers.length);

      // Получаем уникальные dialogId
      const uniqueDialogIds = [...new Set(dialogMembers.map(m => m.dialogId))];
      
      console.log('Unique dialog IDs from dialogMembers:', uniqueDialogIds.length, uniqueDialogIds);

      // Если был применен фильтр по участникам, дополнительно проверяем, что в каждом диалоге действительно есть нужные участники
      if (dialogIds !== null && req.query.filter) {
        try {
          const parsedFilters = parseFilters(req.query.filter);
          const { memberFilters } = extractMetaFilters(parsedFilters);
          
          if (Object.keys(memberFilters).length > 0 && memberFilters.member) {
            const memberValue = memberFilters.member;
            let requiredUserIds = [];
            
            if (typeof memberValue === 'string') {
              requiredUserIds = [memberValue];
            } else if (typeof memberValue === 'object' && memberValue.$in) {
              requiredUserIds = memberValue.$in;
            } else if (typeof memberValue === 'object' && memberValue.$all) {
              requiredUserIds = memberValue.$all;
            }
            
            if (requiredUserIds.length > 0) {
              // Проверяем, что в каждом диалоге есть нужные участники
              const verifiedMembers = await DialogMember.find({
                dialogId: { $in: uniqueDialogIds },
                userId: { $in: requiredUserIds },
                tenantId: req.tenantId
              }).select('dialogId userId').lean();
              
              const dialogsWithRequiredMembers = new Set(verifiedMembers.map(m => m.dialogId));
              
              // Фильтруем только те диалоги, где действительно есть нужные участники
              const verifiedDialogIds = uniqueDialogIds.filter(dialogId => dialogsWithRequiredMembers.has(dialogId));
              
              console.log('Verified dialog IDs with required members:', verifiedDialogIds.length, 'required:', requiredUserIds);
              
              if (verifiedDialogIds.length !== uniqueDialogIds.length) {
                console.warn('Some dialogs were filtered out after verification:', uniqueDialogIds.length, '->', verifiedDialogIds.length);
              }
              
              // Используем только проверенные диалоги
              uniqueDialogIds.length = 0;
              uniqueDialogIds.push(...verifiedDialogIds);
              
              // Также фильтруем dialogMembers, чтобы оставить только проверенные диалоги
              const verifiedDialogIdsSet = new Set(verifiedDialogIds);
              dialogMembers = dialogMembers.filter(m => verifiedDialogIdsSet.has(m.dialogId));
            }
          }
        } catch (error) {
          console.error('Error verifying member filter:', error);
        }
      }

      // Загружаем все диалоги одним запросом
      const dialogsData = await Dialog.find({
        dialogId: { $in: uniqueDialogIds },
        tenantId: req.tenantId
      }).select('dialogId name createdAt _id').lean();

      // Создаем Map для быстрого поиска
      const dialogsMap = new Map(dialogsData.map(d => [d.dialogId, d]));

      // Загружаем всех участников для этих диалогов одним запросом (для подсчета)
      const allMembers = await DialogMember.find({
        dialogId: { $in: uniqueDialogIds },
        tenantId: req.tenantId,
      }).select('dialogId').lean();

      // Подсчитываем количество участников по dialogId
      const membersCountByDialog = {};
      allMembers.forEach(member => {
        if (!membersCountByDialog[member.dialogId]) {
          membersCountByDialog[member.dialogId] = 0;
        }
        membersCountByDialog[member.dialogId]++;
      });

      // Format response data
      const dialogs = dialogMembers
        .map(member => {
          const dialog = dialogsMap.get(member.dialogId);
          if (!dialog) {
            console.warn(`Dialog not found for dialogId: ${member.dialogId}`);
            return null;
          }
          
          return {
            dialogId: dialog.dialogId,
            dialogObjectId: dialog._id, // Сохраняем ObjectId для поиска сообщений
            // Context - данные текущего пользователя в этом диалоге
            context: {
              userId: userId,
              unreadCount: member.unreadCount,
              lastSeenAt: member.lastSeenAt,
              lastMessageAt: member.lastMessageAt,
              joinedAt: member.createdAt
            },
            // Members count - количество участников диалога
            membersCount: membersCountByDialog[member.dialogId] || 0,
            // Calculate last interaction time (most recent of lastSeenAt or lastMessageAt)
            // Возвращаем как число с микросекундами, а не Date объект
            lastInteractionAt: Math.max(
              member.lastSeenAt || 0,
              member.lastMessageAt || 0
            )
          };
        })
        .filter(d => d !== null); // Убираем null значения

      // Apply sorting BEFORE pagination
      if (req.query.sort) {
        // Parse sort parameter in format (field,direction)
        const sortMatch = req.query.sort.match(/\(([^,]+),([^)]+)\)/);
        if (sortMatch) {
          const field = sortMatch[1];
          const direction = sortMatch[2];
          console.log('Sorting by:', field, direction);
        
          dialogs.sort((a, b) => {
            let aVal, bVal;
            
            if (field === 'lastSeenAt') {
              aVal = a.context.lastSeenAt || 0;
              bVal = b.context.lastSeenAt || 0;
            } else if (field === 'lastInteractionAt') {
              aVal = a.lastInteractionAt || 0;
              bVal = b.lastInteractionAt || 0;
            } else if (field === 'unreadCount') {
              aVal = a.context.unreadCount || 0;
              bVal = b.context.unreadCount || 0;
            } else {
              // Default sorting by lastInteractionAt
              aVal = a.lastInteractionAt || 0;
              bVal = b.lastInteractionAt || 0;
            }
            
            if (direction === 'desc') {
              return bVal - aVal;
            } else {
              return aVal - bVal;
            }
          });
        } else {
          console.log('Invalid sort format:', req.query.sort);
          // Fallback to default sorting
          dialogs.sort((a, b) => (b.lastInteractionAt || 0) - (a.lastInteractionAt || 0));
        }
      } else {
        // Sort by last interaction time (most recent first) - default
        dialogs.sort((a, b) => (b.lastInteractionAt || 0) - (a.lastInteractionAt || 0));
      }

      // Get total count for pagination (after sorting)
      const total = dialogs.length;

      // Apply pagination to the sorted results
      const paginatedDialogs = dialogs.slice(skip, skip + limit);

      // Загружаем последние сообщения для всех диалогов
      const lastMessages = await Promise.all(
        paginatedDialogs.map(async (dialog) => {
          const lastMsg = await Message.findOne({
            dialogId: dialog.dialogId, // Используем dialogId (строку dlg_*), а не ObjectId
            tenantId: req.tenantId
          })
            .sort({ createdAt: -1 })
            .select('messageId content senderId type createdAt')
            .lean();
          
          return { dialogId: dialog.dialogId, message: lastMsg };
        })
      );

      // Создаем Map последних сообщений
      const lastMessagesMap = new Map();
      lastMessages.forEach(item => {
        if (item.message) {
          lastMessagesMap.set(item.dialogId, item.message);
        }
      });

      // Получаем уникальные senderId из последних сообщений
      const senderIds = [...new Set(
        Array.from(lastMessagesMap.values())
          .map(msg => msg.senderId)
          .filter(Boolean)
      )];

      // Загружаем информацию об отправителях
      const sendersData = await User.find({
        userId: { $in: senderIds },
        tenantId: req.tenantId
      }).select('userId name').lean();

      // Загружаем meta для отправителей (для всех senderIds, даже если пользователя нет в User)
      const sendersMetaQuery = {
        tenantId: req.tenantId,
        entityType: 'user',
        entityId: { $in: senderIds }
      };

      const sendersMetaRecords = await Meta.find(sendersMetaQuery).lean();
      const groupedSenderMeta = {};
      sendersMetaRecords.forEach((record) => {
        if (!groupedSenderMeta[record.entityId]) {
          groupedSenderMeta[record.entityId] = [];
        }
        groupedSenderMeta[record.entityId].push(record);
      });
      const metaBySender = {};
      Object.entries(groupedSenderMeta).forEach(([entityId, records]) => {
        metaBySender[entityId] = mergeMetaRecords(records);
      });

      // Создаем Map отправителей
      const sendersMap = new Map();
      
      // 1. Добавляем пользователей, которые есть в User модели
      sendersData.forEach(user => {
        sendersMap.set(user.userId, {
          userId: user.userId,
          meta: metaBySender[user.userId] || {}
        });
      });
      
      // 2. Добавляем пользователей, которых нет в User, но есть meta теги
      // Fallback: если пользователь не существует в Chat3 API, используем getMeta для получения данных
      senderIds.forEach(senderId => {
        if (!sendersMap.has(senderId) && metaBySender[senderId]) {
          // Пользователь не существует в User модели, но есть meta теги
          // Создаем userInfo только на основе meta (без name, так как его нет)
          sendersMap.set(senderId, {
            userId: senderId,
            name: null, // Имя отсутствует, так как пользователя нет в User
            meta: metaBySender[senderId]
          });
        }
      });

      // Get meta for each dialog and build final response
      let finalDialogs = await Promise.all(
        paginatedDialogs.map(async (dialog) => {
          // Получаем meta теги для диалога
          const dialogMeta = await fetchMeta('dialog', dialog.dialogId);

          // Получаем последнее сообщение
          const lastMsg = lastMessagesMap.get(dialog.dialogId);
          let lastMessage = null;
          
          if (lastMsg) {
            lastMessage = {
              messageId: lastMsg.messageId,
              content: lastMsg.content,
              senderId: lastMsg.senderId,
              type: lastMsg.type,
              createdAt: lastMsg.createdAt
            };

            // Добавляем senderInfo если отправитель найден
            const senderInfo = sendersMap.get(lastMsg.senderId);
            if (senderInfo) {
              lastMessage.senderInfo = senderInfo;
            }
          }

          // Удаляем временное поле dialogObjectId из ответа
          const { dialogObjectId, ...dialogWithoutObjectId } = dialog;

          return {
            ...dialogWithoutObjectId,
            meta: dialogMeta,
            lastMessage: lastMessage
          };
        })
      );

      console.log('Returning dialogs:', finalDialogs.length, 'total:', total);
      console.log('Dialog IDs used:', dialogIds);
      console.log('Filter was applied:', dialogIds !== null);
      console.log('Sort parameter:', req.query.sort);
      res.json({
        data: sanitizeResponse(finalDialogs),
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

  // Get messages from a dialog in context of specific user
  async getUserDialogMessages(req, res) {
    try {
      const { userId, dialogId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;
      const fetchMeta = (entityType, entityId) => metaUtils.getEntityMeta(
        req.tenantId,
        entityType,
        entityId
      );

      // 1. Проверяем, что пользователь является участником диалога
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId,
        userId: userId
      });

      if (!member) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'User is not a member of this dialog'
        });
      }

      // 2. Получаем диалог для проверки существования
      const dialog = await Dialog.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId
      });

      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      // 3. Получаем сообщения диалога
      const query = {
        tenantId: req.tenantId,
        dialogId: dialogId
      };

      // Поддержка фильтрации
      if (req.query.filter) {
        try {
          const parsedFilters = parseFilters(req.query.filter);
          const { metaFilters, regularFilters } = extractMetaFilters(parsedFilters);
          
          // Применяем обычные фильтры
          for (const [field, condition] of Object.entries(regularFilters)) {
            query[field] = condition;
          }
          
          // Для meta фильтров используем отдельную логику
          if (Object.keys(metaFilters).length > 0) {
            const metaQuery = {
              tenantId: req.tenantId,
              entityType: 'message'
            };
            
            const messageIdsFromMeta = [];
            for (const [key, condition] of Object.entries(metaFilters)) {
              metaQuery.key = key.replace('meta.', '');
              metaQuery.value = condition;
              
              const metaDocs = await Meta.find(metaQuery).select('entityId');
              const ids = metaDocs.map(doc => doc.entityId);
              messageIdsFromMeta.push(...ids);
            }
            
            if (messageIdsFromMeta.length > 0) {
              query.messageId = { $in: messageIdsFromMeta };
            } else {
              // Если meta фильтры не дали результатов, возвращаем пустой список
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
          }
        } catch (err) {
          console.error('Error parsing filter:', err);
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid filter format'
          });
        }
      }

      // Получаем общее количество
      const total = await Message.countDocuments(query);

      // Получаем сообщения с сортировкой по времени создания (новые сначала по умолчанию)
      let sortOption = '-createdAt'; // По умолчанию
      
      if (req.query.sort) {
        // Пробуем распарсить формат (field,direction)
        const parsedSort = parseSort(req.query.sort);
        if (parsedSort) {
          sortOption = parsedSort;
        } else {
          // Если не удалось распарсить, используем как есть (для обратной совместимости)
          sortOption = req.query.sort;
        }
      }
      
      const messages = await Message.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean();

      // 4. Получаем все статусы для всех сообщений одним запросом (оптимизация)
      const messageIds = messages.map(m => m.messageId);
      const allStatuses = await MessageStatus.find({
        tenantId: req.tenantId,
        messageId: { $in: messageIds }
      }).select('messageId userId userType tenantId status createdAt').lean();

      // Группируем статусы по messageId для быстрого доступа
      const statusesByMessage = {};
      allStatuses.forEach(status => {
        if (!statusesByMessage[status.messageId]) {
          statusesByMessage[status.messageId] = [];
        }
        statusesByMessage[status.messageId].push(status);
      });

      const senderInfoCache = new Map();

      // 4.5. Загружаем информацию о пользователе из контекста
      const contextUserInfo = await getContextUserInfo(req.tenantId, userId, fetchMeta);
      if (contextUserInfo) {
        senderInfoCache.set(contextUserInfo.userId, contextUserInfo);
      }

      // 5. Обогащаем сообщения контекстными данными для пользователя
      const enrichedMessages = await Promise.all(
        messages.map(async (message) => {
          // Получаем статусы для этого сообщения
          // const messageStatuses = statusesByMessage[message.messageId] || [];
          
          // Находим статусы для текущего пользователя (может быть несколько записей)
          // const myStatuses = messageStatuses.filter(s => s.userId === userId);

          // Формируем матрицу статусов по userType и status (исключая статусы отправителя сообщения)
          const statusMessageMatrix = await buildStatusMessageMatrix(req.tenantId, message.messageId, message.senderId);

          // Формируем reactionSet
          const reactionSet = await buildReactionSet(req.tenantId, message.messageId, userId);

          // Получаем метаданные сообщения
          const messageMeta = await fetchMeta('message', message.messageId);

          // Формируем обогащенное сообщение с контекстом пользователя
          const contextData = {
            userId: userId,
            isMine: message.senderId === userId
            // statuses: null, // Статусы только для данного пользователя
            // statuses: myStatuses, // Закомментировано: всегда возвращаем null
            // myReaction: userReaction // Удалено: используйте reactionSet для получения информации о реакциях
          };

          // Добавляем userInfo если пользователь найден в User модели
          if (contextUserInfo) {
            contextData.userInfo = contextUserInfo;
          }

          const senderInfo = await getSenderInfo(req.tenantId, message.senderId, senderInfoCache);

          return {
            ...message,
            meta: messageMeta,
            // Контекстные данные для конкретного пользователя
            context: contextData,
            // Матрица статусов (количество пар userType-status, исключая статусы отправителя)
            statusMessageMatrix: statusMessageMatrix,
            // statuses: messageStatuses, // Закомментировано: заменено на statusMessageMatrix
            reactionSet: reactionSet,
            senderInfo: senderInfo || null
          };
        })
      );

      // Удаляем служебные поля
      const sanitizedMessages = enrichedMessages.map(msg => sanitizeResponse(msg));

      const response = {
        data: sanitizedMessages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

      // Валидация структуры ответа (только в development)
      if (process.env.NODE_ENV !== 'production') {
        const validation = validateGetUserDialogMessagesResponse(response);
        if (!validation.valid) {
          console.warn('Response validation warning:', validation.error);
        }
      }

      res.json(response);
    } catch (error) {
      console.error('Error in getUserDialogMessages:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get single message from dialog in context of specific user
  async getUserDialogMessage(req, res) {
    try {
      const { userId, dialogId, messageId } = req.params;
      const fetchMeta = (entityType, entityId) => metaUtils.getEntityMeta(
        req.tenantId,
        entityType,
        entityId
      );

      // 1. Проверяем, что пользователь является участником диалога
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId,
        userId: userId
      });

      if (!member) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'User is not a member of this dialog'
        });
      }

      // 2. Получаем сообщение
      const message = await Message.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId,
        messageId: messageId
      }).lean();

      if (!message) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
      }

      // 3. Получаем все статусы сообщения (для всех пользователей)
      const allStatuses = await MessageStatus.find({
        tenantId: req.tenantId,
        messageId: messageId
      }).select('messageId userId userType tenantId status createdAt').lean();

      // 4. Фильтруем статусы для текущего пользователя
      // const myStatuses = allStatuses.filter(s => s.userId === userId);

      // 4.5. Формируем матрицу статусов по userType и status (исключая статусы отправителя сообщения)
      const statusMessageMatrix = await buildStatusMessageMatrix(req.tenantId, messageId, message.senderId);

      // 5. Формируем reactionSet
      const reactionSet = await buildReactionSet(req.tenantId, messageId, userId);

      // 7. Получаем метаданные сообщения
      const messageMeta = await fetchMeta('message', message.messageId);

      // 7.5. Загружаем информацию о пользователе из контекста
      const contextUserInfo = await getContextUserInfo(req.tenantId, userId, fetchMeta);

      // 8. Формируем ответ с контекстом пользователя
      const contextData = {
        userId: userId,
        isMine: message.senderId === userId
        // statuses: null, // Статусы только для данного пользователя
        // statuses: myStatuses, // Закомментировано: всегда возвращаем null
        // myReaction: userReaction // Удалено: используйте reactionSet для получения информации о реакциях
      };

      // Добавляем userInfo если пользователь найден
      if (contextUserInfo) {
        contextData.userInfo = contextUserInfo;
      }

      const senderInfo = await getSenderInfo(req.tenantId, message.senderId, undefined);

      const enrichedMessage = {
        ...message,
        meta: messageMeta,
        // Контекстные данные для конкретного пользователя
        context: contextData,
        // Матрица статусов (количество пар userType-status, исключая статусы отправителя)
        statusMessageMatrix: statusMessageMatrix,
        reactionSet: reactionSet,
        senderInfo: senderInfo || null
      };

      const response = {
        data: sanitizeResponse(enrichedMessage)
      };

      // Валидация структуры ответа (только в development)
      if (process.env.NODE_ENV !== 'production') {
        const validation = validateGetUserDialogMessageResponse(response);
        if (!validation.valid) {
          console.warn('Response validation warning:', validation.error);
        }
      }

      res.json(response);
    } catch (error) {
      console.error('Error in getUserDialogMessage:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },


  /**
   * Получение постраничного списка всех статусов сообщения из истории
   * 
   * ВАЖНО: MessageStatus хранит полную историю изменений статусов.
   * Каждое изменение статуса создает новую запись в истории.
   * 
   * Возвращает все записи статусов для сообщения, отсортированные по времени создания
   * (новые первыми). Один пользователь может иметь несколько записей.
   * 
   * @param {Object} req - Express request object
   * @param {Object} req.params - Параметры пути
   * @param {string} req.params.userId - ID пользователя
   * @param {string} req.params.dialogId - ID диалога
   * @param {string} req.params.messageId - ID сообщения
   * @param {Object} req.query - Query параметры
   * @param {number} req.query.page - Номер страницы (по умолчанию 1)
   * @param {number} req.query.limit - Количество записей на странице (по умолчанию 50)
   * @param {Object} res - Express response object
   */
  async getMessageStatuses(req, res) {
    try {
      const { userId, dialogId, messageId } = req.params;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const skip = (page - 1) * limit;

      // Нормализуем dialogId (в нижний регистр, как в модели)
      const normalizedDialogId = dialogId.toLowerCase().trim();

      // 1. Проверяем, что пользователь является участником диалога
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: normalizedDialogId,
        userId: userId
      });

      if (!member) {
        console.log('getMessageStatuses: User not found in dialog', {
          tenantId: req.tenantId,
          dialogId: normalizedDialogId,
          userId,
          originalDialogId: dialogId
        });
        
        return res.status(403).json({
          error: 'Forbidden',
          message: 'User is not a member of this dialog'
        });
      }

      // 2. Проверяем, что сообщение существует
      const message = await Message.findOne({
        tenantId: req.tenantId,
        dialogId: normalizedDialogId,
        messageId: messageId
      }).lean();

      if (!message) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
      }

      // 3. Получаем общее количество записей в истории статусов
      const total = await MessageStatus.countDocuments({
        tenantId: req.tenantId,
        messageId: messageId
      });

      // 4. Получаем записи истории статусов с пагинацией
      // Сортируем по времени создания в порядке убывания (новые первыми)
      const statuses = await MessageStatus.find({
        tenantId: req.tenantId,
        messageId: messageId
      })
        .select('messageId userId userType tenantId status createdAt')
        .sort({ createdAt: -1 }) // Новые записи первыми
        .skip(skip)
        .limit(limit)
        .lean();

      const pages = Math.ceil(total / limit);

      res.json({
        data: statuses,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      });
    } catch (error) {
      console.error('Error in getMessageStatuses:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Middleware для проверки членства пользователя в диалоге
  async checkDialogMembership(req, res, next) {
    try {
      const { userId, dialogId } = req.params;

      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId,
        userId: userId
      });

      if (!member) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'User is not a member of this dialog'
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  /**
   * Создание новой записи в истории статусов сообщения
   * 
   * ВАЖНО: Каждое изменение статуса создает новую запись в истории (не обновляет существующую).
   * MessageStatus хранит полную историю всех изменений статусов для каждого пользователя.
   * 
   * При создании записи:
   * 1. Автоматически заполняется поле userType на основе типа пользователя
   * 2. Получается последний статус пользователя для определения oldStatus
   * 3. Автоматически обновляются счетчики непрочитанных сообщений (через pre-save hook)
   * 4. Генерируется событие изменения статуса для других участников диалога
   * 
   * @param {Object} req - Express request object
   * @param {Object} req.params - Параметры пути
   * @param {string} req.params.userId - ID пользователя
   * @param {string} req.params.dialogId - ID диалога
   * @param {string} req.params.messageId - ID сообщения
   * @param {string} req.params.status - Новый статус (unread, delivered, read)
   * @param {Object} res - Express response object
   */
  async updateMessageStatus(req, res) {
    try {
      const { userId, dialogId, messageId, status } = req.params;

      // Basic validation
      if (!['unread', 'delivered', 'read'].includes(status)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid status. Must be one of: unread, delivered, read'
        });
      }

      // Check if message exists and belongs to dialog and tenant
      const message = await Message.findOne({
        messageId: messageId,
        dialogId: dialogId,
        tenantId: req.tenantId
      });

      if (!message) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
      }

      // Получаем тип пользователя для заполнения поля userType
      const user = await User.findOne({
        tenantId: req.tenantId,
        userId: userId
      }).select('type').lean();
      
      const userType = user?.type || null;

      // Получаем последний статус для определения oldStatus (для событий и счетчиков)
      const lastStatus = await MessageStatus.findOne({
        messageId: messageId,
        userId: userId,
        tenantId: req.tenantId
      })
        .sort({ createdAt: -1 })
        .lean();

      const oldStatus = lastStatus?.status || null;

      // Получаем старое значение unreadCount ПЕРЕД созданием MessageStatus
      // (pre-save hook обновит счетчик при создании)
      const oldDialogMember = await DialogMember.findOne({
        tenantId: req.tenantId,
        userId: userId,
        dialogId: dialogId
      }).lean();
      const oldUnreadCount = oldDialogMember?.unreadCount ?? 0;

      // Всегда создаем новую запись в истории статусов (не обновляем существующую)
      const newStatusData = {
        messageId: messageId,
        userId: userId,
        tenantId: req.tenantId,
        status: status,
        userType: userType, // Заполняем тип пользователя
        createdAt: generateTimestamp()
      };

      // Создаем новую запись в истории
      // pre-save hook автоматически обновит счетчики непрочитанных сообщений
      const messageStatus = await MessageStatus.create(newStatusData);

      // Получаем диалог и его метаданные для события
      const dialog = await Dialog.findOne({
        dialogId: dialogId,
        tenantId: req.tenantId
      }).lean();

      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialog.dialogId);
      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });

      // Получаем мета-теги сообщения для события
      const messageMeta = await metaUtils.getEntityMeta(req.tenantId, 'message', messageId);

      // Формируем полную матрицу статусов для Event
      const statusMessageMatrix = await buildStatusMessageMatrix(req.tenantId, messageId, message.senderId);

      const messageSection = eventUtils.buildMessageSection({
        messageId,
        dialogId: dialogId,
        senderId: message.senderId,
        type: message.type,
        content: message.content,
        meta: messageMeta || {},
        statusUpdate: {
          userId,
          status,
          oldStatus: oldStatus
        },
        statusMessageMatrix
      });

      const statusContext = eventUtils.buildEventContext({
        eventType: 'message.status.update',
        dialogId: dialogId,
        entityId: messageId,
        messageId,
        includedSections: ['dialog', 'message'],
        updatedFields: ['message.status']
      });

      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'message.status.update',
        entityType: 'messageStatus',
        entityId: messageId,
        actorId: userId,
        actorType: 'user',
        data: eventUtils.composeEventData({
          context: statusContext,
          dialog: dialogSection,
          message: messageSection
        })
      });

      // Получаем обновленный DialogMember после создания MessageStatus
      // (pre-save hook уже обновил счетчик)
      const updatedMember = await DialogMember.findOne({
        tenantId: req.tenantId,
        userId: userId,
        dialogId: dialogId
      }).lean();

      // Проверяем, изменился ли счетчик (сравниваем oldUnreadCount с новым)
      const newUnreadCount = updatedMember?.unreadCount ?? 0;
      const unreadCountChanged = oldUnreadCount !== newUnreadCount;

      // Если счетчик был обновлен (изменился), создаем событие dialog.member.update
      if (updatedMember && unreadCountChanged) {
        // Используем уже полученную секцию dialog из события message.status.update
        const memberSection = eventUtils.buildMemberSection({
          userId,
          state: {
            unreadCount: updatedMember.unreadCount,
            lastSeenAt: updatedMember.lastSeenAt,
            lastMessageAt: updatedMember.lastMessageAt,
            isActive: updatedMember.isActive
          }
        });

        const memberContext = eventUtils.buildEventContext({
          eventType: 'dialog.member.update',
          dialogId: dialogId,
          entityId: dialogId,
          includedSections: ['dialog', 'member'],
          updatedFields: ['member.state.unreadCount', 'member.state.lastSeenAt']
        });

        await eventUtils.createEvent({
          tenantId: req.tenantId,
          eventType: 'dialog.member.update',
          entityType: 'dialogMember',
          entityId: dialogId,
          actorId: userId,
          actorType: 'user',
          data: eventUtils.composeEventData({
            context: memberContext,
            dialog: dialogSection,
            member: memberSection
          })
        });

        // Логика создания user.stats.update перенесена в update-worker
        // update-worker будет создавать UserUpdate на основе dialog.member.update событий
      }

      res.json({
        data: sanitizeResponse(messageStatus),
        message: 'Message status updated successfully'
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid message ID'
        });
      }
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

export default userDialogController;
