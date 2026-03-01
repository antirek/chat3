import {
  Pack,
  PackLink,
  UserDialogStats,
  UserDialogUnreadBySenderType,
  UserPackUnreadBySenderType,
  UserUnreadBySenderType,
  UserStats,
  PackStats,
  DialogStats,
  DialogMember,
  Topic,
  CounterHistory
} from '@chat3/models';
import type { IPackStats } from '@chat3/models';
import mongoose from 'mongoose';
import { generateTimestamp } from './timestampUtils.js';
import { PACK_UNREAD_SENDER_TYPES, normalizeSenderType } from './packUnreadSenderTypes.js';
import { getUserType } from './userTypeUtils.js';

export interface PackAggregatedStats {
  messageCount: number;
  uniqueMemberCount: number;
  sumMemberCount: number;
  uniqueTopicCount: number;
  sumTopicCount: number;
}

interface UpdateOptions {
  sourceOperation: string;
  sourceEntityId: string;
  actorId?: string;
  actorType?: string;
  session?: mongoose.ClientSession | null;
}

async function saveCounterHistoryEntry(params: {
  tenantId: string;
  counterType: string;
  entityType: string;
  entityId: string;
  field: string;
  oldValue: number;
  newValue: number;
  sourceOperation: string;
  sourceEntityId: string;
  actorId?: string;
  actorType?: string;
}): Promise<void> {
  if (params.oldValue === params.newValue) {
    return;
  }

  try {
    await CounterHistory.create({
      tenantId: params.tenantId,
      counterType: params.counterType,
      entityType: params.entityType,
      entityId: params.entityId,
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
      delta: params.newValue - params.oldValue,
      operation: params.newValue >= params.oldValue ? 'increment' : 'decrement',
      sourceOperation: params.sourceOperation,
      sourceEntityId: params.sourceEntityId,
      actorId: params.actorId || 'system',
      actorType: params.actorType || 'system',
      createdAt: generateTimestamp()
    });
  } catch (error) {
    console.error('[packStatsUtils] Failed to save counter history entry', error);
  }
}

export async function getPackDialogIds(tenantId: string, packId: string): Promise<string[]> {
  const links = await PackLink.find({ tenantId, packId })
    .select('dialogId')
    .lean();
  return links.map((link) => link.dialogId);
}

export async function getPackIdsForDialog(tenantId: string, dialogId: string): Promise<string[]> {
  const links = await PackLink.find({ tenantId, dialogId })
    .select('packId')
    .lean();
  return links.map((link) => link.packId);
}

export async function calculatePackStats(
  tenantId: string,
  packId: string
): Promise<PackAggregatedStats> {
  const dialogIds = await getPackDialogIds(tenantId, packId);
  if (!dialogIds.length) {
    return {
      messageCount: 0,
      uniqueMemberCount: 0,
      sumMemberCount: 0,
      uniqueTopicCount: 0,
      sumTopicCount: 0
    };
  }

  const dialogStats = await DialogStats.find({ tenantId, dialogId: { $in: dialogIds } })
    .select('messageCount memberCount topicCount')
    .lean();

  const messageCount = dialogStats.reduce((acc, stat) => acc + (stat.messageCount || 0), 0);
  const sumMemberCount = dialogStats.reduce((acc, stat) => acc + (stat.memberCount || 0), 0);
  const sumTopicCount = dialogStats.reduce((acc, stat) => acc + (stat.topicCount || 0), 0);

  const uniqueMemberIds = await DialogMember.distinct('userId', {
    tenantId,
    dialogId: { $in: dialogIds }
  });

  const uniqueTopicIds = await Topic.distinct('topicId', {
    tenantId,
    dialogId: { $in: dialogIds }
  });

  return {
    messageCount,
    uniqueMemberCount: uniqueMemberIds.length,
    sumMemberCount,
    uniqueTopicCount: uniqueTopicIds.length,
    sumTopicCount
  };
}

