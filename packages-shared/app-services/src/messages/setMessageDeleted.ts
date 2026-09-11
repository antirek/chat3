import { Dialog, Message } from '@chat3/models';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import * as topicUtils from '@chat3/utils/topicUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import {
  buildStatusMessageMatrix,
  buildReactionSet,
  getSenderInfo
} from '@chat3/utils/userDialogUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';

export interface SetMessageDeletedInput {
  tenantId: string;
  messageId: string;
  deleted: boolean;
  /** Who marked deleted; optional. Also used as actor hint for events when provided. */
  deletedBy?: string | null;
  /** Integrator/api actor name for event actorId (REST uses apiKey.name). */
  actorId?: string;
}

export interface SetMessageDeletedResult {
  message: any;
  responseMessage: string;
}

async function enrichMessageResponse(
  tenantId: string,
  message: any
): Promise<Record<string, unknown>> {
  const meta = await metaUtils.getEntityMeta(tenantId, 'message', message.messageId);
  const messageObj = typeof message.toObject === 'function'
    ? (message.toObject() as Record<string, unknown>)
    : { ...message };
  const statusMessageMatrix = await buildStatusMessageMatrix(
    tenantId,
    message.messageId,
    messageObj.senderId as string
  );
  const reactionSet = await buildReactionSet(tenantId, message.messageId, null);
  const senderInfo = await getSenderInfo(tenantId, message.senderId);

  const data = sanitizeResponse({
    ...messageObj,
    statusMessageMatrix,
    reactionSet,
    meta,
    senderInfo: senderInfo || null
  }) as Record<string, unknown>;

  data.deleted = message.deleted === true;
  data.deletedAt = message.deletedAt ?? null;
  data.deletedBy = message.deletedBy ?? null;
  return data;
}

/**
 * Soft-delete / undelete message. Idempotent when flag already matches target.
 */
export async function setMessageDeleted(
  input: SetMessageDeletedInput
): Promise<SetMessageDeletedResult> {
  const { tenantId, messageId } = input;
  if (!tenantId || !messageId || typeof input.deleted !== 'boolean') {
    throw new AppServiceError('VALIDATION', 'tenantId, messageId and deleted are required');
  }

  const deletedBy =
    input.deletedBy !== undefined && input.deletedBy !== null && String(input.deletedBy).trim() !== ''
      ? String(input.deletedBy).trim()
      : null;

  const message = await Message.findOne({ messageId, tenantId });
  if (!message) {
    throw new AppServiceError('NOT_FOUND', 'Message not found');
  }

  const currentlyDeleted = (message as any).deleted === true;
  const targetDeleted = input.deleted === true;

  if (currentlyDeleted === targetDeleted) {
    return {
      message: await enrichMessageResponse(tenantId, message),
      responseMessage: targetDeleted ? 'Message is already deleted' : 'Message is not deleted'
    };
  }

  if (targetDeleted) {
    (message as any).deleted = true;
    (message as any).deletedAt = generateTimestamp();
    (message as any).deletedBy = deletedBy;
  } else {
    (message as any).deleted = false;
    (message as any).deletedAt = null;
    (message as any).deletedBy = null;
  }
  await message.save();

  const meta = await metaUtils.getEntityMeta(tenantId, 'message', message.messageId);

  const dialog = await Dialog.findOne({
    dialogId: message.dialogId,
    tenantId
  }).lean();

  let dialogSection: any = null;
  if (dialog) {
    const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', message.dialogId);
    dialogSection = eventUtils.buildDialogSection({
      dialogId: (dialog as any).dialogId,
      tenantId: (dialog as any).tenantId,
      createdAt: (dialog as any).createdAt,
      meta: dialogMeta || {}
    });
  }

  let topicForEvent: any = null;
  const messageTopicIdForEvent = (message as any).topicId ?? null;
  if (messageTopicIdForEvent) {
    try {
      topicForEvent = await topicUtils.getTopicWithMeta(
        tenantId,
        message.dialogId,
        messageTopicIdForEvent
      );
    } catch {
      topicForEvent = { topicId: messageTopicIdForEvent, meta: {} };
    }
  }

  const MAX_CONTENT_LENGTH = 4096;
  const content = typeof message.content === 'string' ? message.content : '';
  const eventContent =
    content.length > MAX_CONTENT_LENGTH ? content.substring(0, MAX_CONTENT_LENGTH) : content;

  const messageSection = eventUtils.buildMessageSection({
    messageId: message.messageId,
    dialogId: message.dialogId,
    senderId: message.senderId,
    type: message.type,
    content: eventContent,
    meta: meta || {},
    topicId: messageTopicIdForEvent,
    topic: topicForEvent,
    deleted: (message as any).deleted === true,
    deletedAt: (message as any).deletedAt ?? null,
    deletedBy: (message as any).deletedBy ?? null
  });

  const eventContext = eventUtils.buildEventContext({
    eventType: 'message.deleted',
    dialogId: message.dialogId,
    entityId: message.messageId,
    messageId: message.messageId,
    includedSections: dialogSection ? ['dialog', 'message'] : ['message'],
    updatedFields: ['message.deleted', 'message.deletedAt', 'message.deletedBy']
  });

  await eventUtils.createEvent({
    tenantId,
    eventType: 'message.deleted',
    entityType: 'message',
    entityId: message.messageId,
    actorId: input.actorId || deletedBy || 'unknown',
    actorType: 'api',
    data: eventUtils.composeEventData({
      context: eventContext,
      dialog: dialogSection,
      message: messageSection,
      extra: {
        deleted: targetDeleted,
        deletedAt: (message as any).deletedAt ?? null,
        deletedBy: (message as any).deletedBy ?? null
      }
    })
  });

  return {
    message: await enrichMessageResponse(tenantId, message),
    responseMessage: targetDeleted
      ? 'Message soft-deleted successfully'
      : 'Message undeleted successfully'
  };
}
