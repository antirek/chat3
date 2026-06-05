import { DialogMember, UserDialogActivity, UserDialogStats, UserDialogUnreadBySenderType } from '@chat3/models';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import type { ActorType } from '@chat3/models';

/**
 * Утилиты для управления участниками диалогов
 */

/**
 * Добавить участника в диалог
 * @param tenantId - ID организации
 * @param userId - ID пользователя
 * @param dialogId - ID диалога
 */
export async function addDialogMember(
  tenantId: string,
  userId: string,
  dialogId: string
): Promise<any> {
  try {
    const member = await DialogMember.create({
      userId,
      tenantId,
      dialogId
    });

    // Создаем запись активности
    const timestamp = generateTimestamp();
    await UserDialogActivity.findOneAndUpdate(
      { tenantId, userId, dialogId },
      {
        tenantId,
        userId,
        dialogId,
        lastSeenAt: timestamp,
        lastMessageAt: timestamp
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Added member ${userId} to dialog ${dialogId}`);
    return member;
  } catch (error: any) {
    console.error('Error adding dialog member:', error);
    throw error;
  }
}

/**
 * Удалить участника из диалога
 * КРИТИЧНО: Удаляет все связанные данные (UserDialogStats, UserDialogActivity) и обновляет счетчики
 * @param tenantId - ID организации
 * @param userId - ID пользователя
 * @param dialogId - ID диалога
 * @param sourceEventId - ID события для обновления счетчиков (опционально)
 * @param sourceEventType - Тип события для обновления счетчиков (опционально)
 * @param actorId - ID актора для истории счетчиков (опционально)
 * @param actorType - Тип актора для истории счетчиков (опционально)
 */
export async function removeDialogMember(
  tenantId: string,
  userId: string,
  dialogId: string,
  sourceEventId: string | null = null,
  sourceEventType: string | null = null,
  actorId: string | null = null,
  actorType: string | null = null
): Promise<void> {
  try {
    await UserDialogStats.deleteOne({
      tenantId,
      userId,
      dialogId
    });

    await UserDialogUnreadBySenderType.deleteMany({
      tenantId,
      userId,
      dialogId
    });

    // 2. Удаляем UserDialogActivity (hard delete)
    await UserDialogActivity.deleteOne({
      tenantId,
      userId,
      dialogId
    });

    // 3. Удаляем DialogMember
    await DialogMember.findOneAndDelete({
      userId,
      tenantId,
      dialogId
    });

    console.log(`✅ Removed member ${userId} from dialog ${dialogId}`);
  } catch (error: any) {
    console.error('Error removing dialog member:', error);
    throw error;
  }
}

/**
 * Обновить время последнего просмотра диалога
 * @param tenantId - ID организации
 * @param userId - ID пользователя
 * @param dialogId - ID диалога
 * @param timestamp - Опциональный timestamp (если не указан, используется текущее время)
 */
export async function updateLastSeen(
  tenantId: string,
  userId: string,
  dialogId: string,
  timestamp: number | null = null
): Promise<void> {
  try {
    const lastSeenAt = timestamp || generateTimestamp();
    await UserDialogActivity.findOneAndUpdate(
      { tenantId, userId, dialogId },
      { lastSeenAt },
      { upsert: true, new: true }
    );

    console.log(`✅ Updated last seen for user ${userId} in dialog ${dialogId}`);
  } catch (error: any) {
    console.error('Error updating last seen:', error);
    throw error;
  }
}

/**
 * Обновить время последнего сообщения в диалоге
 * @param tenantId - ID организации
 * @param userId - ID пользователя
 * @param dialogId - ID диалога
 * @param timestamp - Опциональный timestamp (если не указан, используется текущее время)
 */
export async function updateLastMessageAt(
  tenantId: string,
  userId: string,
  dialogId: string,
  timestamp: number | null = null
): Promise<void> {
  try {
    const lastMessageAt = timestamp || generateTimestamp();
    await UserDialogActivity.findOneAndUpdate(
      { tenantId, userId, dialogId },
      { lastMessageAt },
      { upsert: true, new: true }
    );

    console.log(`✅ Updated last message at for user ${userId} in dialog ${dialogId}`);
  } catch (error: any) {
    console.error('Error updating last message at:', error);
    throw error;
  }
}

/**
 * Получить участников диалога
 * @param tenantId - ID организации
 * @param dialogId - ID диалога
 * @returns Список участников диалога
 */
export async function getDialogMembers(
  tenantId: string,
  dialogId: string
): Promise<any[]> {
  try {
    const members = await DialogMember.find({
      tenantId,
      dialogId,
    }).populate('dialogId', 'name').select('-__v');

    return members;
  } catch (error: any) {
    console.error('Error getting dialog members:', error);
    throw error;
  }
}

export interface ApplyMarkDialogAllReadResult {
  finalUnreadCount: number;
  previousUnreadCount: number;
  lastSeenAt: number;
  lastMessageAt: number;
  sourceEventId: string | null;
}

/**
 * Обнулить счётчики непрочитанных по диалогу для пользователя (все сообщения считаем прочитанными).
 * Используется из setUnreadCount(0) и markAllRead. Создаёт событие для контекста счётчиков;
 * финальное событие dialog.member.changed с полными данными создаёт вызывающий код.
 */
export async function applyMarkDialogAllRead(
  tenantId: string,
  userId: string,
  dialogId: string,
  actorId: string,
  actorType: ActorType,
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

  if (currentUnreadCount === 0) {
    const activity = await UserDialogActivity.findOne({
      tenantId,
      userId,
      dialogId
    }).lean();
    return {
      finalUnreadCount: 0,
      previousUnreadCount: 0,
      lastSeenAt: activity?.lastSeenAt ?? timestamp,
      lastMessageAt: activity?.lastMessageAt ?? timestamp,
      sourceEventId: null
    };
  }

  const activity = await UserDialogActivity.findOne({
    tenantId,
    userId,
    dialogId
  }).lean();

  return {
    finalUnreadCount: 0,
    previousUnreadCount: currentUnreadCount,
    lastSeenAt: activity?.lastSeenAt ?? timestamp,
    lastMessageAt: activity?.lastMessageAt ?? timestamp,
    sourceEventId: null
  };
}
