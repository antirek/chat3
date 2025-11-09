import { Dialog, DialogMember } from '../models/index.js';
import * as eventUtils from '../utils/eventUtils.js';

const DEFAULT_TYPING_EXPIRES_MS = 5000;

export async function sendTyping(req, res) {
  try {
    const { dialogId, userId } = req.params;
    const tenantId = req.tenantId;

    const dialog = await Dialog.findOne({
      dialogId,
      tenantId
    }).select('dialogId').lean();

    if (!dialog) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Dialog not found'
      });
    }

    const member = await DialogMember.findOne({
      dialogId,
      tenantId,
      userId,
      isActive: true
    }).select('userId').lean();

    if (!member) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User is not an active member of this dialog'
      });
    }

    await eventUtils.createEvent({
      tenantId,
      eventType: 'dialog.typing',
      entityType: 'dialog',
      entityId: dialogId,
      actorId: userId,
      actorType: 'user',
      data: {
        dialogId,
        userId,
        expiresInMs: DEFAULT_TYPING_EXPIRES_MS,
        timestamp: Date.now()
      }
    });

    return res.status(202).json({
      message: 'Typing signal accepted',
      data: {
        dialogId,
        userId,
        expiresInMs: DEFAULT_TYPING_EXPIRES_MS
      }
    });
  } catch (error) {
    console.error('Error in sendTyping:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

export default {
  sendTyping
};


