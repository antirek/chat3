// eslint-disable-next-line no-unused-vars
import { Message, Dialog, MessageStatus, User, Event, Update, DialogMember, UserDialogActivity } from '../../../models/index.js';
import * as metaUtils from '../utils/metaUtils.js';
import * as eventUtils from '../utils/eventUtils.js';
import { parseFilters, extractMetaFilters } from '../utils/queryParser.js';
import { sanitizeResponse } from '../utils/responseUtils.js';
import { generateTimestamp } from '../../../utils/timestampUtils.js';
import { buildStatusMessageMatrix, buildReactionSet } from '../utils/userDialogUtils.js';
import { 
  updateUnreadCount, 
  updateUserStatsTotalMessagesCount,
  finalizeCounterUpdateContext 
} from '../../../utils/counterUtils.js';
import { updateLastMessageAt } from '../utils/dialogMemberUtils.js';
import * as topicUtils from '../../../utils/topicUtils.js';
import mongoose from 'mongoose';

/**
 * Helper function to enrich messages with meta data and statuses
 * @param {Array} messages - Array of message documents
 * @param {String} tenantId - Tenant ID
 * @returns {Promise<Array>} - Array of enriched messages with meta and statuses
 */
async function getSenderInfo(tenantId, senderId, cache = new Map()) {
  if (!senderId) {
    return null;
  }

  if (cache.has(senderId)) {
    return cache.get(senderId);
  }

  const user = await User.findOne({
    tenantId,
    userId: senderId
  })
    .select('userId name createdAt')
    .lean();

  if (!user) {
    cache.set(senderId, null);
    return null;
  }

  const userMeta = await metaUtils.getEntityMeta(tenantId, 'user', senderId);

  const senderInfo = {
    userId: user.userId,
    createdAt: user.createdAt ?? null,
    meta: userMeta
  };

  cache.set(senderId, senderInfo);
  return senderInfo;
}

async function enrichMessagesWithMetaAndStatuses(messages, tenantId, dialogId = null) {
  const senderInfoCache = new Map();

  // Собираем все уникальные topicId из сообщений для батчинга
  const topicIds = [...new Set(messages
    .map(msg => {
      const msgObj = msg.toObject ? msg.toObject() : msg;
      return msgObj.topicId;
    })
    .filter(id => id !== null && id !== undefined)
  )];

  // Получаем все топики одним запросом (оптимизация N+1)
  let topicsMap = new Map();
  if (topicIds.length > 0 && dialogId) {
    try {
      topicsMap = await topicUtils.getTopicsWithMetaBatch(tenantId, dialogId, topicIds);
    } catch (error) {
      console.error('Error getting topics with meta batch:', error);
      // Продолжаем выполнение, topicsMap останется пустым
    }
  }

  return await Promise.all(
    messages.map(async (message) => {
      // Get message meta data
      const meta = await metaUtils.getEntityMeta(
        tenantId,
        'message',
        message.messageId
      );
      
      const messageObj = message.toObject ? message.toObject() : message;
      
      // Получаем информацию о топике из map
      let topic = null;
      if (messageObj.topicId) {
        topic = topicsMap.get(messageObj.topicId) || null;
      }
      
      // Формируем матрицу статусов (исключая статусы отправителя сообщения)
      const statusMessageMatrix = await buildStatusMessageMatrix(tenantId, message.messageId, messageObj.senderId);
      
      // Формируем reactionSet (без currentUserId, так как это общий эндпоинт)
      const reactionSet = await buildReactionSet(tenantId, message.messageId, null);
      
      const senderInfo = await getSenderInfo(tenantId, messageObj.senderId, senderInfoCache);

      // dialogId теперь уже строка в формате dlg_, не нужно преобразовывать
      return {
        ...messageObj,
        meta,
        topic,
        statusMessageMatrix,
        reactionSet,
        senderInfo: senderInfo || null
      };
    })
  );
}

