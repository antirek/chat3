import { Message, UserDialogStats, UserDialogUnreadBySenderType, UserStats } from '@chat3/models';
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
import { generateTimestamp } from '../timestampUtils.js';
import { recalculateUserDialogUnread } from './recalculateUserDialogUnread.js';
import { recalculateMessageStatusStats } from './recalculateMessageStatusStats.js';
import type { CounterSlice } from './types.js';

async function refreshSenderMessageCount(tenantId: string, senderId: string): Promise<void> {
  const uid = (senderId || '').trim().toLowerCase();
  const totalMessagesCount = await Message.countDocuments({ tenantId, senderId: uid });
  await UserStats.findOneAndUpdate(
    { tenantId, userId: uid },
    {
      $set: { totalMessagesCount, lastUpdatedAt: generateTimestamp() },
      $setOnInsert: { createdAt: generateTimestamp(), dialogCount: 0, unreadDialogsCount: 0, totalUnreadCount: 0 }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

export async function recalculateSlice(slice: CounterSlice): Promise<void> {
  const {
    tenantId,
    userDialogs,
    userIds,
    dialogIds,
    messageIds,
    packIds,
    senderId,
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
    await recalculateUserDialogUnread(tenantId, userId, dialogId);
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

  if (senderId && sourceEventType === 'message.create') {
    await refreshSenderMessageCount(tenantId, senderId);
  }

  for (const dialogId of dialogIds) {
    await recalculateDialogStats(tenantId, dialogId);
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
