import {
  UserDialogActivity,
  UserDialogStats
} from '@chat3/models';
import type { ActorType } from '@chat3/models';
import { generateTimestamp } from './timestampUtils.js';

/**
 * Обновить время последнего сообщения в диалоге для участника.
 */
export async function updateLastMessageAt(
  tenantId: string,
  userId: string,
  dialogId: string,
  timestamp: number | null = null
): Promise<void> {
  const lastMessageAt = timestamp || generateTimestamp();
  await UserDialogActivity.findOneAndUpdate(
    { tenantId, userId, dialogId },
    { lastMessageAt },
    { upsert: true, new: true }
  );
}

export interface ApplyMarkDialogAllReadResult {
  finalUnreadCount: number;
  previousUnreadCount: number;
  lastSeenAt: number;
  lastMessageAt: number;
  sourceEventId: string | null;
}

/**
 * Обнулить счётчики непрочитанных по диалогу для пользователя.
 * Финальное событие dialog.member.changed создаёт вызывающий код.
 */
export async function applyMarkDialogAllRead(
  tenantId: string,
  userId: string,
  dialogId: string,
  _actorId: string,
  _actorType: ActorType,
  options?: { lastSeenAt?: number }
): Promise<ApplyMarkDialogAllReadResult> {
  const timestamp = options?.lastSeenAt ?? generateTimestamp();

  const existingStats = await UserDialogStats.findOne({
    tenantId,
    userId,
    dialogId
  }).lean();
  const currentUnreadCount = existingStats?.unreadCount ?? 0;

  await UserDialogActivity.findOneAndUpdate(
    { tenantId, userId, dialogId },
    { lastSeenAt: timestamp },
    { upsert: true, new: true }
  );

  const activity = await UserDialogActivity.findOne({
    tenantId,
    userId,
    dialogId
  }).lean();

  if (currentUnreadCount === 0) {
    return {
      finalUnreadCount: 0,
      previousUnreadCount: 0,
      lastSeenAt: activity?.lastSeenAt ?? timestamp,
      lastMessageAt: activity?.lastMessageAt ?? timestamp,
      sourceEventId: null
    };
  }

  return {
    finalUnreadCount: 0,
    previousUnreadCount: currentUnreadCount,
    lastSeenAt: activity?.lastSeenAt ?? timestamp,
    lastMessageAt: activity?.lastMessageAt ?? timestamp,
    sourceEventId: null
  };
}
