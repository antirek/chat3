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

  // Sync unread count for a user in a specific dialog
  async syncUserDialogUnreadCount(req, res) {
    try {
      const { userId, dialogId } = req.params;

      const realCount = await unreadCountUtils.syncUnreadCount(
        req.tenantId,
        userId,
        dialogId
      );

      res.json({
        data: {
          userId,
          dialogId,
          unreadCount: realCount
        },
        message: 'Unread count synced successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Reset unread count for a user in a specific dialog
  async resetUserDialogUnreadCount(req, res) {
    try {
      const { userId, dialogId } = req.params;

      await unreadCountUtils.resetUnreadCount(
        req.tenantId,
        userId,
        dialogId
      );

      res.json({
        data: {
          userId,
          dialogId,
          unreadCount: 0
        },
        message: 'Unread count reset successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Update last seen time for a user in a dialog
  async updateLastSeen(req, res) {
    try {
      const { userId, dialogId } = req.params;

      await unreadCountUtils.updateLastSeen(
        req.tenantId,
        userId,
        dialogId
      );

      res.json({
        data: {
          userId,
          dialogId,
          lastSeenAt: new Date()
        },
        message: 'Last seen updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get dialog members
  async getDialogMembers(req, res) {
    try {
      const { dialogId } = req.params;

      const members = await unreadCountUtils.getDialogMembers(
        req.tenantId,
        dialogId
      );

      res.json({
        data: members
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
  },

  // Get all dialog members for a tenant
  async getAllDialogMembers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const members = await DialogMember.find({
        tenantId: req.tenantId
      })
        .populate('dialogId', 'name')
        .populate('tenantId', 'name domain')
        .skip(skip)
        .limit(limit)
        .sort({ lastSeenAt: -1 })
        .select('-__v');

      const total = await DialogMember.countDocuments({
        tenantId: req.tenantId
      });

      res.json({
        data: members,
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
  }
};

export default dialogMemberController;
