import { Message, Dialog, Meta, MessageStatus } from '../models/index.js';
import * as metaUtils from '../utils/metaUtils.js';
import * as eventUtils from '../utils/eventUtils.js';
import { parseFilters, extractMetaFilters } from '../utils/queryParser.js';

/**
 * Helper function to enrich messages with meta data and statuses
 * @param {Array} messages - Array of message documents
 * @param {String} tenantId - Tenant ID
 * @returns {Promise<Array>} - Array of enriched messages with meta and statuses
 */
async function enrichMessagesWithMetaAndStatuses(messages, tenantId) {
  return await Promise.all(
    messages.map(async (message) => {
      // Get message meta data
      const meta = await metaUtils.getEntityMeta(
        tenantId,
        'message',
        message._id
      );
      
      // Get message statuses sorted by date (newest first)
      const messageStatuses = await MessageStatus.find({
        messageId: message._id,
        tenantId: tenantId
      })
        .select('userId status readAt createdAt')
        .sort({ createdAt: -1 }); // Newest first
      
      const messageObj = message.toObject();
      
      return {
        ...messageObj,
        meta,
        statuses: messageStatuses
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
        .select('dialogId senderId content type createdAt updatedAt')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      console.log('Found messages:', messages.length);

      // Дополнительная проверка: проверим мета-теги найденных сообщений
      if (Object.keys(metaFilters).length > 0) {
        console.log('Verifying meta filters for found messages...');
        for (const message of messages) {
          const messageMeta = await metaUtils.getEntityMeta(req.tenantId, 'message', message._id);
          console.log(`Message ${message._id} meta:`, messageMeta);
          
          // Проверяем каждый мета-фильтр
          for (const [key, expectedValue] of Object.entries(metaFilters)) {
            const actualValue = messageMeta[key];
            if (actualValue !== expectedValue) {
              console.error(`❌ META FILTER MISMATCH for message ${message._id}:`);
              console.error(`   Expected ${key}=${expectedValue}, got ${key}=${actualValue}`);
            } else {
              console.log(`✅ Meta filter OK for message ${message._id}: ${key}=${actualValue}`);
            }
          }
        }
      }

      // Add meta data and message statuses for each message
      const messagesWithMeta = await enrichMessagesWithMetaAndStatuses(messages, req.tenantId);

      const total = await Message.countDocuments(query);

      res.json({
        data: messagesWithMeta,
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
        _id: dialogId,
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
        dialogId: dialogId
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
        .populate('dialogId', 'name')
        .sort(sortOptions);

      // Add meta data and message statuses for each message
      const messagesWithMeta = await enrichMessagesWithMetaAndStatuses(messages, req.tenantId);

      const total = await Message.countDocuments(query);

      res.json({
        data: messagesWithMeta,
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
      const { content, senderId, type = 'text', meta } = req.body;

      // Basic validation
      if (!content || !senderId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required fields: content, senderId'
        });
      }

      // Check if dialog exists and belongs to tenant
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

      // Create message
      const message = await Message.create({
        tenantId: req.tenantId,
        dialogId: dialogId,
        content,
        senderId,
        type
      });

      // Create MessageStatus records and update DialogMember counters for all dialog participants
      // Получаем реальных участников диалога из DialogMember
      const { DialogMember } = await import('../models/index.js');
      const { incrementUnreadCount } = await import('../utils/unreadCountUtils.js');
      
      const dialogMembers = await DialogMember.find({
        tenantId: req.tenantId,
        dialogId: dialogId,
        isActive: true
      }).select('userId').lean();
      
      for (const member of dialogMembers) {
        const userId = member.userId;
        if (userId !== senderId) { // Don't create status for sender
          try {
            const { MessageStatus } = await import('../models/index.js');
            
            // Create MessageStatus record
            await MessageStatus.create({
              messageId: message._id,
              userId: userId,
              tenantId: req.tenantId,
              status: 'unread'
            });
            
            // Update DialogMember counter (только для существующих участников)
            await incrementUnreadCount(req.tenantId, userId, dialogId, message._id);
          } catch (error) {
            console.error(`Error creating MessageStatus for user ${userId}:`, error);
          }
        }
      }

      // Add meta data if provided
      if (meta && typeof meta === 'object') {
        for (const [key, value] of Object.entries(meta)) {
          if (typeof value === 'object' && value !== null) {
            // If value is an object with dataType and value properties
            await metaUtils.setEntityMeta(
              req.tenantId,
              'message',
              message._id,
              key,
              value.value,
              value.dataType || 'string'
            );
          } else {
            // If value is a simple value
            await metaUtils.setEntityMeta(
              req.tenantId,
              'message',
              message._id,
              key,
              value,
              typeof value === 'number' ? 'number' : 
              typeof value === 'boolean' ? 'boolean' :
              Array.isArray(value) ? 'array' : 'string'
            );
          }
        }
      }

      // Получаем мета-теги сообщения для события
      const messageMeta = await metaUtils.getEntityMeta(
        req.tenantId,
        'message',
        message._id
      );

      // Ограничиваем контент до 4096 символов для события
      const MAX_CONTENT_LENGTH = 4096;
      const eventContent = content.length > MAX_CONTENT_LENGTH 
        ? content.substring(0, MAX_CONTENT_LENGTH) 
        : content;

      // Создаем событие message.create (после сохранения мета-тегов)
      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'message.create',
        entityType: 'message',
        entityId: message._id,
        actorId: senderId,
        actorType: 'user',
        data: {
          dialogId: dialogId,
          dialogName: dialog.name,
          messageType: type,
          content: eventContent, // Контент сообщения (до 4096 символов)
          meta: messageMeta // Добавляем мета-теги сообщения
        },
        metadata: eventUtils.extractMetadataFromRequest(req)
      });

      // Get message with meta data
      const messageWithMeta = await Message.findById(message._id)
        .select('-__v')
        .populate('tenantId', 'name domain')
        .populate('dialogId', 'name');

      // messageMeta уже загружено выше для события, используем его
      const messageObj = messageWithMeta.toObject();

      res.status(201).json({
        data: {
          ...messageObj,
          meta: messageMeta
        },
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
        _id: messageId,
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
        messageId: message._id,
        tenantId: req.tenantId
      })
        .select('userId status readAt createdAt')
        .sort({ createdAt: -1 }); // Newest first

      // Получаем метаданные сообщения
      const meta = await metaUtils.getEntityMeta(
        req.tenantId,
        'message',
        message._id
      );

      const messageObj = message.toObject();

      res.json({
        data: {
          ...messageObj,
          statuses: messageStatuses,
          meta
        }
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
