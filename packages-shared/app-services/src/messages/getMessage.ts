import { DialogMember, Message } from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import * as topicUtils from '@chat3/utils/topicUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import {
  getSenderInfo,
  buildStatusMessageMatrix,
  buildReactionSet
} from '@chat3/utils/userDialogUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';
import { normalizeUserId } from '../dialogs/dialogHelpers.js';

export interface GetMessageInput {
  tenantId: string;
  messageId: string;
  /** When set, requires membership in the message's dialog. */
  userId?: string;
}

export interface GetMessageResult {
  message: any;
}

/**
 * Load one message by id (tenant-scoped). Optional membership gate via userId.
 */
export async function getMessage(input: GetMessageInput): Promise<GetMessageResult> {
  const tenantId = input.tenantId;
  const messageId = String(input.messageId || '').trim().toLowerCase();
  const userId = input.userId ? normalizeUserId(input.userId) : '';

  if (!tenantId || !messageId) {
    throw new AppServiceError('VALIDATION', 'tenantId and messageId are required');
  }

  const message = await Message.findOne({ tenantId, messageId }).lean();
  if (!message) {
    throw new AppServiceError('NOT_FOUND', 'Message not found');
  }

  if (userId) {
    const member = await DialogMember.findOne({
      tenantId,
      dialogId: message.dialogId,
      userId
    })
      .select('userId')
      .lean();
    if (!member) {
      throw new AppServiceError('FORBIDDEN', 'User is not a member of this dialog');
    }
  }

  const meta = await metaUtils.getEntityMeta(tenantId, 'message', message.messageId);

  let topic: any = null;
  const messageTopicId = (message as any).topicId || null;
  if (messageTopicId) {
    try {
      topic = await topicUtils.getTopicWithMeta(tenantId, message.dialogId, messageTopicId);
    } catch {
      topic = { topicId: messageTopicId, meta: {} };
    }
  }

  const statusMessageMatrix = await buildStatusMessageMatrix(
    tenantId,
    message.messageId,
    message.senderId
  );
  const reactionSet = await buildReactionSet(
    tenantId,
    message.messageId,
    userId || null
  );
  const senderInfo = await getSenderInfo(tenantId, message.senderId);

  return {
    message: sanitizeResponse({
      ...message,
      topicId: messageTopicId,
      meta,
      topic: topic || null,
      statusMessageMatrix,
      reactionSet,
      senderInfo: senderInfo || null,
      statuses: []
    })
  };
}