export async function upsertPackStats(
  tenantId: string,
  packId: string,
  stats: PackAggregatedStats,
  options: UpdateOptions
): Promise<IPackStats | null> {
  const previous = await PackStats.findOne({ tenantId, packId }).lean();
  const timestamp = generateTimestamp();

  const update = {
    $set: {
      ...stats,
      lastUpdatedAt: timestamp
    },
    $setOnInsert: {
      createdAt: timestamp,
      tenantId,
      packId
    }
  };

  const queryOptions: { upsert: true; session?: mongoose.ClientSession } = { upsert: true };

  if (options.session) {
    queryOptions.session = options.session;
  }

  await PackStats.updateOne({ tenantId, packId }, update, queryOptions);

  const fields: Array<keyof PackAggregatedStats> = [
    'messageCount',
    'uniqueMemberCount',
    'sumMemberCount',
    'uniqueTopicCount',
    'sumTopicCount'
  ];

  for (const field of fields) {
    const oldValue = previous ? (previous[field] as number) || 0 : 0;
    const newValue = stats[field] ?? 0;

    await saveCounterHistoryEntry({
      tenantId,
      counterType: `packStats.${field}`,
      entityType: 'packStats',
      entityId: packId,
      field,
      oldValue,
      newValue,
      sourceOperation: options.sourceOperation,
      sourceEntityId: options.sourceEntityId,
      actorId: options.actorId,
      actorType: options.actorType
    });
  }

  const updated = await PackStats.findOne({ tenantId, packId }).lean<IPackStats | null>();

  return updated;
}

export async function recalculatePackStats(
  tenantId: string,
  packId: string,
  options: UpdateOptions
): Promise<IPackStats | null> {
  const stats = await calculatePackStats(tenantId, packId);
  return upsertPackStats(tenantId, packId, stats, options);
}

export type UserPackUnreadMap = Record<string, { unreadCount: number; lastUpdatedAt: number | null }>;

export type UnreadBySenderTypeItem = { fromType: string; countUnread: number };

export type UserPackUnreadBySenderMap = Record<
  string,
  { unreadCount: number; unreadBySenderType: UnreadBySenderTypeItem[]; lastUpdatedAt: number | null }
>;

/**
 * Пересчитывает UserPackUnreadBySenderType из UserDialogUnreadBySenderType по диалогам пака.
 * Возвращает по каждому userId снимок: unreadCount и unreadBySenderType по фиксированному списку типов.
 */
export async function recalculateUserPackUnreadBySenderType(
  tenantId: string,
  packId: string,
  options: UpdateOptions
): Promise<UserPackUnreadBySenderMap> {
  const dialogIds = await getPackDialogIds(tenantId, packId);
  if (!dialogIds.length) {
    const existing = await UserPackUnreadBySenderType.find({ tenantId, packId })
      .select('userId')
      .lean();
    const allUserIds = [...new Set(existing.map((d) => d.userId))];
    const now = generateTimestamp();
    for (const userId of allUserIds) {
      await UserPackUnreadBySenderType.deleteMany({ tenantId, packId, userId });
    }
    return allUserIds.reduce<UserPackUnreadBySenderMap>((acc, userId) => {
      acc[userId] = {
        unreadCount: 0,
        unreadBySenderType: PACK_UNREAD_SENDER_TYPES.map((ft) => ({ fromType: ft, countUnread: 0 })),
        lastUpdatedAt: now
      };
      return acc;
    }, {});
  }

  const agg = await UserDialogUnreadBySenderType.aggregate<{
    _id: { userId: string; fromType: string };
    countUnread: number;
  }>([
    { $match: { tenantId, dialogId: { $in: dialogIds } } },
    { $group: { _id: { userId: '$userId', fromType: '$fromType' }, countUnread: { $sum: '$countUnread' } } }
  ]);

  const byUserByType: Record<string, Record<string, number>> = {};
  for (const row of agg) {
    const { userId, fromType } = row._id;
    if (!byUserByType[userId]) byUserByType[userId] = {};
    byUserByType[userId][fromType] = row.countUnread;
  }

  const existingUserIds = await UserPackUnreadBySenderType.distinct('userId', { tenantId, packId });
  const allUserIds = [...new Set([...Object.keys(byUserByType), ...existingUserIds])];
  const now = generateTimestamp();

  for (const userId of allUserIds) {
    const byType = byUserByType[userId] || {};
    const ops = PACK_UNREAD_SENDER_TYPES.map((fromType) => ({
      updateOne: {
        filter: { tenantId, packId, userId, fromType },
        update: {
          $set: { countUnread: byType[fromType] ?? 0, lastUpdatedAt: now },
          $setOnInsert: { createdAt: now }
        },
        upsert: true
      }
    }));
    if (ops.length) await UserPackUnreadBySenderType.bulkWrite(ops, { ordered: false });
  }

  const result: UserPackUnreadBySenderMap = {};
  for (const userId of allUserIds) {
    const byType = byUserByType[userId] || {};
    const unreadBySenderType = PACK_UNREAD_SENDER_TYPES.map((ft) => ({
      fromType: ft,
      countUnread: byType[ft] ?? 0
    }));
    const unreadCount = unreadBySenderType.reduce((s, x) => s + x.countUnread, 0);
    result[userId] = {
      unreadCount,
      unreadBySenderType,
      lastUpdatedAt: now
    };
  }
  return result;
}

