import {
  PackLink,
  UserDialogStats,
  UserPackStats,
  PackStats,
  DialogStats,
  DialogMember,
  Topic,
  CounterHistory
} from '@chat3/models';
import type { IPackStats } from '@chat3/models';
import mongoose from 'mongoose';
import { generateTimestamp } from './timestampUtils.js';

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

export async function calculateUserPackUnread(
  tenantId: string,
  packId: string,
  userId: string
): Promise<number> {
  const dialogIds = await getPackDialogIds(tenantId, packId);
  if (!dialogIds.length) {
    return 0;
  }

  const result = await UserDialogStats.aggregate<{ totalUnread: number }>([
    { $match: { tenantId, userId, dialogId: { $in: dialogIds } } },
    { $group: { _id: null, totalUnread: { $sum: '$unreadCount' } } }
  ]);

  return result[0]?.totalUnread || 0;
}

export async function calculateUserPackUnreadMap(
  tenantId: string,
  packId: string,
  userIds?: string[]
): Promise<Record<string, number>> {
  const dialogIds = await getPackDialogIds(tenantId, packId);
  if (!dialogIds.length) {
    return {};
  }

  const matchStage: Record<string, unknown> = {
    tenantId,
    dialogId: { $in: dialogIds }
  };

  if (userIds && userIds.length) {
    matchStage.userId = { $in: userIds };
  }

  const result = await UserDialogStats.aggregate<{ _id: string; totalUnread: number }>([
    { $match: matchStage },
    { $group: { _id: '$userId', totalUnread: { $sum: '$unreadCount' } } }
  ]);

  return result.reduce<Record<string, number>>((acc, item) => {
    acc[item._id] = item.totalUnread;
    return acc;
  }, {});
}

export async function upsertUserPackUnread(
  tenantId: string,
  packId: string,
  userId: string,
  unreadCount: number,
  options: UpdateOptions
): Promise<void> {
  const previous = await UserPackStats.findOne({ tenantId, packId, userId })
    .select('unreadCount')
    .lean();

  const oldValue = previous?.unreadCount ?? 0;
  const timestamp = generateTimestamp();

  const updateQuery = {
    $set: {
      unreadCount,
      lastUpdatedAt: timestamp
    },
    $setOnInsert: {
      createdAt: timestamp,
      tenantId,
      packId,
      userId
    }
  };

  const updateOptions: { upsert: true; session?: mongoose.ClientSession } = { upsert: true };

  if (options.session) {
    updateOptions.session = options.session;
  }

  await UserPackStats.updateOne({ tenantId, packId, userId }, updateQuery, updateOptions);

  await saveCounterHistoryEntry({
    tenantId,
    counterType: 'userPackStats.unreadCount',
    entityType: 'userPackStats',
    entityId: `${packId}:${userId}`,
    field: 'unreadCount',
    oldValue,
    newValue: unreadCount,
    sourceOperation: options.sourceOperation,
    sourceEntityId: options.sourceEntityId,
    actorId: options.actorId,
    actorType: options.actorType
  });
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

export async function recalculateUserPackStats(
  tenantId: string,
  packId: string,
  options: UpdateOptions
): Promise<UserPackUnreadMap> {
  const unreadMap = await calculateUserPackUnreadMap(tenantId, packId);
  const existing = await UserPackStats.find({ tenantId, packId })
    .select('userId unreadCount')
    .lean();

  const existingUserIds = existing.map((item) => item.userId);
  const mapUserIds = Object.keys(unreadMap);
  const allUserIds = Array.from(new Set([...existingUserIds, ...mapUserIds]));

  for (const userId of allUserIds) {
    const targetUnread = unreadMap[userId] || 0;
    await upsertUserPackUnread(tenantId, packId, userId, targetUnread, options);
  }

  const updatedDocs = await UserPackStats.find({
    tenantId,
    packId,
    userId: { $in: allUserIds }
  })
    .select('userId unreadCount lastUpdatedAt')
    .lean();

  const result: UserPackUnreadMap = {};
  for (const doc of updatedDocs) {
    result[doc.userId] = {
      unreadCount: doc.unreadCount ?? 0,
      lastUpdatedAt: doc.lastUpdatedAt ?? null
    };
  }

  return result;
}
