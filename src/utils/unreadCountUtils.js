import { DialogMember, MessageStatus } from '../models/index.js';

/**
 * Утилиты для управления участниками диалогов и счетчиками непрочитанных сообщений
 */

/**
 * Увеличить счетчик непрочитанных сообщений для участника диалога
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 * @param {String} messageId - ID сообщения
 */
export async function incrementUnreadCount(tenantId, userId, dialogId, messageId = null) {
  try {
    const filter = {
      userId,
      tenantId,
      dialogId
    };

    const updateData = {
      $inc: { unreadCount: 1 },
      lastMessageAt: new Date(),
      updatedAt: new Date()
    };

    await DialogMember.findOneAndUpdate(
      filter,
      updateData,
      { upsert: true, new: true }
    );

    console.log(`✅ Incremented unread count for user ${userId} in dialog ${dialogId}`);
  } catch (error) {
    console.error('Error incrementing unread count:', error);
    throw error;
  }
}

/**
 * Уменьшить счетчик непрочитанных сообщений для участника диалога
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 * @param {Number} count - Количество для уменьшения (по умолчанию 1)
 */
export async function decrementUnreadCount(tenantId, userId, dialogId, count = 1) {
  try {
    const filter = {
      userId,
      tenantId,
      dialogId
    };

    // Убеждаемся, что счетчик не станет отрицательным
    const result = await DialogMember.findOneAndUpdate(
      filter,
      [
        {
          $set: {
            unreadCount: {
              $max: [0, { $add: ['$unreadCount', -count] }]
            },
            lastSeenAt: new Date(),
            updatedAt: new Date()
          }
        }
      ],
      { new: true }
    );

    if (result) {
      console.log(`✅ Decremented unread count for user ${userId} in dialog ${dialogId}`);
    }
  } catch (error) {
    console.error('Error decrementing unread count:', error);
    throw error;
  }
}

/**
 * Сбросить счетчик непрочитанных сообщений для участника диалога
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 */
export async function resetUnreadCount(tenantId, userId, dialogId) {
  try {
    const filter = {
      userId,
      tenantId,
      dialogId
    };

    await DialogMember.findOneAndUpdate(
      filter,
      {
        unreadCount: 0,
        lastSeenAt: new Date(),
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Reset unread count for user ${userId} in dialog ${dialogId}`);
  } catch (error) {
    console.error('Error resetting unread count:', error);
    throw error;
  }
}

/**
 * Получить счетчик непрочитанных сообщений для участника диалога
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 * @returns {Number} Количество непрочитанных сообщений
 */
export async function getUnreadCount(tenantId, userId, dialogId) {
  try {
    const filter = {
      userId,
      tenantId,
      dialogId
    };

    const result = await DialogMember.findOne(filter);
    return result ? result.unreadCount : 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

/**
 * Синхронизировать счетчики с реальными данными MessageStatus
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 */
export async function syncUnreadCount(tenantId, userId, dialogId) {
  try {
    // Получаем сообщения из диалога
    const { Message } = await import('../models/index.js');
    const messages = await Message.find({ dialogId, tenantId }).select('_id');
    const messageIds = messages.map(msg => msg._id);
    
    // Получаем реальное количество непрочитанных сообщений
    const realCount = await MessageStatus.countDocuments({
      userId,
      tenantId,
      messageId: { $in: messageIds },
      status: 'unread'
    });

    // Обновляем счетчик
    await DialogMember.findOneAndUpdate(
      {
        userId,
        tenantId,
        dialogId
      },
      {
        unreadCount: realCount,
        lastSeenAt: new Date(),
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Synced unread count for user ${userId} in dialog ${dialogId}: ${realCount} messages`);
    return realCount;
  } catch (error) {
    console.error('Error syncing unread count:', error);
    throw error;
  }
}

/**
 * Обновить счетчики при изменении статуса сообщения
 * @param {String} tenantId - ID организации
 * @param {String} messageId - ID сообщения
 * @param {String} userId - ID пользователя
 * @param {String} oldStatus - Старый статус
 * @param {String} newStatus - Новый статус
 */
export async function updateCountersOnStatusChange(tenantId, messageId, userId, oldStatus, newStatus) {
  try {
    // Получаем информацию о сообщении
    const { Message } = await import('../models/index.js');
    const message = await Message.findById(messageId);
    
    if (!message) return;

    const dialogId = message.dialogId;

    // Логика обновления счетчиков
    if (oldStatus === 'unread' && newStatus !== 'unread') {
      // Сообщение было непрочитанным, стало прочитанным/доставленным
      await decrementUnreadCount(tenantId, userId, dialogId);
    } else if (oldStatus !== 'unread' && newStatus === 'unread') {
      // Сообщение стало непрочитанным
      await incrementUnreadCount(tenantId, userId, dialogId, messageId);
    }

    console.log(`✅ Updated counters for user ${userId} in dialog ${dialogId}: ${oldStatus} -> ${newStatus}`);
  } catch (error) {
    console.error('Error updating counters on status change:', error);
    throw error;
  }
}

/**
 * Добавить участника в диалог
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 */
export async function addDialogMember(tenantId, userId, dialogId) {
  try {
    await DialogMember.create({
      userId,
      tenantId,
      dialogId,
      unreadCount: 0,
      lastSeenAt: new Date(),
      isActive: true
    });

    console.log(`✅ Added member ${userId} to dialog ${dialogId}`);
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
        lastSeenAt: new Date(),
        updatedAt: new Date()
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
      isActive: true
    }).populate('dialogId', 'name').select('-__v');

    return members;
  } catch (error) {
    console.error('Error getting dialog members:', error);
    throw error;
  }
}