const messageController = {
  // Get all messages with filtering and pagination
  async getAll(req, res) {
    try {
      console.log('=== getAll called ===');
      console.log('tenantId:', req.tenantId);
      console.log('query:', req.query);
      
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      console.log('pagination:', { page, limit, skip });

      // Build base query
      let query = {
        tenantId: req.tenantId
      };

      console.log('base query:', query);

      // Initialize metaFilters variable
      let metaFilters = {};
      
      // Parse sort parameter
      let sortOptions = { createdAt: -1 }; // Default sort by newest first
      if (req.query.sort) {
        console.log('Sort parameter:', req.query.sort);
        // Parse sort string like "(createdAt,asc)" or "(createdAt,desc)"
        const sortMatch = req.query.sort.match(/\(([^,]+),([^)]+)\)/);
        if (sortMatch) {
          const field = sortMatch[1];
          const direction = sortMatch[2];
          console.log(`Sorting by ${field} ${direction}`);
          sortOptions = { [field]: direction === 'asc' ? 1 : -1 };
        }
      }
      console.log('Sort options:', sortOptions);

      // Apply filters if provided
      if (req.query.filter) {
        try {
          console.log('Filter string:', req.query.filter);
          const parsedFilters = parseFilters(req.query.filter);
          console.log('Parsed filters:', parsedFilters);
          const { regularFilters, metaFilters: extractedMetaFilters } = extractMetaFilters(parsedFilters);
          console.log('Regular filters:', regularFilters);
          console.log('Meta filters:', extractedMetaFilters);
          
          // Assign metaFilters to the outer scope
          metaFilters = extractedMetaFilters;
          
          // Apply regular filters
          Object.assign(query, regularFilters);
          
          // Apply meta filters if any
          if (Object.keys(metaFilters).length > 0) {
            console.log('Applying meta filters:', metaFilters);
            const metaQuery = await metaUtils.buildMetaQuery(req.tenantId, 'message', metaFilters);
            console.log('Meta query result:', metaQuery);
            if (metaQuery) {
              query = { ...query, ...metaQuery };
              console.log('Final query with meta filters:', query);
            }
          }
          
          console.log('Final query:', query);
        } catch (error) {
          console.log('Filter parsing error:', error.message);
          // Continue without filters if parsing fails
        }
      }

      // Get messages with pagination
      const messages = await Message.find(query)
        .select('messageId dialogId senderId content type createdAt')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      console.log('Found messages:', messages.length);

      // Дополнительная проверка: проверим мета-теги найденных сообщений
      if (Object.keys(metaFilters).length > 0) {
        console.log('Verifying meta filters for found messages...');
        for (const message of messages) {
          const messageMeta = await metaUtils.getEntityMeta(req.tenantId, 'message', message.messageId);
          console.log(`Message ${message.messageId} meta:`, messageMeta);
          
          // Проверяем каждый мета-фильтр
          for (const [key, expectedValue] of Object.entries(metaFilters)) {
            const actualValue = messageMeta[key];
            if (actualValue !== expectedValue) {
              console.error(`❌ META FILTER MISMATCH for message ${message.messageId}:`);
              console.error(`   Expected ${key}=${expectedValue}, got ${key}=${actualValue}`);
            } else {
              console.log(`✅ Meta filter OK for message ${message.messageId}: ${key}=${actualValue}`);
            }
          }
        }
      }

      // Add meta data and message statuses for each message
      const messagesWithMeta = await enrichMessagesWithMetaAndStatuses(messages, req.tenantId);

      const total = await Message.countDocuments(query);

      res.json({
        data: sanitizeResponse(messagesWithMeta),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error in getAll:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },
  // Get messages for a specific dialog
  async getDialogMessages(req, res) {
    try {
      const { dialogId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Check if dialog exists and belongs to tenant
      const dialog = await Dialog.findOne({
        dialogId: dialogId,
        tenantId: req.tenantId
      });

      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      // Parse filters if provided
      let query = {
        tenantId: req.tenantId,
        dialogId: dialog.dialogId // Используем строковый dialogId для поиска сообщений
      };

      if (req.query.filter) {
        try {
          const parsedFilters = parseFilters(req.query.filter);
          const { regularFilters, metaFilters } = extractMetaFilters(parsedFilters);
          
          // Apply regular filters
          Object.assign(query, regularFilters);
          
          // Обработка фильтра по topicId
          if (regularFilters.topicId !== undefined) {
            if (regularFilters.topicId === null || regularFilters.topicId === 'null') {
              query.topicId = null;
            } else {
              query.topicId = regularFilters.topicId;
            }
            delete regularFilters.topicId; // Удаляем из regularFilters, чтобы не дублировать
          }
          
          // Apply meta filters if any
          if (Object.keys(metaFilters).length > 0) {
            const metaQuery = await metaUtils.buildMetaQuery(req.tenantId, 'message', metaFilters);
            if (metaQuery) {
              query = { ...query, ...metaQuery };
            }
          }
        // eslint-disable-next-line no-unused-vars
        } catch (error) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid filter format'
          });
        }
      }

      // Apply sorting
      let sortOptions = { createdAt: -1 }; // Default sort by newest first
      if (req.query.sort) {
        // Parse sort parameter in format (field,direction)
        const sortMatch = req.query.sort.match(/\(([^,]+),([^)]+)\)/);
        if (sortMatch) {
          const field = sortMatch[1];
          const direction = sortMatch[2];
          console.log('Message sorting by:', field, direction);
          
          if (field === 'createdAt') {
            sortOptions = { createdAt: direction === 'asc' ? 1 : -1 };
          } else if (field === 'senderId') {
            sortOptions = { senderId: direction === 'asc' ? 1 : -1 };
          } else {
            console.log('Unknown sort field:', field, 'using default');
          }
        } else {
          console.log('Invalid sort format:', req.query.sort);
        }
      }

      const messages = await Message.find(query)
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .populate('tenantId', 'name domain')
        .sort(sortOptions);

      // Add meta data and message statuses for each message
      // Передаем dialogId для батчинга топиков
      const messagesWithMeta = await enrichMessagesWithMetaAndStatuses(messages, req.tenantId, dialog.dialogId);

      const total = await Message.countDocuments(query);

      res.json({
        data: sanitizeResponse(messagesWithMeta),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
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

  // Create new message in dialog
  async createMessage(req, res) {
    // Проверяем поддержку транзакций (mongodb-memory-server не поддерживает)
    // В тестах используем mongodb-memory-server, который не поддерживает транзакции
    // Поэтому просто не используем транзакции в тестах
    const useTransactions = process.env.NODE_ENV !== 'test';
    let session = null;
    if (useTransactions) {
      try {
        session = await mongoose.startSession();
        session.startTransaction();
      } catch (error) {
        // Если не удалось создать сессию, продолжаем без транзакций
        console.warn('Failed to start transaction session, continuing without transactions:', error.message);
        if (session) {
          try {
            await session.endSession();
          } catch (e) {
            // Игнорируем ошибки при закрытии сессии
          }
        }
        session = null;
      }
    }

    try {
      const { dialogId } = req.params;
      const { content, senderId, type = 'internal.text', meta, quotedMessageId, topicId } = req.body;
      const normalizedType = type;
      const messageContent = typeof content === 'string' ? content : '';
      const metaPayload = meta && typeof meta === 'object' ? { ...meta } : {};
      const isSystemMessage = normalizedType.startsWith('system.');
      const MEDIA_MESSAGE_TYPES = new Set(['internal.image', 'internal.file', 'internal.audio', 'internal.video']);

      if (!senderId) {
        if (useTransactions && session) {
          await session.abortTransaction();
          await session.endSession();
        }
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required field: senderId'
        });
      }

      if (normalizedType === 'internal.text' && messageContent.trim().length === 0) {
        if (useTransactions && session) {
          await session.abortTransaction();
          await session.endSession();
        }
        return res.status(400).json({
          error: 'Bad Request',
          message: 'content is required for internal.text messages'
        });
      }

      if (MEDIA_MESSAGE_TYPES.has(normalizedType)) {
        const mediaUrl = typeof metaPayload.url === 'string' ? metaPayload.url.trim() : '';
        if (!mediaUrl) {
          if (useTransactions && session) {
            await session.abortTransaction();
            await session.endSession();
          }
          return res.status(400).json({
            error: 'Bad Request',
            message: `meta.url is required for ${normalizedType} messages`
          });
        }
        metaPayload.url = mediaUrl;
      }

      // Check if dialog exists and belongs to tenant
      const dialog = await Dialog.findOne({
        dialogId: dialogId,
        tenantId: req.tenantId
      });

      if (!dialog) {
        if (useTransactions && session) {
          await session.abortTransaction();
          await session.endSession();
        }
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      // Валидация topicId, если указан
      let topic = null;
      if (topicId) {
        const topicDoc = await topicUtils.getTopicById(req.tenantId, dialogId, topicId);
        if (!topicDoc) {
          if (useTransactions && session) {
            await session.abortTransaction();
            await session.endSession();
          }
          return res.status(404).json({
            error: 'ERROR_NO_TOPIC',
            message: 'Topic not found'
          });
        }
        // Получаем топик с мета-тегами для ответа
        try {
          topic = await topicUtils.getTopicWithMeta(req.tenantId, dialogId, topicId);
        } catch (error) {
          console.error('Error getting topic with meta:', error);
          topic = { topicId, meta: {} };
        }
      }

      // Create message
      const createOptions = useTransactions && session ? { session } : {};
      const message = await Message.create([{
        tenantId: req.tenantId,
        dialogId: dialog.dialogId, // Используем строковый dialogId
        content: messageContent || '',
        senderId,
        type: normalizedType,
        topicId: topicId || null
      }], createOptions);

      const createdMessage = message[0];

      // Add meta data if provided (ПЕРЕД созданием события, чтобы метаданные попали в событие)
      if (metaPayload && typeof metaPayload === 'object' && Object.keys(metaPayload).length > 0) {
        for (const [key, value] of Object.entries(metaPayload)) {
          const metaOptions = {
            createdBy: senderId,
          };

          if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'value')) {
            // If value is an object with dataType/value properties
            await metaUtils.setEntityMeta(
              req.tenantId,
              'message',
              message.messageId,
              key,
              value.value,
              value.dataType || 'string',
              metaOptions
            );
          } else {
            // If value is a simple value
            await metaUtils.setEntityMeta(
              req.tenantId,
              'message',
              message.messageId,
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

      // Создаем событие message.create ПЕРЕД обновлением счетчиков, чтобы получить eventId
      const eventContext = eventUtils.buildEventContext({
        eventType: 'message.create',
        dialogId: dialog.dialogId,
        entityId: createdMessage.messageId,
        messageId: createdMessage.messageId,
        includedSections: ['dialog', 'message'],
        updatedFields: ['message']
      });

      // Получаем мета-теги сообщения для события (теперь они уже сохранены)
      const messageMeta = await metaUtils.getEntityMeta(
        req.tenantId,
        'message',
        createdMessage.messageId
      );

      const dialogMeta = await metaUtils.getEntityMeta(
        req.tenantId,
        'dialog',
        dialog.dialogId
      );

      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });

      const senderInfo = await getSenderInfo(req.tenantId, senderId);

      // Ограничиваем контент до 4096 символов для события
      const MAX_CONTENT_LENGTH = 4096;
      const eventContent = messageContent.length > MAX_CONTENT_LENGTH 
        ? messageContent.substring(0, MAX_CONTENT_LENGTH) 
        : messageContent;

      // Получаем топик для события, если topicId указан
      let topicForEvent = null;
      if (topicId) {
        try {
          topicForEvent = await topicUtils.getTopicWithMeta(req.tenantId, dialogId, topicId);
        } catch (error) {
          console.error('Error getting topic with meta for event:', error);
          topicForEvent = { topicId, meta: {} };
        }
      }

      const messageSection = eventUtils.buildMessageSection({
        messageId: createdMessage.messageId,
        dialogId: dialog.dialogId,
        senderId,
        type,
        content: eventContent,
        meta: messageMeta,
        quotedMessage: null, // quotedMessage добавим позже
        topicId: topicId || null,
        topic: topicForEvent
      });

      // КРИТИЧНО: Создаем событие и сохраняем eventId для обновления счетчиков
      const messageEvent = await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'message.create',
        entityType: 'message',
        entityId: createdMessage.messageId,
        actorId: senderId,
        actorType: 'user',
        data: eventUtils.composeEventData({
          context: eventContext,
          dialog: dialogSection,
          message: messageSection
        })
      });

      const sourceEventId = messageEvent?.eventId || null;
      const sourceEventType = 'message.create';

      // Create MessageStatus records and update counters for all dialog participants
      if (!isSystemMessage) {
        const dialogMembers = await DialogMember.find({
          tenantId: req.tenantId,
          dialogId: dialog.dialogId
        }).select('userId').lean();
        
        // Фильтруем получателей (исключаем отправителя)
        const recipients = dialogMembers.filter(m => m.userId !== senderId);
        
        // КРИТИЧНО: Используем try-finally для гарантированной финализации контекстов
        try {
          if (recipients.length > 0) {
            // 1. Загружаем типы пользователей одним запросом
            const userIds = recipients.map(m => m.userId);
            const users = await User.find({
              tenantId: req.tenantId,
              userId: { $in: userIds }
            }).select('userId type').lean();
            
            // Создаем Map для быстрого доступа к типам пользователей
            const userTypeMap = new Map();
            users.forEach(user => {
              userTypeMap.set(user.userId, user.type || null);
            });
            
            // 2. Создаем MessageStatus записи батчем через insertMany
            const messageStatuses = recipients.map(member => ({
              messageId: createdMessage.messageId,
              userId: member.userId,
              dialogId: dialog.dialogId, // КРИТИЧНО: Передаем dialogId для избежания поиска Message
              userType: userTypeMap.get(member.userId) || null,
              tenantId: req.tenantId,
              status: 'unread',
              createdAt: generateTimestamp()
            }));
            
            if (messageStatuses.length > 0) {
              const insertOptions = useTransactions && session 
                ? { ordered: false, session } 
                : { ordered: false };
              await MessageStatus.insertMany(messageStatuses, insertOptions);
            }
            
            // 3. Обновляем unreadCount батчами по 10 через Promise.allSettled
            const BATCH_SIZE = 10;
            const updatePromises = [];
            
            for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
              const batch = recipients.slice(i, i + BATCH_SIZE);
              const batchPromises = batch.map(member =>
                updateUnreadCount(
                  req.tenantId,
                  member.userId,
                  dialog.dialogId,
                  1, // delta
                  sourceEventType,
                  sourceEventId,
                  createdMessage.messageId,
                  senderId,
                  'user',
                  topicId || null, // topicId для обновления счетчиков топика
                  useTransactions && session ? session : null // session для транзакции
                ).catch(error => {
                  console.error(`Error updating unreadCount for user ${member.userId}:`, error);
                  return { error, userId: member.userId };
                })
              );
              
              updatePromises.push(Promise.allSettled(batchPromises));
            }
            
            // Ждем завершения всех батчей
            await Promise.all(updatePromises);
          }
          
          // 4. Обновление totalMessagesCount для отправителя
          await updateUserStatsTotalMessagesCount(
            req.tenantId,
            senderId,
            1, // delta
            sourceEventType,
            sourceEventId,
            createdMessage.messageId,
            senderId,
            'user'
          );
          
          // 5. Обновление lastMessageAt для всех участников диалога параллельно
          const messageTimestamp = createdMessage.createdAt;
          const lastMessageAtPromises = dialogMembers.map(member =>
            updateLastMessageAt(
              req.tenantId,
              member.userId,
              dialog.dialogId,
              messageTimestamp
            ).catch(error => {
              console.error(`Error updating lastMessageAt for user ${member.userId}:`, error);
              return { error, userId: member.userId };
            })
          );
          
          await Promise.allSettled(lastMessageAtPromises);
        } finally {
          // КРИТИЧНО: Гарантированная финализация контекстов даже при ошибках
          // Создаем user.stats.update для всех пользователей, у которых изменились счетчики
          // Для получателей (изменился unreadCount)
          const finalizePromises = recipients.map(member =>
            finalizeCounterUpdateContext(req.tenantId, member.userId, sourceEventId).catch(error => {
              console.error(`Failed to finalize context for ${member.userId}:`, error);
              return { error, userId: member.userId };
            })
          );
          
          await Promise.allSettled(finalizePromises);
          
          // Для отправителя (изменился totalMessagesCount)
          try {
            await finalizeCounterUpdateContext(req.tenantId, senderId, sourceEventId);
          } catch (error) {
            console.error(`Failed to finalize context for ${senderId}:`, error);
          }
        }
      }

      // Коммитим транзакцию, если используется
      if (useTransactions && session) {
        await session.commitTransaction();
        await session.endSession();
      }

      // Add meta data if provided
      if (metaPayload && typeof metaPayload === 'object') {
        for (const [key, value] of Object.entries(metaPayload)) {
          const metaOptions = {
            createdBy: senderId,
          };

          if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'value')) {
            // If value is an object with dataType/value properties
            await metaUtils.setEntityMeta(
              req.tenantId,
              'message',
              createdMessage.messageId,
              key,
              value.value,
              value.dataType || 'string',
              metaOptions
            );
          } else {
            // If value is a simple value
            await metaUtils.setEntityMeta(
              req.tenantId,
              'message',
              createdMessage.messageId,
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
      // Обработка quotedMessageId: находим цитируемое сообщение с мета-тегами
      let quotedMessage = null;
      if (quotedMessageId && typeof quotedMessageId === 'string' && quotedMessageId.trim()) {
        try {
          const quotedMsg = await Message.findOne({
            messageId: quotedMessageId.trim(),
            tenantId: req.tenantId
          }).lean();

          if (quotedMsg) {
            // Получаем мета-теги цитируемого сообщения
            const quotedMessageMeta = await metaUtils.getEntityMeta(
              req.tenantId,
              'message',
              quotedMsg.messageId
            );

            // Получаем информацию об отправителе цитируемого сообщения
            const quotedSenderInfo = await getSenderInfo(req.tenantId, quotedMsg.senderId);

            // Формируем объект quotedMessage с мета-тегами и senderInfo
            quotedMessage = {
              messageId: quotedMsg.messageId,
              dialogId: quotedMsg.dialogId,
              senderId: quotedMsg.senderId,
              content: quotedMsg.content,
              type: quotedMsg.type,
              createdAt: quotedMsg.createdAt,
              meta: quotedMessageMeta || {},
              senderInfo: quotedSenderInfo || null
            };

            // Сохраняем quotedMessage в созданное сообщение
            await Message.findOneAndUpdate(
              { messageId: createdMessage.messageId },
              { quotedMessage: quotedMessage }
            );
          } else {
            console.warn(`Quoted message ${quotedMessageId} not found`);
          }
        } catch (error) {
          console.error(`Error processing quotedMessageId ${quotedMessageId}:`, error);
          // Не прерываем создание сообщения, если не удалось найти цитируемое
        }
      }

      // Get message with meta data (включая quotedMessage, если оно было добавлено)
      const messageWithMeta = await Message.findOne({ messageId: createdMessage.messageId })
        .select('-__v')
        .populate('tenantId', 'name domain');

      // messageMeta уже загружено выше для события, используем его
      const messageObj = messageWithMeta.toObject();
      
      // dialogId теперь уже строка в формате dlg_, не нужно преобразовывать

      res.status(201).json({
        data: sanitizeResponse({
          ...messageObj,
          meta: messageMeta,
          topic: topic, // Добавляем topic в ответ
          senderInfo: senderInfo || null,
          quotedMessage: quotedMessage || null
        }),
        message: 'Message created successfully'
      });
    } catch (error) {
      // Откатываем транзакцию в случае ошибки
      if (useTransactions && session && session.inTransaction && session.inTransaction()) {
        await session.abortTransaction();
      }
      if (session) {
        await session.endSession();
      }

      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid dialog ID'
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
  },

  // Get message by ID
  async getMessageById(req, res) {
    try {
      const { messageId } = req.params;

      const message = await Message.findOne({
        messageId: messageId,
        tenantId: req.tenantId
      });

      if (!message) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
      }

      // Получаем метаданные сообщения
      const meta = await metaUtils.getEntityMeta(
        req.tenantId,
        'message',
        message.messageId
      );

      const messageObj = message.toObject();
      
      // Формируем матрицу статусов (исключая статусы отправителя сообщения)
      const statusMessageMatrix = await buildStatusMessageMatrix(req.tenantId, message.messageId, messageObj.senderId);
      
      // Формируем reactionSet (без currentUserId, так как это общий эндпоинт)
      const reactionSet = await buildReactionSet(req.tenantId, message.messageId, null);

      const senderInfo = await getSenderInfo(req.tenantId, message.senderId);
      
      // dialogId теперь уже строка в формате dlg_, не нужно преобразовывать

      res.json({
        data: sanitizeResponse({
          ...messageObj,
          statusMessageMatrix,
          reactionSet,
          meta,
          senderInfo: senderInfo || null
        })
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Update message content (only content can be changed)
  async updateMessageContent(req, res) {
    try {
      const { messageId } = req.params;
      const { content } = req.body;

      const message = await Message.findOne({
        messageId,
        tenantId: req.tenantId
      });

      if (!message) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
      }

      const newContent = typeof content === 'string' ? content : '';

      if (message.type === 'internal.text' && newContent.trim().length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'content is required for internal.text messages'
        });
      }

      const oldContent = message.content;
      if (oldContent === newContent) {
        // Ничего не меняем, но возвращаем текущее состояние
        const meta = await metaUtils.getEntityMeta(
          req.tenantId,
          'message',
          message.messageId
        );

        const messageObj = message.toObject();

        // Формируем матрицу статусов (исключая статусы отправителя сообщения)
        const statusMessageMatrix = await buildStatusMessageMatrix(req.tenantId, message.messageId, messageObj.senderId);
        
        // Формируем reactionSet (без currentUserId, так как это общий эндпоинт)
        const reactionSet = await buildReactionSet(req.tenantId, message.messageId, null);

        const senderInfo = await getSenderInfo(req.tenantId, message.senderId);

        return res.json({
          data: sanitizeResponse({
            ...messageObj,
            statusMessageMatrix,
            reactionSet,
            meta,
            senderInfo: senderInfo || null
          }),
          message: 'Message content is unchanged'
        });
      }

      message.content = newContent;
      await message.save();

      // Отмечаем сообщение как отредактированное через мета-тег editedAt
      await metaUtils.setEntityMeta(
        req.tenantId,
        'message',
        message.messageId,
        'editedAt',
        generateTimestamp(),
        'number',
        {
          createdBy: req.apiKey?.name || 'unknown'
        }
      );

      const meta = await metaUtils.getEntityMeta(
        req.tenantId,
        'message',
        message.messageId
      );

      // Получаем диалог и его метаданные для события
      const dialog = await Dialog.findOne({
        dialogId: message.dialogId,
        tenantId: req.tenantId
      }).lean();

      let dialogSection = null;
      if (dialog) {
        const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialog.dialogId);
        dialogSection = eventUtils.buildDialogSection({
          dialogId: dialog.dialogId,
          tenantId: dialog.tenantId,
          createdAt: dialog.createdAt,
          meta: dialogMeta || {}
        });
      }

      const MAX_CONTENT_LENGTH = 4096;
      const eventContent = newContent.length > MAX_CONTENT_LENGTH
        ? newContent.substring(0, MAX_CONTENT_LENGTH)
        : newContent;

      const messageSection = eventUtils.buildMessageSection({
        messageId: message.messageId,
        dialogId: message.dialogId,
        senderId: message.senderId,
        type: message.type,
        content: eventContent,
        meta
      });

      const eventContext = eventUtils.buildEventContext({
        eventType: 'message.update',
        dialogId: message.dialogId,
        entityId: message.messageId,
        messageId: message.messageId,
        includedSections: dialogSection ? ['dialog', 'message'] : ['message'],
        updatedFields: ['message.content']
      });

      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'message.update',
        entityType: 'message',
        entityId: message.messageId,
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api',
        data: eventUtils.composeEventData({
          context: eventContext,
          dialog: dialogSection,
          message: messageSection,
          extra: {
            delta: {
              content: {
                from: oldContent,
                to: newContent
              }
            }
          }
        })
      });

      const messageObj = message.toObject();

      // Формируем матрицу статусов (исключая статусы отправителя сообщения)
      const statusMessageMatrix = await buildStatusMessageMatrix(req.tenantId, message.messageId, messageObj.senderId);
      
      // Формируем reactionSet (без currentUserId, так как это общий эндпоинт)
      const reactionSet = await buildReactionSet(req.tenantId, message.messageId, null);

      const senderInfo = await getSenderInfo(req.tenantId, message.senderId);

      res.json({
        data: sanitizeResponse({
          ...messageObj,
          statusMessageMatrix,
          reactionSet,
          meta,
          senderInfo: senderInfo || null
        }),
        message: 'Message content updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get events for a message
};

export default messageController;
