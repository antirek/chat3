import { Dialog, DialogMember, Message, MessageStatus, User } from '@chat3/models';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import * as topicUtils from '@chat3/utils/topicUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { getSenderInfo } from '@chat3/utils/userDialogUtils.js';
import { updateLastMessageAt } from '@chat3/utils/dialogMemberActivityUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';

const MEDIA_MESSAGE_TYPES = new Set([
  'internal.image',
  'internal.file',
  'internal.audio',
  'internal.video',
  'internal.sticker'
]);

export interface SendMessageInput {
  tenantId: string;
  dialogId: string;
  userId: string;
  content?: string;
  type?: string;
  meta?: Record<string, any>;
  quotedMessageId?: string | null;
  topicId?: string | null;
}

export interface SendMessageResult {
  message: any;
}

async function setMessageMetaEntries(
  tenantId: string,
  messageId: string,
  senderId: string,
  metaPayload: Record<string, any>
): Promise<void> {
  for (const [key, value] of Object.entries(metaPayload)) {
    const metaOptions = { createdBy: senderId };
    if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'value')) {
      const valueObj = value as any;
      await metaUtils.setEntityMeta(
        tenantId,
        'message',
        messageId,
        key,
        valueObj.value,
        valueObj.dataType || 'string',
        metaOptions
      );
    } else {
      await metaUtils.setEntityMeta(
        tenantId,
        'message',
        messageId,
        key,
        value,
        typeof value === 'number'
          ? 'number'
          : typeof value === 'boolean'
            ? 'boolean'
            : Array.isArray(value)
              ? 'array'
              : 'string',
        metaOptions
      );
    }
  }
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const { tenantId, dialogId } = input;
  const senderId = input.userId;
  const normalizedType = input.type || 'internal.text';
  const messageContent = typeof input.content === 'string' ? input.content : '';
  const metaPayload =
    input.meta && typeof input.meta === 'object' ? { ...input.meta } : {};
  const isSystemMessage = normalizedType.startsWith('system.');
  const normalizedTopicId =
    input.topicId && String(input.topicId).trim() ? String(input.topicId).trim() : null;
  const quotedMessageId = input.quotedMessageId;

  if (!tenantId || !dialogId) {
    throw new AppServiceError('VALIDATION', 'tenantId and dialogId are required');
  }
  if (!senderId) {
    throw new AppServiceError('VALIDATION', 'Missing required field: senderId');
  }

  if (normalizedType === 'internal.text' && messageContent.trim().length === 0) {
    throw new AppServiceError('VALIDATION', 'content is required for internal.text messages');
  }

  if (MEDIA_MESSAGE_TYPES.has(normalizedType)) {
    const mediaUrl = typeof metaPayload.url === 'string' ? metaPayload.url.trim() : '';
    if (!mediaUrl) {
      throw new AppServiceError('VALIDATION', `meta.url is required for ${normalizedType} messages`);
    }
    metaPayload.url = mediaUrl;
  }

  const dialog = await Dialog.findOne({ dialogId, tenantId });
  if (!dialog) {
    throw new AppServiceError('NOT_FOUND', 'Dialog not found');
  }

  let topic = null;
  if (normalizedTopicId) {
    const topicDoc = await topicUtils.getTopicById(tenantId, dialogId, normalizedTopicId);
    if (!topicDoc) {
      throw new AppServiceError('NOT_FOUND', 'Topic not found');
    }
    try {
      topic = await topicUtils.getTopicWithMeta(tenantId, dialogId, normalizedTopicId);
    } catch (error) {
      console.error('Error getting topic with meta:', error);
      topic = { topicId: normalizedTopicId, meta: {} };
    }
  }

  try {
    const message = await Message.create([
      {
        tenantId,
        dialogId: dialog.dialogId,
        content: messageContent || '',
        senderId,
        type: normalizedType,
        topicId: normalizedTopicId
      }
    ]);
    const createdMessage = message[0];

    if (Object.keys(metaPayload).length > 0) {
      await setMessageMetaEntries(tenantId, createdMessage.messageId, senderId, metaPayload);
    }

    const eventContext = eventUtils.buildEventContext({
      eventType: 'message.create',
      dialogId: dialog.dialogId,
      entityId: createdMessage.messageId,
      messageId: createdMessage.messageId,
      includedSections: ['dialog', 'message'],
      updatedFields: ['message']
    });

    const messageMeta = await metaUtils.getEntityMeta(tenantId, 'message', createdMessage.messageId);
    const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialog.dialogId);
    const dialogSection = eventUtils.buildDialogSection({
      dialogId: dialog.dialogId,
      tenantId: dialog.tenantId,
      createdAt: dialog.createdAt,
      meta: dialogMeta || {}
    });

    const senderInfo = await getSenderInfo(tenantId, senderId);

    const MAX_CONTENT_LENGTH = 4096;
    const eventContent =
      messageContent.length > MAX_CONTENT_LENGTH
        ? messageContent.substring(0, MAX_CONTENT_LENGTH)
        : messageContent;

    let topicForEvent: any = null;
    if (normalizedTopicId) {
      try {
        topicForEvent = await topicUtils.getTopicWithMeta(tenantId, dialogId, normalizedTopicId);
      } catch (error) {
        console.error('Error getting topic with meta for event:', error);
        topicForEvent = { topicId: normalizedTopicId, meta: {} };
      }
    }

    const messageSection = eventUtils.buildMessageSection({
      messageId: createdMessage.messageId,
      dialogId: dialog.dialogId,
      senderId,
      type: normalizedType,
      content: eventContent,
      meta: messageMeta || {},
      quotedMessage: null,
      topicId: normalizedTopicId,
      topic: topicForEvent
    });

    await eventUtils.createEvent({
      tenantId,
      eventType: 'message.create',
      entityType: 'message',
      entityId: createdMessage.messageId,
      actorId: senderId,
      actorType: 'user',
      data: eventUtils.composeEventData({
        context: eventContext,
        dialog: dialogSection,
        message: messageSection
      })
    });

    if (!isSystemMessage) {
      const dialogMembers = await DialogMember.find({
        tenantId,
        dialogId: dialog.dialogId
      })
        .select('userId')
        .lean();

      const recipients = dialogMembers.filter((m) => m.userId !== senderId);
      if (recipients.length > 0) {
        const userIds = recipients.map((m) => m.userId);
        const users = await User.find({
          tenantId,
          userId: { $in: userIds }
        })
          .select('userId type')
          .lean();

        const userTypeMap = new Map<string, string | null>();
        users.forEach((user) => {
          userTypeMap.set(user.userId, user.type || null);
        });

        const messageStatuses = recipients.map((member) => ({
          messageId: createdMessage.messageId,
          userId: (member.userId || '').trim().toLowerCase(),
          dialogId: dialog.dialogId,
          userType: userTypeMap.get(member.userId) || null,
          tenantId,
          status: 'unread',
          createdAt: generateTimestamp()
        }));

        if (messageStatuses.length > 0) {
          await MessageStatus.insertMany(messageStatuses, { ordered: false });
        }
      }

      const messageTimestamp = createdMessage.createdAt;
      await Promise.allSettled(
        dialogMembers.map((member) =>
          updateLastMessageAt(tenantId, member.userId, dialog.dialogId, messageTimestamp)
        )
      );
    }

    if (Object.keys(metaPayload).length > 0) {
      await setMessageMetaEntries(tenantId, createdMessage.messageId, senderId, metaPayload);
    }

    let quotedMessage = null;
    if (quotedMessageId && typeof quotedMessageId === 'string' && quotedMessageId.trim()) {
      try {
        const quotedMsg = await Message.findOne({
          messageId: quotedMessageId.trim(),
          tenantId
        }).lean();

        if (quotedMsg) {
          const quotedMessageMeta = await metaUtils.getEntityMeta(
            tenantId,
            'message',
            quotedMsg.messageId
          );
          const quotedSenderInfo = await getSenderInfo(tenantId, quotedMsg.senderId);
          quotedMessage = {
            messageId: quotedMsg.messageId,
            dialogId: quotedMsg.dialogId,
            senderId: quotedMsg.senderId,
            content: quotedMsg.content,
            type: quotedMsg.type,
            createdAt: quotedMsg.createdAt,
            deleted: (quotedMsg as { deleted?: boolean }).deleted === true,
            deletedAt: (quotedMsg as { deletedAt?: number | null }).deletedAt ?? null,
            deletedBy: (quotedMsg as { deletedBy?: string | null }).deletedBy ?? null,
            meta: quotedMessageMeta || {},
            senderInfo: quotedSenderInfo || null
          };
          await Message.findOneAndUpdate(
            { messageId: createdMessage.messageId },
            { quotedMessage }
          );
        } else {
          console.warn(`Quoted message ${quotedMessageId} not found`);
        }
      } catch (error) {
        console.error(`Error processing quotedMessageId ${quotedMessageId}:`, error);
      }
    }

    const messageWithMeta = await Message.findOne({ messageId: createdMessage.messageId })
      .select('-__v')
      .populate('tenantId', 'name domain');

    const messageObj = messageWithMeta!.toObject();

    return {
      message: sanitizeResponse({
        ...messageObj,
        meta: messageMeta || {},
        topic: topic || null,
        senderInfo: senderInfo || null,
        quotedMessage: quotedMessage || null
      })
    };
  } catch (error: any) {
    if (error instanceof AppServiceError) throw error;
    if (error?.name === 'CastError') {
      throw new AppServiceError('VALIDATION', 'Invalid dialog ID');
    }
    if (error?.name === 'ValidationError') {
      throw new AppServiceError('VALIDATION', error.message);
    }
    throw error;
  }
}
