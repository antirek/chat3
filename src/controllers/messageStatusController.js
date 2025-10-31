import { MessageStatus, Message, Dialog } from '../models/index.js';
import * as eventUtils from '../utils/eventUtils.js';

const messageStatusController = {
  // Get message status for a specific message
  async getMessageStatus(req, res) {
    try {
      const { messageId } = req.params;

      // Check if message exists and belongs to tenant
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

      // Get all statuses for this message
      const statuses = await MessageStatus.find({
        messageId: messageId,
        tenantId: req.tenantId
      }).select('-__v');

      res.json({
        data: statuses,
        message: 'Message statuses retrieved successfully'
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid message ID'
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Update message status (mark as read/delivered)
  async updateMessageStatus(req, res) {
    try {
      const { messageId } = req.params;
      const { userId, status } = req.body;

      // Basic validation
      if (!userId || !status) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required fields: userId, status'
        });
      }

      if (!['unread', 'delivered', 'read'].includes(status)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid status. Must be one of: unread, delivered, read'
        });
      }

      // Check if message exists and belongs to tenant
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

      // Update or create message status
      const updateData = {
        status,
        updatedAt: new Date()
      };

      // Set timestamps based on status
      if (status === 'read') {
        updateData.readAt = new Date();
      } else if (status === 'delivered') {
        updateData.deliveredAt = new Date();
      }

      const oldStatus = await MessageStatus.findOne({
        messageId: messageId,
        userId: userId,
        tenantId: req.tenantId
      });

      const messageStatus = await MessageStatus.findOneAndUpdate(
        {
          messageId: messageId,
          userId: userId,
          tenantId: req.tenantId
        },
        updateData,
        { 
          new: true, 
          upsert: true, 
          runValidators: true 
        }
      ).select('-__v');

      // Создаем событие message.status.update
      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: oldStatus ? 'message.status.update' : 'message.status.create',
        entityType: 'messageStatus',
        entityId: messageStatus._id,
        actorId: userId,
        actorType: 'user',
        data: {
          messageId,
          userId,
          oldStatus: oldStatus?.status || null,
          newStatus: status,
          dialogId: message.dialogId
        },
        metadata: eventUtils.extractMetadataFromRequest(req)
      });

      res.json({
        data: messageStatus,
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
  },

  // Get unread messages for a user
  async getUnreadMessages(req, res) {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Get unread message statuses for user
      const unreadStatuses = await MessageStatus.find({
        userId: userId,
        tenantId: req.tenantId,
        status: 'unread'
      })
        .populate('messageId', 'content senderId type createdAt')
        .populate('tenantId', 'name domain')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .select('-__v');

      const total = await MessageStatus.countDocuments({
        userId: userId,
        tenantId: req.tenantId,
        status: 'unread'
      });

      res.json({
        data: unreadStatuses,
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

  // Get unread messages for a dialog
  async getDialogUnreadMessages(req, res) {
    try {
      const { dialogId } = req.params;
      const { userId } = req.query;
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

      // Build query
      let query = {
        tenantId: req.tenantId,
        status: 'unread'
      };

      // Filter by user if provided
      if (userId) {
        query.userId = userId;
      }

      // Get messages for this dialog
      const messages = await Message.find({
        dialogId: dialogId,
        tenantId: req.tenantId
      }).select('_id');

      const messageIds = messages.map(msg => msg._id);

      // Get unread statuses for messages in this dialog
      const unreadStatuses = await MessageStatus.find({
        ...query,
        messageId: { $in: messageIds }
      })
        .populate('messageId', 'content senderId type createdAt dialogId')
        .populate('tenantId', 'name domain')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .select('-__v');

      const total = await MessageStatus.countDocuments({
        ...query,
        messageId: { $in: messageIds }
      });

      res.json({
        data: unreadStatuses,
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
  }
};

export default messageStatusController;
