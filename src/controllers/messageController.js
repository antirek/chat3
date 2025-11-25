import { Message, Dialog, MessageStatus, User, Event, Update } from '../models/index.js';
import * as metaUtils from '../utils/metaUtils.js';
import * as eventUtils from '../utils/eventUtils.js';
import { parseFilters, extractMetaFilters } from '../utils/queryParser.js';
import { sanitizeResponse } from '../utils/responseUtils.js';
import { generateTimestamp } from '../utils/timestampUtils.js';

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
    .select('userId name lastActiveAt createdAt updatedAt')
    .lean();

  if (!user) {
    cache.set(senderId, null);
    return null;
  }

  const userMeta = await metaUtils.getEntityMeta(tenantId, 'user', senderId);

  const senderInfo = {
    userId: user.userId,
    name: user.name || null,
    lastActiveAt: user.lastActiveAt ?? null,
    createdAt: user.createdAt ?? null,
    updatedAt: user.updatedAt ?? null,
    meta: userMeta
  };

  cache.set(senderId, senderInfo);
  return senderInfo;
}

async function enrichMessagesWithMetaAndStatuses(messages, tenantId) {
  const senderInfoCache = new Map();

  return await Promise.all(
    messages.map(async (message) => {
      // Get message meta data
      const meta = await metaUtils.getEntityMeta(
        tenantId,
        'message',
        message.messageId
      );
      
      // Get message statuses sorted by date (newest first)
      const messageStatuses = await MessageStatus.find({
        messageId: message.messageId,
        tenantId: tenantId
      })
        .select('userId status readAt createdAt')
        .sort({ createdAt: -1 })
        .lean(); // Используем .lean() для получения объектов вместо Mongoose документов
      
      const messageObj = message.toObject ? message.toObject() : message;
      
      const senderInfo = await getSenderInfo(tenantId, messageObj.senderId, senderInfoCache);

      // dialogId теперь уже строка в формате dlg_, не нужно преобразовывать
      return {
        ...messageObj,
        meta,
        statuses: messageStatuses,
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
        .select('messageId dialogId senderId content type createdAt updatedAt')
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
          
          // Apply meta filters if any
          if (Object.keys(metaFilters).length > 0) {
            const metaQuery = await metaUtils.buildMetaQuery(req.tenantId, 'message', metaFilters);
            if (metaQuery) {
              query = { ...query, ...metaQuery };
            }
          }
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
          } else if (field === 'updatedAt') {
            sortOptions = { updatedAt: direction === 'asc' ? 1 : -1 };
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
    try {
      const { dialogId } = req.params;
      const { content, senderId, type = 'internal.text', meta, quotedMessageId } = req.body;
      const normalizedType = type;
      const messageContent = typeof content === 'string' ? content : '';
      const metaPayload = meta && typeof meta === 'object' ? { ...meta } : {};
      const isSystemMessage = normalizedType.startsWith('system.');
      const MEDIA_MESSAGE_TYPES = new Set(['internal.image', 'internal.file', 'internal.audio', 'internal.video']);

      if (!senderId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required field: senderId'
        });
      }

      if (normalizedType === 'internal.text' && messageContent.trim().length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'content is required for internal.text messages'
        });
      }

      if (MEDIA_MESSAGE_TYPES.has(normalizedType)) {
        const mediaUrl = typeof metaPayload.url === 'string' ? metaPayload.url.trim() : '';
        if (!mediaUrl) {
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
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      // Create message
      const message = await Message.create({
        tenantId: req.tenantId,
        dialogId: dialog.dialogId, // Используем строковый dialogId
        content: messageContent || '',
        senderId,
        type: normalizedType
      });

      // Create MessageStatus records and update DialogMember counters for all dialog participants
      if (!isSystemMessage) {
        // Получаем реальных участников диалога из DialogMember
        const { DialogMember } = await import('../models/index.js');
        const { incrementUnreadCount } = await import('../utils/unreadCountUtils.js');
        
        const dialogMembers = await DialogMember.find({
          tenantId: req.tenantId,
          dialogId: dialog.dialogId, // Используем строковый dialogId
          isActive: true
        }).select('userId').lean();
        
        for (const member of dialogMembers) {
          const userId = member.userId;
          if (userId !== senderId) { // Don't create status for sender
            try {
              const { MessageStatus } = await import('../models/index.js');
              
              // Create MessageStatus record
              await MessageStatus.create({
                messageId: message.messageId,
                userId: userId,
                tenantId: req.tenantId,
                status: 'unread'
              });
              
              // Update DialogMember counter (только для существующих участников)
              await incrementUnreadCount(req.tenantId, userId, dialog.dialogId, message.messageId);
            } catch (error) {
              console.error(`Error creating MessageStatus for user ${userId}:`, error);
            }
          }
        }
      }

      // Add meta data if provided
      if (metaPayload && typeof metaPayload === 'object') {
        for (const [key, value] of Object.entries(metaPayload)) {
          const metaOptions = {
            createdBy: senderId,
            scope: typeof value === 'object' && value !== null ? value.scope : undefined
          };

          if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'value')) {
            // If value is an object with dataType/value/scope properties
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

      const dialogMeta = await metaUtils.getEntityMeta(
        req.tenantId,
        'dialog',
        dialog.dialogId
      );

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
              updatedAt: quotedMsg.updatedAt,
              meta: quotedMessageMeta || {},
              senderInfo: quotedSenderInfo || null
            };

            // Сохраняем quotedMessage в созданное сообщение
            await Message.findOneAndUpdate(
              { messageId: message.messageId },
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

      // Получаем мета-теги сообщения для события
      const messageMeta = await metaUtils.getEntityMeta(
        req.tenantId,
        'message',
        message.messageId
      );

      const senderInfo = await getSenderInfo(req.tenantId, senderId);

      // Ограничиваем контент до 4096 символов для события
      const MAX_CONTENT_LENGTH = 4096;
      const eventContent = messageContent.length > MAX_CONTENT_LENGTH 
        ? messageContent.substring(0, MAX_CONTENT_LENGTH) 
        : messageContent;

      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        name: dialog.name,
        createdBy: dialog.createdBy,
        createdAt: dialog.createdAt,
        updatedAt: dialog.updatedAt,
        meta: dialogMeta
      });

      const messageSection = eventUtils.buildMessageSection({
        messageId: message.messageId,
        dialogId: dialog.dialogId,
        senderId,
        type,
        content: eventContent,
        meta: messageMeta,
        quotedMessage
      });

      const actorSection = eventUtils.buildActorSection({
        actorId: senderId,
        actorType: 'user',
        info: senderInfo || null
      });

      const eventContext = eventUtils.buildEventContext({
        eventType: 'message.create',
        dialogId: dialog.dialogId,
        entityId: message.messageId,
        messageId: message.messageId,
        includedSections: ['dialog', 'message.full', 'actor'],
        updatedFields: ['message']
      });

      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'message.create',
        entityType: 'message',
        entityId: message.messageId,
        actorId: senderId,
        actorType: 'user',
        data: eventUtils.composeEventData({
          context: eventContext,
          dialog: dialogSection,
          message: messageSection,
          actor: actorSection
        })
      });

      // Get message with meta data (включая quotedMessage, если оно было добавлено)
      const messageWithMeta = await Message.findOne({ messageId: message.messageId })
        .select('-__v')
        .populate('tenantId', 'name domain');

      // messageMeta уже загружено выше для события, используем его
      const messageObj = messageWithMeta.toObject();
      
      // dialogId теперь уже строка в формате dlg_, не нужно преобразовывать

      res.status(201).json({
        data: sanitizeResponse({
          ...messageObj,
          meta: messageMeta,
          senderInfo: senderInfo || null,
          quotedMessage: quotedMessage || null
        }),
        message: 'Message created successfully'
      });
    } catch (error) {
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

      // Получаем статусы сообщения (свежие в начале)
      const messageStatuses = await MessageStatus.find({
        messageId: message.messageId,
        tenantId: req.tenantId
      })
        .select('userId status readAt createdAt')
        .sort({ createdAt: -1 })
        .lean(); // Используем .lean() для получения объектов вместо Mongoose документов

      // Получаем метаданные сообщения
      const meta = await metaUtils.getEntityMeta(
        req.tenantId,
        'message',
        message.messageId
      );

      const senderInfo = await getSenderInfo(req.tenantId, message.senderId);

      const messageObj = message.toObject();
      
      // dialogId теперь уже строка в формате dlg_, не нужно преобразовывать

      res.json({
        data: sanitizeResponse({
          ...messageObj,
          statuses: messageStatuses,
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

        const messageStatuses = await MessageStatus.find({
          messageId: message.messageId,
          tenantId: req.tenantId
        })
          .select('userId status readAt createdAt')
          .sort({ createdAt: -1 })
          .lean();

        const senderInfo = await getSenderInfo(req.tenantId, message.senderId);

        const messageObj = message.toObject();

        return res.json({
          data: sanitizeResponse({
            ...messageObj,
            statuses: messageStatuses,
            meta,
            senderInfo: senderInfo || null
          }),
          message: 'Message content is unchanged'
        });
      }

      message.content = newContent;
      message.updatedAt = generateTimestamp();
      await message.save();

      // Отмечаем сообщение как обновлённое через мета-тег
      await metaUtils.setEntityMeta(
        req.tenantId,
        'message',
        message.messageId,
        'updated',
        true,
        'boolean',
        {
          createdBy: req.apiKey?.name || 'unknown'
        }
      );

      const meta = await metaUtils.getEntityMeta(
        req.tenantId,
        'message',
        message.messageId
      );

      const messageStatuses = await MessageStatus.find({
        messageId: message.messageId,
        tenantId: req.tenantId
      })
        .select('userId status readAt createdAt')
        .sort({ createdAt: -1 })
        .lean();

      const senderInfo = await getSenderInfo(req.tenantId, message.senderId);

      const dialogSection = eventUtils.buildDialogSection({
        dialogId: message.dialogId
      });

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

      const actorSection = eventUtils.buildActorSection({
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api'
      });

      const eventContext = eventUtils.buildEventContext({
        eventType: 'message.update',
        dialogId: message.dialogId,
        entityId: message.messageId,
        messageId: message.messageId,
        includedSections: ['dialog', 'message', 'actor'],
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
          actor: actorSection,
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

      res.json({
        data: sanitizeResponse({
          ...messageObj,
          statuses: messageStatuses,
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
  async getMessageEvents(req, res) {
    try {
      const { messageId } = req.params;
      const tenantId = req.tenantId;
      const limit = parseInt(req.query.limit) || 100;

      // Получаем все события, связанные с этим сообщением
      // События могут иметь разные entityType: 'message', 'messageReaction', 'messageStatus'
      // но все они имеют entityId = messageId
      const events = await Event.find({
        tenantId,
        entityId: messageId,
        entityType: { $in: ['message', 'messageReaction', 'messageStatus'] }
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      // Для каждого события получаем количество обновлений
      const eventsWithUpdates = await Promise.all(
        events.map(async (event) => {
          try {
            const updatesCount = await Update.countDocuments({
              tenantId,
              eventId: event._id
            });
            return {
              ...event,
              updatesCount
            };
          } catch (err) {
            return {
              ...event,
              updatesCount: 0
            };
          }
        })
      );

      res.json({
        data: eventsWithUpdates
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

export default messageController;
