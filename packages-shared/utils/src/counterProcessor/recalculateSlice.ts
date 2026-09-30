import { UserDialogStats, UserDialogUnreadBySenderType } from '@chat3/models';
import {
  recalculateDialogStats,
  updateUserStatsDialogCount
} from '../counterUtils.js';
import {
  getPackIdsForDialog,
  recalculatePackStats,
  recalculateUserPackUnreadBySenderType,
  recalculateUserUnreadBySenderType,
  recalculateUserPackedMessagesUnreadBySenderType
} from '../packStatsUtils.js';
import { applyHotUnread } from './applyHotUnread.js';
import { applyHotMessageCount } from './applyHotMessageCount.js';
import { recalculateUserDialogUnread } from './recalculateUserDialogUnread.js';
import { recalculateMessageStatusStats } from './recalculateMessageStatusStats.js';
import type { CounterSlice } from './types.js';

export async function recalculateSlice(slice: CounterSlice): Promise<void> {
  const {
    tenantId,
    userDialogs,
    userIds,
    dialogIds,
    messageIds,
    packIds,
    sourceEventId,
    sourceEventType,
    actorId,
    actorType
  } = slice;

  const options = {
    sourceOperation: sourceEventType,
    sourceEntityId: sourceEventId,
    actorId: actorId || 'system',
    actorType: actorType || 'system'
  };

  const hotHandled = await applyHotUnread(slice);

  const seenPairs = new Set<string>();
  for (const { userId, dialogId } of userDialogs) {
    const key = `${userId}:${dialogId}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    if (sourceEventType === 'dialog.member.remove') {
      await UserDialogStats.deleteOne({ tenantId, userId, dialogId });
      await UserDialogUnreadBySenderType.deleteMany({ tenantId, userId, dialogId });
      continue;
    }
    if (hotHandled) continue;
    await recalculateUserDialogUnread(tenantId, userId, dialogId, {
      createdAtLte: slice.sourceEventCreatedAt
    });
  }

  const seenUsers = new Set<string>();
  for (const userId of userIds) {
    if (seenUsers.has(userId)) continue;
    seenUsers.add(userId);
    await recalculateUserUnreadBySenderType(tenantId, userId);
    await recalculateUserPackedMessagesUnreadBySenderType(tenantId, userId);
  }

  if (sourceEventType === 'dialog.member.add' || sourceEventType === 'dialog.member.remove') {
    for (const userId of userIds) {
      await updateUserStatsDialogCount(
        tenantId,
        userId,
        sourceEventType === 'dialog.member.add' ? 1 : -1,
        sourceEventType,
        sourceEventId,
        actorId || 'system',
        actorType || 'system'
      );
    }
  }

  const messageCountApplied = await applyHotMessageCount(slice);

  for (const dialogId of dialogIds) {
    await recalculateDialogStats(tenantId, dialogId, {
      skipMessageCount: messageCountApplied
    });
  }

  const seenMessages = new Set<string>();
  for (const messageId of messageIds) {
    if (seenMessages.has(messageId)) continue;
    seenMessages.add(messageId);
    await recalculateMessageStatusStats(tenantId, messageId);
  }

  const allPackIds = new Set(packIds);
  for (const dialogId of dialogIds) {
    const extra = await getPackIdsForDialog(tenantId, dialogId);
    for (const p of extra) allPackIds.add(p);
  }

  for (const packId of allPackIds) {
    await recalculatePackStats(tenantId, packId, options);
    await recalculateUserPackUnreadBySenderType(tenantId, packId, options);
  }
}
