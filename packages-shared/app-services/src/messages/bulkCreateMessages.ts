import {
  Dialog,
  DialogMember,
  DialogStats,
  Message,
  MessageStatus,
  Meta,
  User,
  UserDialogActivity
} from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { updateUserStatsTotalMessagesCount } from '@chat3/utils/counterUtils.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';

const STATUS_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_BATCH = 50;

export interface BulkCreateMessageItem {
  senderId: string;
  externalId: string;
  content?: string;
  sentAt: number;
  sentFromPhone?: boolean;
  hasAttachment?: boolean;
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

async function findDuplicateMessageId(
  tenantId: string,
  dialogId: string,
  externalId: string
): Promise<{ messageId: string; createdAt?: number } | null> {
  const metas = await Meta.find({
    tenantId,
    entityType: 'message',
    key: 'externalId',
    value: externalId
  })
    .select('entityId')
    .lean();

  for (const meta of metas) {
    const message = await Message.findOne({
      tenantId,
      dialogId,
      messageId: meta.entityId
    })
      .select('messageId createdAt')
      .lean();
    if (message) {
      return {
        messageId: message.messageId,
        createdAt: message.createdAt
      };
    }
  }
  return null;
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

async function setMetaFlags(
  tenantId: string,
  messageId: string,
  senderId: string,
  item: BulkCreateMessageItem
): Promise<void> {
  type MetaDataType = 'string' | 'number' | 'boolean' | 'object' | 'array';
  const entries: Array<{ key: string; value: unknown; dataType: MetaDataType }> = [
    { key: 'externalId', value: item.externalId, dataType: 'string' },
    { key: 'historical', value: true, dataType: 'boolean' }
  ];
  if (item.sentFromPhone === true) {
    entries.push({ key: 'sentFromPhone', value: true, dataType: 'boolean' });
  }
  if (item.hasAttachment === true) {
    entries.push({ key: 'hasAttachment', value: true, dataType: 'boolean' });
  }
  for (const entry of entries) {
    await metaUtils.setEntityMeta(
      tenantId,
      'message',
      messageId,
      entry.key,
      entry.value,
      entry.dataType,
      { createdBy: senderId }
    );
  }
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
    try {
      const senderId =
        typeof raw.senderId === 'string' ? raw.senderId.trim() : '';
      const externalId =
        typeof raw.externalId === 'string' ? raw.externalId.trim() : '';
      const content = typeof raw.content === 'string' ? raw.content : '';
      const hasAttachment = raw.hasAttachment === true;

      if (!senderId) {
        results.push({ index, status: 'error', error: 'senderId is required' });
        continue;
      }
      if (!externalId) {
        results.push({ index, status: 'error', error: 'externalId is required' });
        continue;
      }
      if (!Number.isFinite(raw.sentAt)) {
        results.push({ index, status: 'error', error: 'sentAt is required' });
        continue;
      }
      if (!hasAttachment && content.trim().length === 0) {
        results.push({
          index,
          status: 'error',
          error: 'content is required unless hasAttachment is true'
        });
        continue;
      }

      let status: string | undefined;
      if (raw.status != null && String(raw.status).trim() !== '') {
        status = String(raw.status).trim().toLowerCase();
        if (!STATUS_PATTERN.test(status)) {
          results.push({
            index,
            status: 'error',
            error:
              'status must match [a-zA-Z0-9_-]{1,64}'
          });
          continue;
        }
      }

      const duplicate = await findDuplicateMessageId(
        tenantId,
        dialogId,
        externalId
      );
      if (duplicate) {
        results.push({
          index,
          status: 'duplicate',
          messageId: duplicate.messageId,
          createdAt: duplicate.createdAt
        });
        continue;
      }

      const createdAt = normalizeToUnixTimestampMicroseconds(raw.sentAt, index);
      const created = await Message.create([
        {
          tenantId,
          dialogId,
          content,
          senderId,
          type: 'internal.text',
          createdAt
        }
      ]);
      const message = created[0];

      await setMetaFlags(tenantId, message.messageId, senderId, {
        ...raw,
        senderId,
        externalId,
        hasAttachment
      });

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
      results.push({
        index,
        status: 'error',
        error: error?.message || 'failed to create message'
      });
    }
  }

  return { results };
}
