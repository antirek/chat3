import { UserDialogStats } from '@chat3/models';
import {
  createDialogMemberUpdate,
  createUserStatsUpdate
} from '../updateUtils.js';
import type { CounterSlice } from './types.js';

/**
 * update-worker уже пишет update.dialog с тем же ключом
 * (tenantId, eventId, userId, updateType, entityId=dialogId):
 * add/remove — fan-out createDialogUpdate, changed — createDialogMemberUpdate.
 * Повтор из counter-worker упирается в уникальный индекс и не публикуется.
 */
const DIALOG_UPDATE_ALREADY_PUBLISHED = new Set([
  'dialog.member.add',
  'dialog.member.remove',
  'dialog.member.changed'
]);

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
      ['user.stats.totalUnreadCount', 'user.stats.unreadDialogsCount', 'user.stats.unreadBySenderType', 'user.stats.packs.messages.totalUnreadCount', 'user.stats.packs.messages.unreadBySenderType', 'user.stats.statsVersion', 'user.stats.lastUpdatedAt', 'user.stats.packs.messages.lastUpdatedAt']
    );
  }

  const seenMember = new Set<string>();
  const dialogUpdateAlreadyPublished = DIALOG_UPDATE_ALREADY_PUBLISHED.has(sourceEventType);
  for (const { userId, dialogId } of userDialogs) {
    if (dialogUpdateAlreadyPublished) continue;
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
