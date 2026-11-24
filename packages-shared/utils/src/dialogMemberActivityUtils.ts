import {
  UserDialogActivity,
  UserDialogStats
} from '@chat3/models';
import type { ActorType } from '@chat3/models';
import { generateTimestamp } from './timestampUtils.js';
import { zeroUserDialogUnread } from './counterProcessor/recalculateUserDialogUnread.js';

/** Max length of denormalized last-message preview for search (#17022). */
export const LAST_MESSAGE_SEARCH_TEXT_MAX = 500;

/**
 * Normalize message content for UserDialogActivity.lastMessageSearchText.
 */
export function toLastMessageSearchText(content: string | null | undefined): string {
  if (content == null || typeof content !== 'string') return '';
  return content.trim().toLowerCase().slice(0, LAST_MESSAGE_SEARCH_TEXT_MAX);
}

/**
 * Обновить время последнего сообщения в диалоге для участника.
 * Optional `content` denormalizes searchable preview text (#17022 / ADR-S-0038).
 */
export async function updateLastMessageAt(
  tenantId: string,
  userId: string,
  dialogId: string,
  timestamp: number | null = null,
  content?: string | null
): Promise<void> {
  const lastMessageAt = timestamp || generateTimestamp();
  const $set: Record<string, unknown> = { lastMessageAt };
  if (content !== undefined) {
    $set.lastMessageSearchText = toLastMessageSearchText(content);
  }
  // Не даём schema default выставить lastSeenAt = now: иначе первое сообщение
  // попадает в «уже прочитано» до инкремента unread.
  await UserDialogActivity.findOneAndUpdate(
    { tenantId, userId, dialogId },
    {
      $set,
      $setOnInsert: { lastSeenAt: 0 }
    },
    { upsert: true, setDefaultsOnInsert: false }
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
  await zeroUserDialogUnread(tenantId, userId, dialogId);

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
