import { DialogMember, UserDialogActivity, UserDialogStats, UserDialogUnreadBySenderType } from '@chat3/models';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

export {
  updateLastMessageAt,
  applyMarkDialogAllRead
} from '@chat3/utils/dialogMemberActivityUtils.js';
export type { ApplyMarkDialogAllReadResult } from '@chat3/utils/dialogMemberActivityUtils.js';

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
  _sourceEventId: string | null = null,
  _sourceEventType: string | null = null,
  _actorId: string | null = null,
  _actorType: string | null = null
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
