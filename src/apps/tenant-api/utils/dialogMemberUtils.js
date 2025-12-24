import { DialogMember, UserDialogActivity } from '../../../models/index.js';
import { generateTimestamp } from '../../../utils/timestampUtils.js';

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
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 */
export async function removeDialogMember(tenantId, userId, dialogId) {
  try {
    await DialogMember.findOneAndDelete({
      userId,
      tenantId,
      dialogId
    });

    console.log(`✅ Removed member ${userId} from dialog ${dialogId}`);
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

