import { Dialog, Message, MessageStatus, User } from '@chat3/models';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import * as topicUtils from '@chat3/utils/topicUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';

export interface SetMessageStatusInput {
  tenantId: string;
  userId: string;
  dialogId: string;
  messageId: string;
  status: string;
}

export interface SetMessageStatusResult {
  status: any;
}

export async function setMessageStatus(
  input: SetMessageStatusInput
): Promise<SetMessageStatusResult> {
  const { tenantId, dialogId, messageId, status } = input;
  const userId = (input.userId || '').trim();
  const normalizedUserId = userId.toLowerCase();

  if (!tenantId || !userId || !dialogId || !messageId || !status) {
    throw new AppServiceError('VALIDATION', 'tenantId, userId, dialogId, messageId and status are required');
  }

  const message = await Message.findOne({ messageId, dialogId, tenantId });
  if (!message) {
    throw new AppServiceError('NOT_FOUND', 'Message not found');
  }

  const user = await User.findOne({ tenantId, userId }).select('type').lean();
  const userType = user?.type || null;

  const lastStatus = await MessageStatus.findOne({
    messageId,
    userId,
    tenantId
  })
    .sort({ createdAt: -1 })
    .lean();

  const oldStatus = lastStatus?.status || null;

  const dialog = await Dialog.findOne({ dialogId, tenantId }).lean();
  if (!dialog) {
    throw new AppServiceError('NOT_FOUND', 'Dialog not found');
  }

  const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialog.dialogId);
  const dialogSection = eventUtils.buildDialogSection({
    dialogId: dialog.dialogId,
    tenantId: dialog.tenantId,
    createdAt: dialog.createdAt,
    meta: dialogMeta || {}
  });

  const messageMeta = await metaUtils.getEntityMeta(tenantId, 'message', messageId);

  let topicForEvent: any = null;
  const messageTopicId = (message as any).topicId;
  if (messageTopicId) {
    try {
      topicForEvent = await topicUtils.getTopicWithMeta(tenantId, dialogId, messageTopicId);
    } catch (error) {
      console.error('Error getting topic with meta for event:', error);
      topicForEvent = { topicId: messageTopicId, meta: {} };
    }
  }

  const messageSection = eventUtils.buildMessageSection({
    messageId,
    dialogId,
    senderId: message.senderId,
    type: message.type,
    content: message.content,
    meta: messageMeta || {},
    topicId: messageTopicId || null,
    topic: topicForEvent,
    statusUpdate: {
      userId,
      status,
      oldStatus
    }
  });

  try {
    const messageStatus = await MessageStatus.create([
      {
        messageId,
        userId: normalizedUserId,
        tenantId,
        dialogId,
        status,
        userType,
        createdAt: generateTimestamp()
      }
    ]);
    const createdStatus = messageStatus[0];

    const statusContext = eventUtils.buildEventContext({
      eventType: 'message.status.changed',
      dialogId,
      entityId: messageId,
      messageId,
      includedSections: ['dialog', 'message'],
      updatedFields: ['message.status']
    });

    await eventUtils.createEvent({
      tenantId,
      eventType: 'message.status.changed',
      entityType: 'messageStatus',
      entityId: messageId,
      actorId: userId,
      actorType: 'user',
      data: eventUtils.composeEventData({
        context: statusContext,
        dialog: dialogSection,
        message: messageSection
      })
    });

    return { status: sanitizeResponse(createdStatus) };
  } catch (error: any) {
    if (error?.name === 'CastError') {
      throw new AppServiceError('VALIDATION', 'Invalid message ID');
    }
    if (error?.name === 'ValidationError') {
      throw new AppServiceError('VALIDATION', error.message);
    }
    throw error;
  }
}