export interface UserPackStatsFromBySender {
  unreadCount: number;
  unreadBySenderType: UnreadBySenderTypeItem[];
  lastUpdatedAt: number | null;
  createdAt: number | null;
}

/**
 * Собирает stats.user для пака из строк UserPackUnreadBySenderType (unreadCount, unreadBySenderType по фиксированному списку).
 */
export function buildUserPackStatsFromBySenderRows(
  rows: Array<{ fromType: string; countUnread: number; lastUpdatedAt?: number; createdAt?: number }>
): UserPackStatsFromBySender {
  const byType: Record<string, number> = {};
  let lastUpdatedAt: number | null = null;
  let createdAt: number | null = null;
  for (const r of rows) {
    byType[r.fromType] = (byType[r.fromType] ?? 0) + r.countUnread;
    if (r.lastUpdatedAt != null && (lastUpdatedAt == null || r.lastUpdatedAt > lastUpdatedAt))
      lastUpdatedAt = r.lastUpdatedAt;
    if (r.createdAt != null && (createdAt == null || r.createdAt < createdAt)) createdAt = r.createdAt;
  }
  const unreadBySenderType = PACK_UNREAD_SENDER_TYPES.map((ft) => ({
    fromType: ft,
    countUnread: byType[ft] ?? 0
  }));
  const unreadCount = unreadBySenderType.reduce((s, x) => s + x.countUnread, 0);
  return { unreadCount, unreadBySenderType, lastUpdatedAt, createdAt };
}

/**
 * Декремент UserDialogUnreadBySenderType при отметке сообщения как прочитанного.
 * Вызывается из API (userDialogController) до публикации события и из тестов после MessageStatus.create().
 */
