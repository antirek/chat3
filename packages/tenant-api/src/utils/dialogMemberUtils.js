import { DialogMember, UserDialogActivity, UserDialogStats } from '@chat3/models';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { updateUnreadCount, finalizeCounterUpdateContext } from '@chat3/utils/counterUtils.js';

/**
 * Утилиты для управления участниками диалогов
 */

/**
 * Добавить участника в диалог
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 */
export async function addDialogMember(tenantId, userId, dialogId) {
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
  } catch (error) {
    console.error('Error adding dialog member:', error);
    throw error;
  }
}

/**
 * Удалить участника из диалога
 * КРИТИЧНО: Удаляет все связанные данные (UserDialogStats, UserDialogActivity) и обновляет счетчики
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 * @param {String} [sourceEventId] - ID события для обновления счетчиков (опционально)
 * @param {String} [sourceEventType] - Тип события для обновления счетчиков (опционально)
 * @param {String} [actorId] - ID актора для истории счетчиков (опционально)
 * @param {String} [actorType] - Тип актора для истории счетчиков (опционально)
 */
export async function removeDialogMember(tenantId, userId, dialogId, sourceEventId = null, sourceEventType = null, actorId = null, actorType = null) {
  try {
    // 1. Получаем UserDialogStats перед удалением для обновления счетчиков
    const userDialogStats = await UserDialogStats.findOne({
      tenantId,
      userId,
      dialogId
    }).lean();
    
    const unreadCount = userDialogStats?.unreadCount || 0;
    
    // 2. Если unreadCount > 0, обновляем счетчики в UserStats перед удалением
    // КРИТИЧНО: Обновляем счетчики ДО удаления UserDialogStats, чтобы они были актуальными
    if (unreadCount > 0 && sourceEventId) {
      try {
        // Обновляем unreadCount с отрицательным delta (уменьшаем до 0)
        // Это обновит unreadDialogsCount и totalUnreadCount в UserStats
        await updateUnreadCount(
          tenantId,
          userId,
          dialogId,
          -unreadCount, // delta (уменьшаем до 0)
          sourceEventType || 'dialog.member.remove',
          sourceEventId,
          dialogId,
          actorId || 'system',
          actorType || 'system'
        );
      } catch (error) {
        console.error(`Error updating counters before removing member ${userId}:`, error);
        // Продолжаем удаление даже если обновление счетчиков не удалось
      }
    }
    
    // 3. Удаляем UserDialogStats (hard delete)
    await UserDialogStats.deleteOne({
      tenantId,
      userId,
      dialogId
    });
    
    // 4. Удаляем UserDialogActivity (hard delete)
    await UserDialogActivity.deleteOne({
      tenantId,
      userId,
      dialogId
    });
    
    // 5. Удаляем DialogMember
    await DialogMember.findOneAndDelete({
      userId,
      tenantId,
      dialogId
    });
    
    // КРИТИЧНО: Финализация контекста НЕ выполняется здесь,
    // она должна быть выполнена в контроллере после всех обновлений счетчиков
    
    console.log(`✅ Removed member ${userId} from dialog ${dialogId} (cleaned up UserDialogStats and UserDialogActivity)`);
  } catch (error) {
    console.error('Error removing dialog member:', error);
    throw error;
  }
}

/**
 * Обновить время последнего просмотра диалога
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 * @param {Number} [timestamp] - Опциональный timestamp (если не указан, используется текущее время)
 */
export async function updateLastSeen(tenantId, userId, dialogId, timestamp = null) {
  try {
    const lastSeenAt = timestamp || generateTimestamp();
    await UserDialogActivity.findOneAndUpdate(
      { tenantId, userId, dialogId },
      { lastSeenAt },
      { upsert: true, new: true }
    );

    console.log(`✅ Updated last seen for user ${userId} in dialog ${dialogId}`);
  } catch (error) {
    console.error('Error updating last seen:', error);
    throw error;
  }
}

/**
 * Обновить время последнего сообщения в диалоге
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 * @param {Number} [timestamp] - Опциональный timestamp (если не указан, используется текущее время)
 */
export async function updateLastMessageAt(tenantId, userId, dialogId, timestamp = null) {
  try {
    const lastMessageAt = timestamp || generateTimestamp();
    await UserDialogActivity.findOneAndUpdate(
      { tenantId, userId, dialogId },
      { lastMessageAt },
      { upsert: true, new: true }
    );

    console.log(`✅ Updated last message at for user ${userId} in dialog ${dialogId}`);
  } catch (error) {
    console.error('Error updating last message at:', error);
    throw error;
  }
}

/**
 * Получить участников диалога
 * @param {String} tenantId - ID организации
 * @param {String} dialogId - ID диалога
 * @returns {Array} Список участников диалога
 */
export async function getDialogMembers(tenantId, dialogId) {
  try {
    const members = await DialogMember.find({
      tenantId,
      dialogId,
    }).populate('dialogId', 'name').select('-__v');

    return members;
  } catch (error) {
    console.error('Error getting dialog members:', error);
    throw error;
  }
}

