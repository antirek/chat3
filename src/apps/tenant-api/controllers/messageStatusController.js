import { MessageStatus, Message, User } from '../../../models/index.js';
import * as eventUtils from '../utils/eventUtils.js';
import { sanitizeResponse } from '../utils/responseUtils.js';
import { generateTimestamp } from '../../../utils/timestampUtils.js';
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

      // Получаем тип пользователя
      const user = await User.findOne({
        tenantId: req.tenantId,
        userId: userId
      }).select('type').lean();
      
      const userType = user?.type || null;

      // Проверяем существующий статус
      const oldStatus = await MessageStatus.findOne({
        messageId: messageId,
        userId: userId,
        tenantId: req.tenantId
      });

      // Update or create message status
      const updateData = {
        status,
        updatedAt: generateTimestamp()
      };
      
      // Добавляем userType при создании нового статуса или обновляем, если он еще не установлен
      if (!oldStatus) {
        // Создаем новый статус - добавляем userType
        if (userType) {
          updateData.userType = userType;
        }
      } else if (!oldStatus.userType && userType) {
        // Обновляем существующий статус, если userType еще не был установлен
        updateData.userType = userType;
      }

      // Set timestamps based on status
      if (status === 'read') {
        updateData.readAt = generateTimestamp();
      } else if (status === 'delivered') {
        updateData.deliveredAt = generateTimestamp();
      }

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

      const dialogSection = eventUtils.buildDialogSection({
        dialogId: message.dialogId
      });

      const messageSection = eventUtils.buildMessageSection({
        messageId,
        dialogId: message.dialogId,
        senderId: message.senderId,
        type: message.type,
        content: message.content,
        statusUpdate: {
          userId,
          status,
          oldStatus: oldStatus?.status || null
        }
      });

      const memberSection = eventUtils.buildMemberSection({
        userId
      });

      const actorSection = eventUtils.buildActorSection({
        actorId: userId,
        actorType: 'user'
      });

      const statusContext = eventUtils.buildEventContext({
        eventType: 'message.status.update',
        dialogId: message.dialogId,
        entityId: messageId,
        messageId,
        includedSections: ['dialog', 'message.status', 'member', 'actor'],
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
          message: messageSection,
          member: memberSection,
          actor: actorSection
        })
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
        const dialogSection = eventUtils.buildDialogSection({
          dialogId: message.dialogId
        });

        const memberSection = eventUtils.buildMemberSection({
          userId,
          state: {
            unreadCount: updatedMember.unreadCount,
            lastSeenAt: updatedMember.lastSeenAt,
            lastMessageAt: updatedMember.lastMessageAt,
            isActive: updatedMember.isActive
          }
        });

        const actorSection = eventUtils.buildActorSection({
          actorId: userId,
          actorType: 'user'
        });

        const memberContext = eventUtils.buildEventContext({
          eventType: 'dialog.member.update',
          dialogId: message.dialogId,
          entityId: message.dialogId,
          includedSections: ['dialog', 'member', 'actor'],
          updatedFields: ['member.state.unreadCount', 'member.state.lastSeenAt']
        });

        await eventUtils.createEvent({
          tenantId: req.tenantId,
          eventType: 'dialog.member.update',
          entityType: 'dialogMember',
          entityId: message.dialogId,
          actorId: userId,
          actorType: 'user',
          data: eventUtils.composeEventData({
            context: memberContext,
            dialog: dialogSection,
            member: memberSection,
            actor: actorSection
          })
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
