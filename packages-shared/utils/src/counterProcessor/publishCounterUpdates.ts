import { UserDialogStats } from '@chat3/models';
import {
  createDialogMemberUpdate,
  createUserStatsUpdate
} from '../updateUtils.js';
import type { CounterSlice } from './types.js';

export async function publishCounterUpdates(slice: CounterSlice): Promise<void> {
  const {
    tenantId,
    userIds,
    userDialogs,
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
      sourceEventType,
      {
        dialog: { dialogId },
        member: {
          userId,
          meta: {},
          state: { unreadCount, lastSeenAt: null, lastMessageAt: null }
        },
        context: {
          dialogId,
          userId,
          includedSections: ['dialog', 'member'],
          updatedFields: ['member.state.unreadCount', 'dialog.stats.unreadCount']
        }
      }
    );
  }
}
