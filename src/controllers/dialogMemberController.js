import { DialogMember } from '../models/index.js';
import * as unreadCountUtils from '../utils/unreadCountUtils.js';
import * as eventUtils from '../utils/eventUtils.js';
import { sanitizeResponse } from '../utils/responseUtils.js';

const dialogMemberController = {
  // Add member to dialog
  async addDialogMember(req, res) {
    try {
      const { dialogId, userId } = req.params;

      // Найти Dialog по dialogId для получения ObjectId
      const { Dialog } = await import('../models/index.js');
      const dialog = await Dialog.findOne({ dialogId: dialogId, tenantId: req.tenantId });
      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      const member = await unreadCountUtils.addDialogMember(
        req.tenantId,
        userId,
        dialog.dialogId // Передаем строковый dialogId
      );

      // Создаем событие dialog.member.add
      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'dialog.member.add',
        entityType: 'dialogMember',
        entityId: dialogId + ':' + member.userId, // Составной ID для dialogMember (dialogId:userId)
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api',
        data: {
          userId,
          dialogId
        }
      });

      res.status(201).json({
        data: sanitizeResponse({
          userId,
          dialogId
        }),
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

      // Найти Dialog по dialogId для получения ObjectId
      const { Dialog } = await import('../models/index.js');
      const dialog = await Dialog.findOne({ dialogId: dialogId, tenantId: req.tenantId });
      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      // Получаем member перед удалением для события
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        userId,
        dialogId: dialog.dialogId // Используем строковый dialogId
      });

      await unreadCountUtils.removeDialogMember(
        req.tenantId,
        userId,
        dialog.dialogId // Передаем строковый dialogId
      );

      // Создаем событие dialog.member.remove
      if (member) {
        await eventUtils.createEvent({
          tenantId: req.tenantId,
          eventType: 'dialog.member.remove',
          entityType: 'dialogMember',
          entityId: dialogId + ':' + userId, // Составной ID для dialogMember (dialogId:userId)
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
          }
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
