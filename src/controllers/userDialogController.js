import mongoose from 'mongoose';
import { DialogMember, Dialog, Message, Meta, MessageStatus, MessageReaction } from '../models/index.js';
import * as metaUtils from '../utils/metaUtils.js';
import { parseFilters, extractMetaFilters } from '../utils/queryParser.js';
import { sanitizeResponse } from '../utils/responseUtils.js';

const userDialogController = {
  // Get user's dialogs with optional last message
  async getUserDialogs(req, res) {
    try {
      const { userId } = req.params;
      const includeLastMessage = req.query.includeLastMessage === 'true';
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      let dialogIds = null;

      // Фильтрация по метаданным
      if (req.query.filter) {
        console.log('Filter received:', req.query.filter);
        try {
          // Парсим фильтры (поддержка как JSON, так и (field,operator,value) формата)
          const parsedFilters = parseFilters(req.query.filter);
          console.log('Parsed filters:', parsedFilters);
          
          // Извлекаем meta фильтры
          const { metaFilters, regularFilters } = extractMetaFilters(parsedFilters);
          console.log('Meta filters:', metaFilters);
          console.log('Regular filters:', regularFilters);
          
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
          
          // Применяем обычные фильтры к query
          Object.assign(req.query, regularFilters);
          console.log('Regular filters applied:', regularFilters);
          
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
        tenantId: req.tenantId,
        isActive: true
      };

      // Применяем обычные фильтры (unreadCount, lastSeenAt, etc.)
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
        dialogMembersQuery.dialogId = { $in: dialogIds };
      }

      const dialogMembers = await DialogMember.find(dialogMembersQuery)
        .sort({ lastSeenAt: -1 }) // Sort by last seen (most recent first)
        .lean();

      // Получаем уникальные dialogId
      const uniqueDialogIds = [...new Set(dialogMembers.map(m => m.dialogId))];

      // Загружаем все диалоги одним запросом
      const dialogsData = await Dialog.find({
        dialogId: { $in: uniqueDialogIds },
        tenantId: req.tenantId
      }).select('dialogId name createdAt updatedAt _id').lean();

      // Создаем Map для быстрого поиска
      const dialogsMap = new Map(dialogsData.map(d => [d.dialogId, d]));

      // Загружаем всех участников для этих диалогов одним запросом
      const allMembers = await DialogMember.find({
        dialogId: { $in: uniqueDialogIds },
        tenantId: req.tenantId,
        isActive: true
      }).select('dialogId userId unreadCount lastSeenAt lastMessageAt isActive createdAt').lean();

      // Группируем участников по dialogId
      const membersByDialog = {};
      allMembers.forEach(member => {
        if (!membersByDialog[member.dialogId]) {
          membersByDialog[member.dialogId] = [];
        }
        membersByDialog[member.dialogId].push({
          userId: member.userId,
          unreadCount: member.unreadCount,
          lastSeenAt: member.lastSeenAt,
          lastMessageAt: member.lastMessageAt,
          isActive: member.isActive,
          joinedAt: member.createdAt
        });
      });

      // Format response data
      const dialogs = dialogMembers
        .map(member => {
          const dialog = dialogsMap.get(member.dialogId);
          if (!dialog) {
            console.warn(`Dialog not found for dialogId: ${member.dialogId}`);
            return null;
          }
          
          // Получаем участников этого диалога
          const dialogMembersList = membersByDialog[member.dialogId] || [];
          
          return {
            dialogId: dialog.dialogId,
            name: dialog.name,
            dialogObjectId: dialog._id, // Сохраняем ObjectId для поиска сообщений
            // Context - данные текущего пользователя в этом диалоге
            context: {
              userId: userId,
              unreadCount: member.unreadCount,
              lastSeenAt: member.lastSeenAt,
              lastMessageAt: member.lastMessageAt,
              isActive: member.isActive,
              joinedAt: member.createdAt
            },
            // Members - все участники диалога
            members: dialogMembersList,
            // Calculate last interaction time (most recent of lastSeenAt or lastMessageAt)
            lastInteractionAt: new Date(Math.max(
              new Date(member.lastSeenAt || 0).getTime(),
              new Date(member.lastMessageAt || 0).getTime()
            ))
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
              aVal = new Date(a.context.lastSeenAt || 0);
              bVal = new Date(b.context.lastSeenAt || 0);
            } else if (field === 'lastInteractionAt') {
              aVal = new Date(a.lastInteractionAt || 0);
              bVal = new Date(b.lastInteractionAt || 0);
            } else if (field === 'unreadCount') {
              aVal = a.context.unreadCount || 0;
              bVal = b.context.unreadCount || 0;
            } else {
              // Default sorting by lastInteractionAt
              aVal = new Date(a.lastInteractionAt || 0);
              bVal = new Date(b.lastInteractionAt || 0);
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
          dialogs.sort((a, b) => new Date(b.lastInteractionAt) - new Date(a.lastInteractionAt));
        }
      } else {
        // Sort by last interaction time (most recent first) - default
        dialogs.sort((a, b) => new Date(b.lastInteractionAt) - new Date(a.lastInteractionAt));
      }

      // Get total count for pagination (after sorting)
      const total = dialogs.length;

      // Apply pagination to the sorted results
      const paginatedDialogs = dialogs.slice(skip, skip + limit);

      // Get last message and meta for each dialog
      let finalDialogs = await Promise.all(
        paginatedDialogs.map(async (dialog) => {
          // Получаем meta теги для диалога
          const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialog.dialogId);

          // Получаем последнее сообщение, если запрошено
          let lastMessage = null;
          if (includeLastMessage) {
            const lastMsg = await Message.findOne({
              dialogId: dialog.dialogObjectId, // Используем ObjectId для поиска
              tenantId: req.tenantId
            })
              .sort({ createdAt: -1 })
              .select('content senderId type createdAt')
              .lean();

            if (lastMsg) {
              lastMessage = {
                content: lastMsg.content,
                senderId: lastMsg.senderId,
                type: lastMsg.type,
                createdAt: lastMsg.createdAt
              };
            }
          }

          // Удаляем временное поле dialogObjectId из ответа
          const { dialogObjectId, ...dialogWithoutObjectId } = dialog;

          return {
            ...dialogWithoutObjectId,
            meta: dialogMeta,
            ...(includeLastMessage ? { lastMessage } : {})
          };
        })
      );

      console.log('Returning dialogs:', finalDialogs.length, 'total:', total);
      console.log('Dialog IDs used:', dialogIds);
      console.log('Filter was applied:', dialogIds !== null);
      console.log('Sort parameter:', req.query.sort);
      console.log('Include last message:', includeLastMessage);
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

      // 1. Проверяем, что пользователь является участником диалога
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId,
        userId: userId,
        isActive: true
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
      const sortOption = req.query.sort || '-createdAt';
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
      }).lean();

      // Группируем статусы по messageId для быстрого доступа
      const statusesByMessage = {};
      allStatuses.forEach(status => {
        if (!statusesByMessage[status.messageId]) {
          statusesByMessage[status.messageId] = [];
        }
        statusesByMessage[status.messageId].push(status);
      });

      // 5. Обогащаем сообщения контекстными данными для пользователя
      const enrichedMessages = await Promise.all(
        messages.map(async (message) => {
          // Получаем статусы для этого сообщения
          const messageStatuses = statusesByMessage[message.messageId] || [];
          
          // Находим статусы для текущего пользователя (может быть несколько записей)
          const myStatuses = messageStatuses.filter(s => s.userId === userId);

          // Получаем реакцию пользователя на сообщение
          const reaction = await MessageReaction.findOne({
            tenantId: req.tenantId,
            messageId: message.messageId,
            userId: userId
          }).lean();

          // Получаем метаданные сообщения
          const messageMeta = await metaUtils.getEntityMeta(req.tenantId, 'message', message.messageId);

          // Формируем обогащенное сообщение с контекстом пользователя
          return {
            ...message,
            meta: messageMeta,
            // Контекстные данные для конкретного пользователя
            context: {
              userId: userId,
              isMine: message.senderId === userId,
              statuses: myStatuses, // Статусы только для данного пользователя
              myReaction: reaction ? reaction.reaction : null
            },
            // Все статусы от всех пользователей
            statuses: messageStatuses
          };
        })
      );

      // Удаляем служебные поля
      const sanitizedMessages = enrichedMessages.map(msg => sanitizeResponse(msg));

      res.json({
        data: sanitizedMessages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
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

      // 1. Проверяем, что пользователь является участником диалога
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId,
        userId: userId,
        isActive: true
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
      }).lean();

      // 4. Фильтруем статусы для текущего пользователя
      const myStatuses = allStatuses.filter(s => s.userId === userId);

      // 5. Получаем реакцию пользователя на сообщение
      const reaction = await MessageReaction.findOne({
        tenantId: req.tenantId,
        messageId: messageId,
        userId: userId
      }).lean();

      // 6. Получаем все реакции на сообщение
      const allReactions = await MessageReaction.find({
        tenantId: req.tenantId,
        messageId: messageId
      }).lean();

      // 7. Получаем метаданные сообщения
      const messageMeta = await metaUtils.getEntityMeta(req.tenantId, 'message', message.messageId);

      // 8. Формируем ответ с контекстом пользователя
      const enrichedMessage = {
        ...message,
        meta: messageMeta,
        // Контекстные данные для конкретного пользователя
        context: {
          userId: userId,
          isMine: message.senderId === userId,
          statuses: myStatuses, // Статусы только для данного пользователя
          myReaction: reaction ? reaction.reaction : null
        },
        // Полная информация
        statuses: allStatuses,
        reactions: allReactions
      };

      res.json({
        data: sanitizeResponse(enrichedMessage)
      });
    } catch (error) {
      console.error('Error in getUserDialogMessage:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

export default userDialogController;
