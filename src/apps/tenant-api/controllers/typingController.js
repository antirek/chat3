import { Dialog, DialogMember, User } from '../../../models/index.js';
import * as eventUtils from '../utils/eventUtils.js';
import * as metaUtils from '../utils/metaUtils.js';
import { sanitizeResponse } from '../utils/responseUtils.js';

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

    const user = await User.findOne({
      userId,
      tenantId
    }).lean();

    const userMeta = await metaUtils.getEntityMeta(
      tenantId,
      'user',
      userId
    );

    const actorInfo = sanitizeResponse({
      ...user,
      meta: userMeta
    });

    // Получаем полные данные диалога и его метаданные для события
    const fullDialog = await Dialog.findOne({
      dialogId,
      tenantId
    }).lean();

    if (!fullDialog) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Dialog not found'
      });
    }

    const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);
    const dialogSection = eventUtils.buildDialogSection(fullDialog, dialogMeta || {});

    const typingSection = eventUtils.buildTypingSection({
      userId,
      expiresInMs: DEFAULT_TYPING_EXPIRES_MS,
      timestamp: Date.now(),
      userInfo: actorInfo
    });

    const typingContext = eventUtils.buildEventContext({
      eventType: 'dialog.typing',
      dialogId,
      entityId: dialogId,
      includedSections: ['dialog', 'typing'],
      updatedFields: ['typing']
    });

    await eventUtils.createEvent({
      tenantId,
      eventType: 'dialog.typing',
      entityType: 'dialog',
      entityId: dialogId,
      actorId: userId,
      actorType: 'user',
      data: eventUtils.composeEventData({
        context: typingContext,
        dialog: dialogSection,
        typing: typingSection
      })
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


