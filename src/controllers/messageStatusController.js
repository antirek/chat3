import { MessageStatus, Message } from '../models/index.js';
import * as eventUtils from '../utils/eventUtils.js';
import { sanitizeResponse } from '../utils/responseUtils.js';
import { generateTimestamp } from '../utils/timestampUtils.js';
import * as unreadCountUtils from '../utils/unreadCountUtils.js';

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
        updatedAt: generateTimestamp()
      };

      // Set timestamps based on status
      if (status === 'read') {
        updateData.readAt = generateTimestamp();
      } else if (status === 'delivered') {
        updateData.deliveredAt = generateTimestamp();
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
        entityId: `${messageId}_${userId}`, // Составной ID для messageStatus
        actorId: userId,
        actorType: 'user',
        data: {
          messageId,
          userId,
          senderId: message.senderId, // Добавляем отправителя сообщения для real-time
          oldStatus: oldStatus?.status || null,
          newStatus: status,
          dialogId: message.dialogId
        }
      });

      // Обновляем счетчик непрочитанных сообщений при чтении
      const updatedMember = await unreadCountUtils.updateCountersOnStatusChange(
        req.tenantId,
        messageId,
        userId,
        oldStatus?.status || null,
        status
      );

      // Если счетчик был обновлен, создаем событие dialog.member.update
      if (updatedMember) {
        await eventUtils.createEvent({
          tenantId: req.tenantId,
          eventType: 'dialog.member.update',
          entityType: 'dialogMember',
          entityId: `${userId}_${message.dialogId}`, // Составной ID для dialogMember
          actorId: userId,
          actorType: 'user',
          data: {
            userId,
            dialogId: message.dialogId,
            unreadCount: updatedMember.unreadCount,
            lastSeenAt: updatedMember.lastSeenAt,
            reason: 'message_read' // Указываем причину обновления
          }
        });
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

export default messageStatusController;
