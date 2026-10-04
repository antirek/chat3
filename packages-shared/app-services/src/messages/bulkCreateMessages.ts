import {
  Dialog,
  DialogMember,
  DialogStats,
  Message,
  MessageStatus,
  User,
  UserDialogActivity
} from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import * as topicUtils from '@chat3/utils/topicUtils.js';
import { isMetaIndexError } from '@chat3/utils/metaIndexErrors.js';
import { updateUserStatsTotalMessagesCount } from '@chat3/utils/counterUtils.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { getSenderInfo } from '@chat3/utils/userDialogUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';

const STATUS_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_BATCH = 50;

const MEDIA_MESSAGE_TYPES = new Set([
  'internal.image',
  'internal.file',
  'internal.audio',
  'internal.video',
  'internal.sticker'
]);

/**
 * Элемент пакета = тело createMessage + sentAt (история) и опциональный status отправителя.
 * Свободные ключи meta — как у create; уникальность только через meta-index тенанта.
 */
export interface BulkCreateMessageItem {
  senderId: string;
  content?: string;
  type?: string;
  meta?: Record<string, unknown>;
  quotedMessageId?: string | null;
  topicId?: string | null;
  sentAt: number;
  status?: string;
}

export interface BulkCreateMessagesInput {
  tenantId: string;
  dialogId: string;
  messages: BulkCreateMessageItem[];
}

export type BulkCreateItemResult =
  | { index: number; status: 'created'; messageId: string; createdAt: number }
  | { index: number; status: 'duplicate'; messageId: string; createdAt?: number }
  | { index: number; status: 'error'; error: string };

export interface BulkCreateMessagesResult {
  results: BulkCreateItemResult[];
}

/**
 * Normalize source time to chat3 unixtimestamp.microseconds
 * (Unix ms integer part + fractional microseconds), like generateTimestamp().
 */
export function normalizeToUnixTimestampMicroseconds(
  sentAt: number,
  orderIndex = 0
): number {
  if (!Number.isFinite(sentAt)) {
    throw new AppServiceError('VALIDATION', 'sentAt must be a finite number');
  }
  let ms = sentAt;
  // seconds → milliseconds
  if (Math.abs(ms) < 1e11) {
    ms = ms * 1000;
  }
  const integerMs = Math.trunc(ms);
  let fraction = ms - integerMs;
  if (fraction < 0) {
    fraction = 0;
  }
  // JS Number ULP around Unix-ms is ~0.25, so µs fractions are not distinct.
  // Equal sentAt in one batch: +orderIndex ms so лента keeps packet order.
  return integerMs + orderIndex + Math.min(fraction, 0.999);
}

