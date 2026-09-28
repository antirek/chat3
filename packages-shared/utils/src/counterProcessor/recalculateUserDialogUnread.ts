import {
  DialogMember,
  Message,
  UserDialogActivity,
  UserDialogStats,
  UserDialogUnreadBySenderType
} from '@chat3/models';
import type { PipelineStage } from 'mongoose';
import { generateTimestamp } from '../timestampUtils.js';
import { getUserType } from '../userTypeUtils.js';
import { PACK_UNREAD_SENDER_TYPES, normalizeSenderType } from '../packUnreadSenderTypes.js';
import { unreadMessageMatchExtras } from './isUnreadForUser.js';

/** Момент вступления user в dialog; null — не участник. */
export async function getDialogMemberJoinedAt(
  tenantId: string,
  userId: string,
  dialogId: string
): Promise<number | null> {
  const uid = (userId || '').trim().toLowerCase();
  const member = await DialogMember.findOne({ tenantId, userId: uid, dialogId })
    .select('createdAt')
    .lean();
  return (member as { createdAt?: number } | null)?.createdAt ?? null;
}

export async function getDialogLastSeenAt(
  tenantId: string,
  userId: string,
  dialogId: string
): Promise<number | null> {
  const uid = (userId || '').trim().toLowerCase();
  const activity = await UserDialogActivity.findOne({ tenantId, userId: uid, dialogId })
    .select('lastSeenAt')
    .lean();
  const lastSeenAt = (activity as { lastSeenAt?: number } | null)?.lastSeenAt;
  return lastSeenAt == null ? null : Number(lastSeenAt);
}

async function aggregateUnreadBySender(
  tenantId: string,
  userId: string,
  dialogId: string,
  memberJoinedAt: number,
  createdAtLte?: number
): Promise<Array<{ _id: string; count: number }>> {
  const lastSeenAt = await getDialogLastSeenAt(tenantId, userId, dialogId);
  const extras = unreadMessageMatchExtras(userId, { memberJoinedAt, lastSeenAt });
  if (createdAtLte != null) {
    const createdAt = (extras.createdAt && typeof extras.createdAt === 'object')
      ? { ...(extras.createdAt as Record<string, number>) }
      : {};
    createdAt.$lte = createdAtLte;
    extras.createdAt = createdAt;
  }
  const pipeline: PipelineStage[] = [
    {
      $match: {
        tenantId,
        dialogId,
        ...extras
      }
    },
    { $group: { _id: '$senderId', count: { $sum: 1 } } }
  ];
  return Message.aggregate(pipeline) as Promise<Array<{ _id: string; count: number }>>;
}

/**
 * Ожидаемый unread для пары (userId, dialogId) без записи в БД.
 * Один проход по окну createdAt после lastSeenAt / join, без $lookup в messagestatuses.
 */
export async function countUserDialogUnread(
  tenantId: string,
  userId: string,
  dialogId: string
): Promise<number> {
  const uid = (userId || '').trim().toLowerCase();
  const memberJoinedAt = await getDialogMemberJoinedAt(tenantId, uid, dialogId);
  if (memberJoinedAt == null) {
    return 0;
  }
  const rows = await aggregateUnreadBySender(tenantId, uid, dialogId, memberJoinedAt);
  return rows.reduce((sum, row) => sum + row.count, 0);
}

/** Записать unread = 0 для пары (user, dialog), включая разбивку по типу отправителя. */
export async function zeroUserDialogUnread(
  tenantId: string,
  userId: string,
  dialogId: string
): Promise<void> {
  const uid = (userId || '').trim().toLowerCase();
  const now = generateTimestamp();
  await UserDialogStats.findOneAndUpdate(
    { tenantId, userId: uid, dialogId },
    {
      $set: { unreadCount: 0, lastUpdatedAt: now },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  for (const fromType of PACK_UNREAD_SENDER_TYPES) {
    await UserDialogUnreadBySenderType.findOneAndUpdate(
      { tenantId, userId: uid, dialogId, fromType },
      {
        $set: { countUnread: 0, lastUpdatedAt: now },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
}

/**
 * Редкий полный пересчёт unread для одной пары (userId, dialogId) по окну lastSeenAt.
 */
export async function recalculateUserDialogUnread(
  tenantId: string,
  userId: string,
  dialogId: string,
  options?: { createdAtLte?: number }
): Promise<number> {
  const uid = (userId || '').trim().toLowerCase();
  const memberJoinedAt = await getDialogMemberJoinedAt(tenantId, uid, dialogId);
  if (memberJoinedAt == null) {
    return 0;
  }

  const unreadBySenderAgg = await aggregateUnreadBySender(
    tenantId,
    uid,
    dialogId,
    memberJoinedAt,
    options?.createdAtLte
  );
  const unreadCount = unreadBySenderAgg.reduce((sum, row) => sum + row.count, 0);

  const now = generateTimestamp();
  await UserDialogStats.findOneAndUpdate(
    { tenantId, userId: uid, dialogId },
    {
      $set: { unreadCount, lastUpdatedAt: now },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  const byType: Record<string, number> = {};
  for (const t of PACK_UNREAD_SENDER_TYPES) {
    byType[t] = 0;
  }
  for (const row of unreadBySenderAgg) {
    const fromType = normalizeSenderType(await getUserType(tenantId, row._id));
    byType[fromType] = (byType[fromType] ?? 0) + row.count;
  }

  for (const fromType of PACK_UNREAD_SENDER_TYPES) {
    await UserDialogUnreadBySenderType.findOneAndUpdate(
      { tenantId, userId: uid, dialogId, fromType },
      {
        $set: { countUnread: byType[fromType] ?? 0, lastUpdatedAt: now },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  return unreadCount;
}
