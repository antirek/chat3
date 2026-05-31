import {
  UserDialogStats,
  UserPackUnreadBySenderType
} from '@chat3/models';
import {
  createDialogMemberUpdate,
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
      ['user.stats.totalUnreadCount', 'user.stats.unreadDialogsCount', 'user.stats.unreadBySenderType', 'user.stats.packs.messages.totalUnreadCount', 'user.stats.packs.messages.unreadBySenderType']
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
          eventType: 'dialog.member.changed',
          sourceEventType,
          dialogId,
          userId,
          includedSections: ['dialog', 'member'],
          updatedFields: ['dialog.stats.unreadCount']
        }
      }
    );
  }

  const seenUserPack = new Set<string>();
  for (const packId of packIds) {
    for (const userId of userIds) {
      const key = `${userId}:${packId}`;
      if (seenUserPack.has(key)) continue;
      seenUserPack.add(key);

      const rows = await UserPackUnreadBySenderType.find({ tenantId, packId, userId })
        .select('fromType countUnread lastUpdatedAt createdAt')
        .lean();
      const built = buildUserPackStatsFromBySenderRows(
        rows as Array<{ fromType: string; countUnread: number; lastUpdatedAt?: number | null; createdAt?: number | null }>
      );
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
