import { DialogMember, Dialog, Message } from '../models/index.js';

const userDialogController = {
  // Get user's dialogs with pagination and sorting by last interaction
  async getUserDialogs(req, res) {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Get user's dialog memberships
      const dialogMembers = await DialogMember.find({
        userId: userId,
        tenantId: req.tenantId,
        isActive: true
      })
        .populate('dialogId', 'name createdAt updatedAt')
        .sort({ lastSeenAt: -1 }) // Sort by last seen (most recent first)
        .skip(skip)
        .limit(limit)
        .lean();

      // Get total count for pagination
      const total = await DialogMember.countDocuments({
        userId: userId,
        tenantId: req.tenantId,
        isActive: true
      });

      // Format response data
      const dialogs = dialogMembers.map(member => ({
        dialogId: member.dialogId._id,
        dialogName: member.dialogId.name,
        unreadCount: member.unreadCount,
        lastSeenAt: member.lastSeenAt,
        lastMessageAt: member.lastMessageAt,
        isActive: member.isActive,
        joinedAt: member.createdAt,
        // Calculate last interaction time (most recent of lastSeenAt or lastMessageAt)
        lastInteractionAt: new Date(Math.max(
          new Date(member.lastSeenAt || 0).getTime(),
          new Date(member.lastMessageAt || 0).getTime()
        ))
      }));

      // Sort by last interaction time (most recent first)
      dialogs.sort((a, b) => new Date(b.lastInteractionAt) - new Date(a.lastInteractionAt));

      res.json({
        data: dialogs,
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

  // Get user's dialogs with detailed information including last message
  async getUserDialogsDetailed(req, res) {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Get user's dialog memberships
      const dialogMembers = await DialogMember.find({
        userId: userId,
        tenantId: req.tenantId,
        isActive: true
      })
        .populate('dialogId', 'name createdAt updatedAt')
        .sort({ lastSeenAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Get total count for pagination
      const total = await DialogMember.countDocuments({
        userId: userId,
        tenantId: req.tenantId,
        isActive: true
      });

      // Get last message for each dialog
      const dialogsWithLastMessage = await Promise.all(
        dialogMembers.map(async (member) => {
          const lastMessage = await Message.findOne({
            dialogId: member.dialogId._id,
            tenantId: req.tenantId
          })
            .sort({ createdAt: -1 })
            .select('content senderId type createdAt')
            .lean();

          return {
            dialogId: member.dialogId._id,
            dialogName: member.dialogId.name,
            unreadCount: member.unreadCount,
            lastSeenAt: member.lastSeenAt,
            lastMessageAt: member.lastMessageAt,
            isActive: member.isActive,
            joinedAt: member.createdAt,
            lastInteractionAt: new Date(Math.max(
              new Date(member.lastSeenAt || 0).getTime(),
              new Date(member.lastMessageAt || 0).getTime()
            )),
            lastMessage: lastMessage ? {
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              type: lastMessage.type,
              createdAt: lastMessage.createdAt
            } : null
          };
        })
      );

      // Sort by last interaction time (most recent first)
      dialogsWithLastMessage.sort((a, b) => new Date(b.lastInteractionAt) - new Date(a.lastInteractionAt));

      res.json({
        data: dialogsWithLastMessage,
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

export default userDialogController;
