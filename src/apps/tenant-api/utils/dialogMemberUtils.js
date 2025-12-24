import { DialogMember } from '../../../models/index.js';
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
      dialogId,
      lastSeenAt: generateTimestamp(),
    });

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
 */
export async function updateLastSeen(tenantId, userId, dialogId) {
  try {
    await DialogMember.findOneAndUpdate(
      {
        userId,
        tenantId,
        dialogId
      },
      {
        lastSeenAt: generateTimestamp()
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Updated last seen for user ${userId} in dialog ${dialogId}`);
  } catch (error) {
    console.error('Error updating last seen:', error);
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

