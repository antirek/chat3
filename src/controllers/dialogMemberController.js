import { DialogMember } from '../models/index.js';
import * as unreadCountUtils from '../utils/unreadCountUtils.js';
import * as eventUtils from '../utils/eventUtils.js';

const dialogMemberController = {
  // Get unread count for a user in a specific dialog
  async getUserDialogUnreadCount(req, res) {
    try {
      const { userId, dialogId } = req.params;

      const unreadCount = await unreadCountUtils.getUnreadCount(
        req.tenantId,
        userId,
        dialogId
      );

      res.json({
        data: {
          userId,
          dialogId,
          unreadCount
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Add member to dialog
  async addDialogMember(req, res) {
    try {
      const { dialogId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required field: userId'
        });
      }

      const member = await unreadCountUtils.addDialogMember(
        req.tenantId,
        userId,
        dialogId
      );

      // Создаем событие dialog.member.add
      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'dialog.member.add',
        entityType: 'dialogMember',
        entityId: member._id,
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api',
        data: {
          userId,
          dialogId
        },
        metadata: eventUtils.extractMetadataFromRequest(req)
      });

      res.status(201).json({
        data: {
          userId,
          dialogId
        },
        message: 'Member added to dialog successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Remove member from dialog
  async removeDialogMember(req, res) {
    try {
      const { dialogId, userId } = req.params;

      // Получаем member перед удалением для события
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        userId,
        dialogId
      });

      await unreadCountUtils.removeDialogMember(
        req.tenantId,
        userId,
        dialogId
      );

      // Создаем событие dialog.member.remove
      if (member) {
        await eventUtils.createEvent({
          tenantId: req.tenantId,
          eventType: 'dialog.member.remove',
          entityType: 'dialogMember',
          entityId: member._id,
          actorId: req.apiKey?.name || 'unknown',
          actorType: 'api',
          data: {
            userId,
            dialogId,
            removedMember: {
              userId: member.userId,
              joinedAt: member.joinedAt,
              lastSeenAt: member.lastSeenAt,
              unreadCount: member.unreadCount
            }
          },
          metadata: eventUtils.extractMetadataFromRequest(req)
        });
      }

      res.json({
        message: 'Member removed from dialog successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

export default dialogMemberController;
