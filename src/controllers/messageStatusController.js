import { MessageStatus, Message } from '../models/index.js';
import * as eventUtils from '../utils/eventUtils.js';

const messageStatusController = {
  // Update message status (mark as read/delivered)
  async updateMessageStatus(req, res) {
    try {
      const { messageId, userId, status } = req.params;

      // Basic validation
      if (!['unread', 'delivered', 'read'].includes(status)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid status. Must be one of: unread, delivered, read'
        });
      }

      // Check if message exists and belongs to tenant
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
  }
};

export default messageStatusController;
