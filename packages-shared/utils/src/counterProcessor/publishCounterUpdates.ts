import {
  PackStats,
  UserDialogStats,
  UserPackUnreadBySenderType
} from '@chat3/models';
import {
  createDialogMemberUpdate,
  createPackStatsUpdate,
  createUserPackStatsUpdate,
  createUserStatsUpdate
} from '../updateUtils.js';
import { buildUserPackStatsFromBySenderRows } from '../packStatsUtils.js';
import type { CounterSlice } from './types.js';

export async function publishCounterUpdates(slice: CounterSlice): Promise<void> {
  const {
    tenantId,
    userIds,
    userDialogs,
    packIds,
    sourceEventId,
    sourceEventType
  } = slice;

  const seenUsers = new Set<string>();
  for (const userId of userIds) {
    if (seenUsers.has(userId)) continue;
    seenUsers.add(userId);
    await createUserStatsUpdate(
      tenantId,
      userId,
      sourceEventId,
      sourceEventType,
      ['user.stats.totalUnreadCount', 'user.stats.unreadDialogsCount', 'user.stats.unreadBySenderType']
    );
  }

  const seenMember = new Set<string>();
  for (const { userId, dialogId } of userDialogs) {
    const key = `${userId}:${dialogId}`;
    if (seenMember.has(key)) continue;
    seenMember.add(key);
    const stats = await UserDialogStats.findOne({ tenantId, userId, dialogId }).lean();
    const unreadCount = (stats as { unreadCount?: number } | null)?.unreadCount ?? 0;
    await createDialogMemberUpdate(
      tenantId,
      dialogId,
      userId,
      sourceEventId,
      'dialog.member.changed',
      {
        dialog: { dialogId },
        member: {
          userId,
          meta: {},
          state: { unreadCount, lastSeenAt: null, lastMessageAt: null }
        },
        context: {
          eventType: sourceEventType,
          dialogId,
          userId,
          includedSections: ['dialog', 'member'],
          updatedFields: ['dialog.stats.unreadCount']
        }
      }
    );
  }

  for (const packId of packIds) {
    const packDoc = await PackStats.findOne({ tenantId, packId }).lean();
    if (packDoc) {
      const p = packDoc as {
        messageCount?: number;
        uniqueMemberCount?: number;
        sumMemberCount?: number;
        uniqueTopicCount?: number;
        sumTopicCount?: number;
        lastUpdatedAt?: number | null;
      };
      await createPackStatsUpdate(tenantId, packId, sourceEventId, sourceEventType, {
        messageCount: p.messageCount ?? 0,
        uniqueMemberCount: p.uniqueMemberCount ?? 0,
        sumMemberCount: p.sumMemberCount ?? 0,
        uniqueTopicCount: p.uniqueTopicCount ?? 0,
        sumTopicCount: p.sumTopicCount ?? 0,
        lastUpdatedAt: p.lastUpdatedAt ?? null
      });
    }

    const userPackRows = await UserPackUnreadBySenderType.find({ tenantId, packId }).lean();
    const byUser = new Map<string, Array<{ fromType: string; countUnread: number }>>();
    for (const row of userPackRows as Array<{ userId: string; fromType: string; countUnread: number }>) {
      const list = byUser.get(row.userId) ?? [];
      list.push({ fromType: row.fromType, countUnread: row.countUnread });
      byUser.set(row.userId, list);
    }

    for (const [userId, rows] of byUser) {
      const built = buildUserPackStatsFromBySenderRows(rows);
      await createUserPackStatsUpdate(
        tenantId,
        userId,
        packId,
        sourceEventId,
        sourceEventType,
        {
          unreadCount: built.unreadCount,
          lastUpdatedAt: built.lastUpdatedAt,
          unreadBySenderType: built.unreadBySenderType
        }
      );
    }
  }
}
