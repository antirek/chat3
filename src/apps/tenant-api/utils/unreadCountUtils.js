import { DialogMember, MessageStatus, Message, UserDialogStats } from '../../../models/index.js';
import { generateTimestamp } from '../../../utils/timestampUtils.js';

/**
 * Утилиты для управления участниками диалогов и счетчиками непрочитанных сообщений
 */

/**
 * Увеличить счетчик непрочитанных сообщений для участника диалога
 * @deprecated Используйте counterUtils.updateUnreadCount вместо этой функции
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 * @param {String} messageId - ID сообщения
 * @param {Boolean} createIfNotExists - Создать участника, если его нет (по умолчанию false)
 */
export async function incrementUnreadCount(tenantId, userId, dialogId, _messageId = null, createIfNotExists = false) {
  try {
    // Обновляем lastMessageAt в DialogMember
    const filter = {
      userId,
      tenantId,
      dialogId
    };

    const updateData = {
      lastMessageAt: generateTimestamp()
    };

    const options = { new: true };
    if (createIfNotExists) {
      options.upsert = true;
    }

    const result = await DialogMember.findOneAndUpdate(
      filter,
      updateData,
      options
    );

    if (!result && !createIfNotExists) {
      console.warn(`⚠️  User ${userId} is not a member of dialog ${dialogId}, skipping unread count increment`);
      return null;
    }

    // Обновляем unreadCount в UserDialogStats
    await UserDialogStats.findOneAndUpdate(
      { tenantId, userId, dialogId },
      { $inc: { unreadCount: 1 } },
      { upsert: true, new: true }
    );

    console.log(`✅ Incremented unread count for user ${userId} in dialog ${dialogId}`);
    return result; // Возвращаем обновленный DialogMember
  } catch (error) {
    console.error('Error incrementing unread count:', error);
    throw error;
  }
}

/**
 * Уменьшить счетчик непрочитанных сообщений для участника диалога
 * @deprecated Используйте counterUtils.updateUnreadCount вместо этой функции
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 * @param {Number} count - Количество для уменьшения (по умолчанию 1)
 */
export async function decrementUnreadCount(tenantId, userId, dialogId, count = 1) {
  try {
    // Обновляем lastSeenAt в DialogMember
    await DialogMember.findOneAndUpdate(
      { userId, tenantId, dialogId },
      { $set: { lastSeenAt: generateTimestamp() } }
    );

    // Обновляем unreadCount в UserDialogStats с защитой от отрицательных значений
    const stats = await UserDialogStats.findOneAndUpdate(
      { tenantId, userId, dialogId },
      [
        {
          $set: {
            unreadCount: {
              $max: [0, { $add: ['$unreadCount', -count] }]
            }
          }
        }
      ],
      { upsert: true, new: true }
    );

    if (stats) {
      console.log(`✅ Decremented unread count for user ${userId} in dialog ${dialogId}`);
    }
  } catch (error) {
    console.error('Error decrementing unread count:', error);
    throw error;
  }
}

/**
 * Сбросить счетчик непрочитанных сообщений для участника диалога
 * @deprecated Используйте counterUtils.updateUnreadCount вместо этой функции
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 */
export async function resetUnreadCount(tenantId, userId, dialogId) {
  try {
    // Обновляем lastSeenAt в DialogMember
    await DialogMember.findOneAndUpdate(
      { userId, tenantId, dialogId },
      { $set: { lastSeenAt: generateTimestamp() } },
      { upsert: true, new: true }
    );

    // Сбрасываем unreadCount в UserDialogStats
    await UserDialogStats.findOneAndUpdate(
      { tenantId, userId, dialogId },
      { $set: { unreadCount: 0 } },
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

    // unreadCount теперь хранится в UserDialogStats, не в DialogMember
    // Эта функция устарела, используйте counterUtils.getUnreadCount или UserDialogStats напрямую
    const { UserDialogStats } = await import('../../../models/index.js');
    const stats = await UserDialogStats.findOne({ tenantId, userId, dialogId });
    return stats ? stats.unreadCount : 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

/**
 * Синхронизировать счетчики с реальными данными MessageStatus
 * @deprecated Используйте counterUtils.recalculateUserStats вместо этой функции
 * @param {String} tenantId - ID организации
 * @param {String} userId - ID пользователя
 * @param {String} dialogId - ID диалога
 */
export async function syncUnreadCount(tenantId, userId, dialogId) {
  try {
    // Получаем сообщения из диалога
    const messages = await Message.find({ dialogId, tenantId }).select('_id');
    const messageIds = messages.map(msg => msg._id);
    
    // Получаем реальное количество непрочитанных сообщений
    const realCount = await MessageStatus.countDocuments({
      userId,
      tenantId,
      messageId: { $in: messageIds },
      status: 'unread'
    });

    // Обновляем lastSeenAt в DialogMember
    await DialogMember.findOneAndUpdate(
      { userId, tenantId, dialogId },
      { $set: { lastSeenAt: generateTimestamp() } },
      { upsert: true, new: true }
    );

    // Обновляем счетчик в UserDialogStats
    await UserDialogStats.findOneAndUpdate(
      { tenantId, userId, dialogId },
      { $set: { unreadCount: realCount } },
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
 * @param {String} messageId - ID сообщения (строка msg_*)
 * @param {String} userId - ID пользователя (кто читает)
 * @param {String} oldStatus - Старый статус ('unread', 'delivered', 'read', или null)
 * @param {String} newStatus - Новый статус
 * @returns {Object|null} - Обновленный DialogMember или null если декремент не выполнен
 */
export async function updateCountersOnStatusChange(tenantId, _messageId, userId, oldStatus, newStatus) {
  try {
    // Получаем информацию о сообщении
    const message = await Message.findOne({ messageId: _messageId, tenantId: tenantId });
    
    if (!message) {
      console.warn(`⚠️  Message ${_messageId} not found, skipping counter update`);
      return null;
    }

    const dialogId = message.dialogId;

    // Проверяем, что пользователь читает НЕ свое сообщение
    if (message.senderId === userId) {
      console.log(`ℹ️ User ${userId} is the sender of message ${_messageId}, skipping counter update`);
      return null;
    }

    // Декремент счетчика только при переходе в статус 'read' и если ранее не был 'read'
    if (oldStatus !== 'read' && newStatus === 'read') {
      // Сообщение было непрочитанным/доставленным, теперь прочитано
      // Обновляем lastSeenAt в DialogMember
      await DialogMember.findOneAndUpdate(
        { userId, tenantId, dialogId },
        { $set: { lastSeenAt: generateTimestamp() } }
      );

      // Декрементируем unreadCount в UserDialogStats только если счетчик > 0
      const stats = await UserDialogStats.findOne({ tenantId, userId, dialogId });
      if (stats && stats.unreadCount > 0) {
        await UserDialogStats.findOneAndUpdate(
          { tenantId, userId, dialogId },
          { $inc: { unreadCount: -1 } },
          { new: true }
        );
        console.log(`✅ Decremented unread count for user ${userId} in dialog ${dialogId}: ${oldStatus || 'null'} -> ${newStatus}`);
        return { userId, dialogId }; // Возвращаем объект для совместимости
      } else {
        console.log(`ℹ️ No decrement for user ${userId} in dialog ${dialogId} (count is 0 or member not found)`);
        return null;
      }
    }

    console.log(`ℹ️ No counter update needed for user ${userId}: ${oldStatus || 'null'} -> ${newStatus}`);
    return null;
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