async function bumpMessageCounts(
  tenantId: string,
  dialogId: string,
  senderId: string,
  messageId: string
): Promise<void> {
  const sourceEventId = `bulkCreate:${messageId}`;
  await updateUserStatsTotalMessagesCount(
    tenantId,
    senderId,
    1,
    'messages.bulkCreate',
    sourceEventId,
    messageId,
    'system',
    'system'
  );

  const now = generateTimestamp();
  await DialogStats.findOneAndUpdate(
    { tenantId, dialogId },
    {
      $inc: { messageCount: 1 },
      $set: { lastUpdatedAt: now },
      $setOnInsert: {
        topicCount: 0,
        memberCount: 0,
        createdAt: now
      }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

async function bumpLastMessageAtIfNewer(
  tenantId: string,
  userId: string,
  dialogId: string,
  createdAt: number
): Promise<void> {
  const activity = await UserDialogActivity.findOne({ tenantId, userId, dialogId })
    .select('lastMessageAt')
    .lean();
  const current = (activity as { lastMessageAt?: number } | null)?.lastMessageAt;
  if (current != null && current >= createdAt) {
    return;
  }
  await UserDialogActivity.findOneAndUpdate(
    { tenantId, userId, dialogId },
    {
      $set: { lastMessageAt: createdAt },
      $setOnInsert: { lastSeenAt: 0 }
    },
    { upsert: true, setDefaultsOnInsert: false }
  );
}

async function resolveQuotedMessage(
  tenantId: string,
  quotedMessageId: string | null | undefined
): Promise<Record<string, unknown> | null> {
  if (!quotedMessageId || typeof quotedMessageId !== 'string' || !quotedMessageId.trim()) {
    return null;
  }
  const quotedMsg = await Message.findOne({
    messageId: quotedMessageId.trim(),
    tenantId
  }).lean();
  if (!quotedMsg) {
    return null;
  }
  const quotedMessageMeta = await metaUtils.getEntityMeta(
    tenantId,
    'message',
    quotedMsg.messageId
  );
  const quotedSenderInfo = await getSenderInfo(tenantId, quotedMsg.senderId);
  return {
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
}

export async function bulkCreateMessages(
  input: BulkCreateMessagesInput
): Promise<BulkCreateMessagesResult> {
  const { tenantId, dialogId } = input;
  const messages = Array.isArray(input.messages) ? input.messages : [];

  if (!tenantId || !dialogId) {
    throw new AppServiceError('VALIDATION', 'tenantId and dialogId are required');
  }
  if (messages.length === 0) {
    throw new AppServiceError('VALIDATION', 'messages must be a non-empty array');
  }
  if (messages.length > MAX_BATCH) {
    throw new AppServiceError(
      'VALIDATION',
      `messages length must be <= ${MAX_BATCH}`
    );
  }

  const dialog = await Dialog.findOne({ dialogId, tenantId }).lean();
  if (!dialog) {
    throw new AppServiceError('NOT_FOUND', 'Dialog not found');
  }

  const members = await DialogMember.find({ tenantId, dialogId })
    .select('userId')
    .lean();

  const results: BulkCreateItemResult[] = [];

  for (let index = 0; index < messages.length; index++) {
    const raw = messages[index] || ({} as BulkCreateMessageItem);
    let createdMessageId: string | null = null;
    try {
      const senderId =
        typeof raw.senderId === 'string' ? raw.senderId.trim() : '';
      const normalizedType =
        typeof raw.type === 'string' && raw.type.trim()
          ? raw.type.trim().toLowerCase()
          : 'internal.text';
      const metaPayload: Record<string, unknown> =
        raw.meta && typeof raw.meta === 'object' ? { ...raw.meta } : {};
      const content = typeof raw.content === 'string' ? raw.content : '';
      const normalizedTopicId =
        raw.topicId && String(raw.topicId).trim()
          ? String(raw.topicId).trim()
          : null;

      if (!senderId) {
        results.push({ index, status: 'error', error: 'senderId is required' });
        continue;
      }
      if (!Number.isFinite(raw.sentAt)) {
        results.push({ index, status: 'error', error: 'sentAt is required' });
        continue;
      }
      if (normalizedType === 'internal.text' && content.trim().length === 0) {
        results.push({
          index,
          status: 'error',
          error: 'content is required for internal.text messages'
        });
        continue;
      }
      if (MEDIA_MESSAGE_TYPES.has(normalizedType)) {
        const mediaUrl =
          typeof metaPayload.url === 'string' ? metaPayload.url.trim() : '';
        if (!mediaUrl) {
          results.push({
            index,
            status: 'error',
            error: `meta.url is required for ${normalizedType} messages`
          });
          continue;
        }
        metaPayload.url = mediaUrl;
      }

      let status: string | undefined;
      if (raw.status != null && String(raw.status).trim() !== '') {
        status = String(raw.status).trim().toLowerCase();
        if (!STATUS_PATTERN.test(status)) {
          results.push({
            index,
            status: 'error',
            error: 'status must match [a-zA-Z0-9_-]{1,64}'
          });
          continue;
        }
      }

      if (normalizedTopicId) {
        const topicDoc = await topicUtils.getTopicById(
          tenantId,
          dialogId,
          normalizedTopicId
        );
        if (!topicDoc) {
          results.push({ index, status: 'error', error: 'Topic not found' });
          continue;
        }
      }

      const createdAt = normalizeToUnixTimestampMicroseconds(raw.sentAt, index);
      const quotedMessage = await resolveQuotedMessage(tenantId, raw.quotedMessageId);

      const created = await Message.create([
        {
          tenantId,
          dialogId,
          content,
          senderId,
          type: normalizedType,
          topicId: normalizedTopicId,
          quotedMessage,
          createdAt
        }
      ]);
      const message = created[0];
      createdMessageId = message.messageId;

      try {
        await metaUtils.setEntityMetaBulk(
          tenantId,
          'message',
          message.messageId,
          {
            ...metaPayload,
            historical: true
          },
          { createdBy: senderId }
        );
      } catch (metaError: unknown) {
        if (isMetaIndexError(metaError) && metaError.code === 'DUPLICATE_INDEX') {
          await Message.deleteOne({ tenantId, messageId: message.messageId });
          createdMessageId = null;
          const existingEntityId =
            typeof metaError.details?.existingEntityId === 'string'
              ? metaError.details.existingEntityId
              : undefined;
          let existingCreatedAt: number | undefined;
          if (existingEntityId) {
            const existing = await Message.findOne({
              tenantId,
              messageId: existingEntityId
            })
              .select('createdAt')
              .lean();
            existingCreatedAt = existing?.createdAt;
          }
          results.push({
            index,
            status: 'duplicate',
            messageId: existingEntityId || 'unknown',
            createdAt: existingCreatedAt
          });
          continue;
        }
        throw metaError;
      }

      if (status) {
        const user = await User.findOne({ tenantId, userId: senderId })
          .select('type')
          .lean();
        await MessageStatus.create([
          {
            messageId: message.messageId,
            userId: senderId.trim().toLowerCase(),
            tenantId,
            dialogId,
            status,
            userType: user?.type || null,
            createdAt: generateTimestamp()
          }
        ]);
      }

      await bumpMessageCounts(tenantId, dialogId, senderId, message.messageId);

      await Promise.allSettled(
        members.map((member) =>
          bumpLastMessageAtIfNewer(
            tenantId,
            member.userId,
            dialogId,
            createdAt
          )
        )
      );

      results.push({
        index,
        status: 'created',
        messageId: message.messageId,
        createdAt: message.createdAt
      });
    } catch (error: any) {
      if (createdMessageId) {
        await Message.deleteOne({ tenantId, messageId: createdMessageId }).catch(
          () => undefined
        );
      }
      results.push({
        index,
        status: 'error',
        error: error?.message || 'failed to create message'
      });
    }
  }

  return { results };
}
