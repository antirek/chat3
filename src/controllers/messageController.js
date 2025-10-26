import { Message, Dialog, Meta, MessageStatus } from '../models/index.js';
import * as metaUtils from '../utils/metaUtils.js';
import { parseFilters, extractMetaFilters } from '../utils/queryParser.js';

const messageController = {
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
      const messagesWithMeta = await Promise.all(
        messages.map(async (message) => {
          // Get message meta data
          const meta = await metaUtils.getEntityMeta(
            req.tenantId,
            'message',
            message._id
          );
          
          // Get message statuses sorted by date (newest first)
          const messageStatuses = await MessageStatus.find({
            messageId: message._id,
            tenantId: req.tenantId
          })
            .select('userId status readAt createdAt')
            .sort({ createdAt: -1 }); // Newest first
          
          const messageObj = message.toObject();
          
          return {
            ...messageObj,
            meta,
            messageStatuses
          };
        })
      );

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
      // Note: In a real app, you would get participants from DialogMember table
      // For now, we'll create status records for common users
      const commonUsers = ['carl', 'sara', 'john', 'marta', 'kirk'];
      
      for (const userId of commonUsers) {
        if (userId !== senderId) { // Don't create status for sender
          try {
            const { MessageStatus } = await import('../models/index.js');
            const { incrementUnreadCount } = await import('../utils/unreadCountUtils.js');
            
            // Create MessageStatus record
            await MessageStatus.create({
              messageId: message._id,
              userId: userId,
              tenantId: req.tenantId,
              status: 'unread'
            });
            
            // Update DialogMember counter
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

      // Get message with meta data
      const messageWithMeta = await Message.findById(message._id)
        .select('-__v')
        .populate('tenantId', 'name domain')
        .populate('dialogId', 'name');

      const messageMeta = await metaUtils.getEntityMeta(
        req.tenantId,
        'message',
        message._id
      );

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
          messageStatuses: messageStatuses,
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
