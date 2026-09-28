import {
  DialogMember,
  Message,
  MessageStatus,
  UserDialogActivity,
  UserDialogStats,
  UserDialogUnreadBySenderType
} from '@chat3/models';
import { generateTimestamp } from '../timestampUtils.js';
import { getUserType } from '../userTypeUtils.js';
import { PACK_UNREAD_SENDER_TYPES, normalizeSenderType } from '../packUnreadSenderTypes.js';
import { zeroUserDialogUnread } from './recalculateUserDialogUnread.js';
import type { CounterSlice } from './types.js';

const HOT_EVENTS = new Set([
  'message.create',
  'message.deleted',
  'message.status.changed',
  'dialog.messages.bulk_read'
]);

function isSystemType(type: unknown): boolean {
  return typeof type === 'string' && type.startsWith('system.');
}

function inUnreadWindow(createdAt: number, joinedAt: number, lastSeenAt: number | null): boolean {
  if (createdAt < joinedAt) return false;
  if (lastSeenAt != null && createdAt <= lastSeenAt) return false;
  return true;
}

async function bumpUnread(
  tenantId: string,
  userId: string,
  dialogId: string,
  delta: number,
  senderId: string
): Promise<void> {
  if (delta === 0) return;
  const now = generateTimestamp();
  const stats = await UserDialogStats.findOne({ tenantId, userId, dialogId }).select('unreadCount').lean();
  const next = Math.max(0, ((stats as { unreadCount?: number } | null)?.unreadCount ?? 0) + delta);
  await UserDialogStats.findOneAndUpdate(
    { tenantId, userId, dialogId },
    {
      $set: { unreadCount: next, lastUpdatedAt: now },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  const fromType = normalizeSenderType(await getUserType(tenantId, senderId));
  const row = await UserDialogUnreadBySenderType.findOne({
    tenantId,
    userId,
    dialogId,
    fromType
  }).select('countUnread').lean();
  const nextType = Math.max(0, ((row as { countUnread?: number } | null)?.countUnread ?? 0) + delta);
  await UserDialogUnreadBySenderType.findOneAndUpdate(
    { tenantId, userId, dialogId, fromType },
    {
      $set: { countUnread: nextType, lastUpdatedAt: now },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  for (const other of PACK_UNREAD_SENDER_TYPES) {
    if (other === fromType) continue;
    await UserDialogUnreadBySenderType.updateOne(
      { tenantId, userId, dialogId, fromType: other },
      { $setOnInsert: { countUnread: 0, createdAt: now, lastUpdatedAt: now } },
      { upsert: true }
    );
  }
}

async function loadJoinAndSeen(
  tenantId: string,
  dialogId: string,
  userIds: string[]
): Promise<{ joinedAt: Map<string, number>; lastSeenAt: Map<string, number> }> {
  const members = await DialogMember.find({ tenantId, dialogId, userId: { $in: userIds } })
    .select('userId createdAt')
    .lean();
  const activities = await UserDialogActivity.find({ tenantId, dialogId, userId: { $in: userIds } })
    .select('userId lastSeenAt')
    .lean();
  const joinedAt = new Map<string, number>();
  for (const member of members as Array<{ userId?: string; createdAt?: number }>) {
    if (member.userId && member.createdAt != null) {
      joinedAt.set(member.userId.trim().toLowerCase(), Number(member.createdAt));
    }
  }
  const lastSeenAt = new Map<string, number>();
  for (const activity of activities as Array<{ userId?: string; lastSeenAt?: number }>) {
    if (activity.userId && activity.lastSeenAt != null) {
      lastSeenAt.set(activity.userId.trim().toLowerCase(), Number(activity.lastSeenAt));
    }
  }
  return { joinedAt, lastSeenAt };
}

/**
 * Инкремент / обнуление unread без агрегации по истории диалога.
 * Возвращает true, если событие обработано и полный пересчёт пары не нужен.
 */
export async function applyHotUnread(slice: CounterSlice): Promise<boolean> {
  if (!HOT_EVENTS.has(slice.sourceEventType)) return false;

  if (slice.sourceEventType === 'dialog.messages.bulk_read') {
    for (const { userId, dialogId } of slice.userDialogs) {
      await zeroUserDialogUnread(slice.tenantId, userId, dialogId);
    }
    return true;
  }

  const messageId = slice.messageIds[0];
  if (!messageId || slice.userDialogs.length === 0) return true;

  const message = await Message.findOne({ tenantId: slice.tenantId, messageId })
    .select('messageId dialogId senderId type createdAt deleted')
    .lean() as {
      senderId?: string;
      type?: string;
      createdAt?: number;
      deleted?: boolean;
    } | null;
  if (!message || message.createdAt == null) return false;

  const senderId = (message.senderId || '').trim().toLowerCase();
  const createdAt = Number(message.createdAt);
  const dialogId = slice.userDialogs[0]?.dialogId;
  if (!dialogId) return true;

  const userIds = slice.userDialogs.map((pair) => pair.userId);
  const { joinedAt, lastSeenAt } = await loadJoinAndSeen(slice.tenantId, dialogId, userIds);

  let delta = 0;
  if (slice.sourceEventType === 'message.create') {
    delta = message.deleted || isSystemType(message.type) ? 0 : 1;
  } else if (slice.sourceEventType === 'message.deleted') {
    if (isSystemType(message.type)) {
      delta = 0;
    } else {
      delta = message.deleted === false ? 1 : -1;
    }
  } else if (slice.sourceEventType === 'message.status.changed') {
    let status = slice.statusHint ?? null;
    if (!status) {
      const latest = await MessageStatus.findOne({
        tenantId: slice.tenantId,
        messageId,
        userId: slice.userDialogs[0]?.userId
      }).sort({ createdAt: -1 }).select('status').lean() as { status?: string } | null;
      status = latest?.status ?? null;
    }
    delta = status === 'read' && !isSystemType(message.type) ? -1 : 0;
  }

  if (delta === 0) return true;

  const seenUsers = new Set<string>();
  for (const pair of slice.userDialogs) {
    if (pair.dialogId !== dialogId) continue;
    const uid = pair.userId.trim().toLowerCase();
    if (seenUsers.has(uid)) continue;
    seenUsers.add(uid);
    if (uid === senderId) continue;
    const join = joinedAt.get(uid);
    if (join == null) continue;
    const seenAt = lastSeenAt.has(uid) ? lastSeenAt.get(uid)! : null;
    if (!inUnreadWindow(createdAt, join, seenAt)) continue;
    await bumpUnread(slice.tenantId, uid, dialogId, delta, senderId);
  }

  return true;
}