export async function decrementUserDialogUnreadBySenderTypeForRead(
  tenantId: string,
  dialogId: string,
  readerUserId: string,
  messageSenderId: string | null | undefined
): Promise<void> {
  const fromType = messageSenderId
    ? normalizeSenderType(await getUserType(tenantId, messageSenderId))
    : 'user';
  const reader = (readerUserId || '').trim().toLowerCase();
  const rowsBefore = await UserDialogUnreadBySenderType.find({
    tenantId,
    userId: reader,
    dialogId
  })
    .select('fromType countUnread')
    .lean();
  console.log(
    `[unreadBySenderType] before decrement: tenantId=${tenantId}, dialogId=${dialogId}, reader=${reader}, messageSenderId=${messageSenderId ?? 'null'}, fromType=${fromType}, existingRows=${JSON.stringify(rowsBefore)}`
  );
  const row = await UserDialogUnreadBySenderType.findOne({
    tenantId,
    userId: reader,
    dialogId,
    fromType
  })
    .select('countUnread')
    .lean();
  const prevCount = row?.countUnread ?? 0;
  const newCount = Math.max(0, prevCount - 1);
  const now = generateTimestamp();
  const updateResult = await UserDialogUnreadBySenderType.updateOne(
    { tenantId, userId: reader, dialogId, fromType },
    { $set: { countUnread: newCount, lastUpdatedAt: now } }
  );
  console.log(
    `[unreadBySenderType] decrement: tenantId=${tenantId}, dialogId=${dialogId}, readerUserId=${reader}, messageSenderId=${messageSenderId ?? 'null'}, fromType=${fromType}, prevCount=${prevCount}, newCount=${newCount}, matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`
  );

  // Декремент на уровне пользователя (UserUnreadBySenderType) и UserStats.totalUnreadCount
  if (prevCount > 0) {
    const userRow = await UserUnreadBySenderType.findOne({
      tenantId,
      userId: reader,
      fromType
    })
      .select('countUnread')
      .lean();
    const userPrev = userRow?.countUnread ?? 0;
    const userNew = Math.max(0, userPrev - 1);
    const now2 = generateTimestamp();
    await UserUnreadBySenderType.findOneAndUpdate(
      { tenantId, userId: reader, fromType },
      { $set: { countUnread: userNew, lastUpdatedAt: now2 } },
      { upsert: true, new: true }
    );
    const statsRow = await UserStats.findOne({ tenantId, userId: reader }).select('totalUnreadCount').lean();
    const currentTotal = (statsRow as { totalUnreadCount?: number } | null)?.totalUnreadCount ?? 0;
    const newTotal = Math.max(0, currentTotal - 1);
    await UserStats.findOneAndUpdate(
      { tenantId, userId: reader },
      { $set: { totalUnreadCount: newTotal, lastUpdatedAt: now2 }, $setOnInsert: { dialogCount: 0, unreadDialogsCount: 0, totalMessagesCount: 0, createdAt: now2 } },
      { upsert: true, new: true }
    );
  }
}

/**
 * Пересчёт UserUnreadBySenderType из UserDialogUnreadBySenderType для пользователя.
 * Обновляет также UserStats.totalUnreadCount (сумма по типам).
 */
export async function recalculateUserUnreadBySenderType(
  tenantId: string,
  userId: string
): Promise<{ totalUnreadCount: number; unreadBySenderType: Array<{ fromType: string; countUnread: number }> }> {
  const uid = (userId || '').trim().toLowerCase();
  const agg = await UserDialogUnreadBySenderType.aggregate<{ _id: string; countUnread: number }>([
    { $match: { tenantId, userId: uid } },
    { $group: { _id: '$fromType', countUnread: { $sum: '$countUnread' } } }
  ]);
  const byType: Record<string, number> = {};
  for (const t of PACK_UNREAD_SENDER_TYPES) {
    byType[t] = 0;
  }
  for (const r of agg) {
    if (PACK_UNREAD_SENDER_TYPES.includes(r._id as any)) {
      byType[r._id] = r.countUnread;
    } else {
      byType['user'] = (byType['user'] ?? 0) + r.countUnread;
    }
  }
  const now = generateTimestamp();
  for (const fromType of PACK_UNREAD_SENDER_TYPES) {
    const count = byType[fromType] ?? 0;
    await UserUnreadBySenderType.findOneAndUpdate(
      { tenantId, userId: uid, fromType },
      { $set: { countUnread: count, lastUpdatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true, new: true }
    );
  }
  const totalUnreadCount = PACK_UNREAD_SENDER_TYPES.reduce((s, ft) => s + (byType[ft] ?? 0), 0);
  await UserStats.findOneAndUpdate(
    { tenantId, userId: uid },
    { $set: { totalUnreadCount, lastUpdatedAt: now }, $setOnInsert: { dialogCount: 0, unreadDialogsCount: 0, totalMessagesCount: 0, createdAt: now } },
    { upsert: true, new: true }
  );
  const unreadBySenderType = PACK_UNREAD_SENDER_TYPES.map((ft) => ({
    fromType: ft,
    countUnread: byType[ft] ?? 0
  }));
  return { totalUnreadCount, unreadBySenderType };
}
