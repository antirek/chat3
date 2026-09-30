import { DialogStats, Message, MessageCountClaim } from '@chat3/models';
import { generateTimestamp } from '../timestampUtils.js';
import { updateUserStatsTotalMessagesCount } from '../counterUtils.js';
import type { CounterSlice } from './types.js';

const HOT_MESSAGE_COUNT_EVENTS = new Set(['message.create', 'message.deleted']);

export function messageCountDelta(eventType: string, deleted: boolean): number {
  if (eventType === 'message.create') {
    return deleted ? 0 : 1;
  }
  if (eventType === 'message.deleted') {
    return deleted ? -1 : 1;
  }
  return 0;
}

let claimIndexesReady: Promise<void> | null = null;

function ensureClaimIndexes(): Promise<void> {
  if (!claimIndexesReady) {
    claimIndexesReady = MessageCountClaim.createIndexes().then(() => undefined);
  }
  return claimIndexesReady;
}

async function claimMessageCountEvent(
  tenantId: string,
  eventId: string,
  eventType: string
): Promise<boolean> {
  await ensureClaimIndexes();
  const existing = await MessageCountClaim.findOne({ tenantId, eventId }).select('_id').lean();
  if (existing) {
    return false;
  }
  try {
    await MessageCountClaim.create({
      tenantId,
      eventId,
      eventType,
      claimedAt: generateTimestamp()
    });
    return true;
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 11000) {
      return false;
    }
    throw err;
  }
}

/**
 * $inc totalMessagesCount и DialogStats.messageCount без скана messages.
 * Отметка MessageCountClaim пишется до $inc: повтор eventId счётчик не двигает.
 * Возвращает true, если полный countDocuments по messages на этом событии не нужен.
 */
export async function applyHotMessageCount(slice: CounterSlice): Promise<boolean> {
  if (!HOT_MESSAGE_COUNT_EVENTS.has(slice.sourceEventType)) {
    return false;
  }

  const senderId = (slice.senderId || '').trim().toLowerCase();
  const dialogId = slice.dialogIds[0];
  const messageId = slice.messageIds[0];
  if (!senderId || !dialogId || !messageId || !slice.sourceEventId) {
    console.warn(
      `[counterProcessor] message count skip scan without ids: tenant=${slice.tenantId} eventId=${slice.sourceEventId || '-'} type=${slice.sourceEventType}`
    );
    return true;
  }

  const claimed = await claimMessageCountEvent(
    slice.tenantId,
    slice.sourceEventId,
    slice.sourceEventType
  );
  if (!claimed) {
    return true;
  }

  const message = await Message.findOne({ tenantId: slice.tenantId, messageId })
    .select('deleted')
    .lean();
  const deleted = (message as { deleted?: boolean } | null)?.deleted === true;
  const delta = messageCountDelta(slice.sourceEventType, deleted);
  if (delta === 0) {
    return true;
  }

  await updateUserStatsTotalMessagesCount(
    slice.tenantId,
    senderId,
    delta,
    slice.sourceEventType,
    slice.sourceEventId,
    messageId,
    slice.actorId || 'system',
    slice.actorType || 'system'
  );

  const now = generateTimestamp();
  await DialogStats.findOneAndUpdate(
    { tenantId: slice.tenantId, dialogId },
    {
      $inc: { messageCount: delta },
      $set: { lastUpdatedAt: now },
      $setOnInsert: {
        topicCount: 0,
        memberCount: 0,
        createdAt: now
      }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  return true;
}
