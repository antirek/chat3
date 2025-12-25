import { DialogMember, MessageStatus, MessageReaction, User } from '../../../models/index.js';
import * as metaUtils from './metaUtils.js';

/**
 * Получение информации об отправителе сообщения
 */
 
export async function getSenderInfo(tenantId, senderId, cache = new Map(), _options = {}) {
  if (!senderId) {
    return null;
  }

  const cacheKey = senderId;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const user = await User.findOne({
    userId: senderId,
    tenantId
  })
    .select('userId name createdAt')
    .lean();

  const meta = await metaUtils.getEntityMeta(tenantId, 'user', senderId);

  if (!user && (!meta || Object.keys(meta).length === 0)) {
    cache.set(cacheKey, null);
    return null;
  }

  const senderInfo = {
    userId: senderId,
    createdAt: user?.createdAt ?? null,
    meta
  };

  cache.set(cacheKey, senderInfo);
  return senderInfo;
}

/**
 * Объединение meta записей в объект {key: value}
 */
export function mergeMetaRecords(records = []) {
  if (!records.length) {
    return {};
  }

  const result = {};
  records.forEach((record) => {
    result[record.key] = record.value;
  });

  return result;
}

/**
 * Формирование матрицы статусов сообщения (исключая статусы отправителя сообщения)
 * 
 * ВАЖНО: Считает суммарные значения по всем статусам в истории для каждого userType и status.
 * Это означает, что если пользователь менял статус несколько раз (например: unread → delivered → read),
 * то каждая запись в истории будет учтена в матрице.
 * 
 * Пример:
 * Если пользователь marta (userType: "user") менял статус:
 * - unread (createdAt: 1000)
 * - delivered (createdAt: 2000)
 * - read (createdAt: 3000)
 * 
 * То в матрице будет:
 * [
 *   { userType: "user", status: "unread", count: 1 },
 *   { userType: "user", status: "delivered", count: 1 },
 *   { userType: "user", status: "read", count: 1 }
 * ]
 * 
 * Это позволяет видеть, сколько раз сообщение проходило через каждый статус.
 * 
 * Исключение отправителя обеспечивает единообразие матрицы для всех участников:
 * - Отправитель видит статусы всех получателей
 * - Получатели видят статусы других получателей (но не отправителя)
 * - Матрица одинакова для всех участников диалога
 * 
 * @param {string} tenantId - ID тенанта
 * @param {string} messageId - ID сообщения
 * @param {string} senderId - ID отправителя сообщения, статусы которого нужно исключить
 * @returns {Promise<Array>} Массив объектов { userType, status, count }
 */
export async function buildStatusMessageMatrix(tenantId, _messageId, senderId) {
  return await MessageStatus.aggregate([
    {
      $match: {
        tenantId: tenantId,
        messageId: _messageId,
        userId: { $ne: senderId } // Исключаем статусы отправителя сообщения
      }
    },
    // Группируем по userType и status, считая все записи в истории
    {
      $group: {
        _id: {
          userType: { $ifNull: ['$userType', null] },
          status: '$status'
        },
        count: { $sum: 1 } // Считаем все записи в истории, а не только последние
      }
    },
    {
      $project: {
        _id: 0,
        userType: '$_id.userType',
        status: '$_id.status',
        count: 1
      }
    },
    {
      $sort: {
        userType: 1,
        status: 1
      }
    }
  ]);
}

/**
 * Формирование reactionSet для сообщения
 */
export async function buildReactionSet(tenantId, _messageId, currentUserId) {
  const allReactions = await MessageReaction.find({
    tenantId: tenantId,
    messageId: _messageId
  }).lean();

  const reactionMap = new Map();
  
  allReactions.forEach(r => {
    const reactionType = r.reaction;
    if (!reactionMap.has(reactionType)) {
      reactionMap.set(reactionType, {
        reaction: reactionType,
        count: 0,
        me: false
      });
    }
    const item = reactionMap.get(reactionType);
    item.count++;
    if (r.userId === currentUserId) {
      item.me = true;
    }
  });
  
  return Array.from(reactionMap.values());
}

/**
 * Получение информации о пользователе для контекста
 */
export async function getContextUserInfo(tenantId, userId, fetchMeta) {
  const contextUser = await User.findOne({
    userId: userId,
    tenantId: tenantId
  }).select('userId name createdAt').lean();

  if (contextUser) {
    const contextUserMeta = await fetchMeta('user', userId);
    return {
      userId: contextUser.userId,
      createdAt: contextUser.createdAt ?? null,
      meta: contextUserMeta
    };
  } else {
    // Fallback: пользователь не существует в Chat3 API, но может быть meta теги
    const contextUserMeta = await fetchMeta('user', userId);
    if (contextUserMeta && Object.keys(contextUserMeta).length > 0) {
      return {
        userId: userId,
        name: null,
        createdAt: null,
        meta: contextUserMeta
      };
    }
  }
  return null;
}

/**
 * Вычисляет статистику пользователя (dialogCount и unreadDialogsCount)
 * Используется в update-worker для создания UserUpdate
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @returns {Promise<{dialogCount: number, unreadDialogsCount: number}>}
 */
export async function getUserStats(tenantId, userId) {
  try {
    const statsAggregation = await DialogMember.aggregate([
      {
        $match: {
          tenantId: tenantId,
          userId: userId
        }
      },
      {
        $group: {
          _id: '$userId',
          dialogCount: { $sum: 1 },
          unreadDialogsCount: {
            $sum: {
              $cond: [{ $gt: ['$unreadCount', 0] }, 1, 0]
            }
          }
        }
      }
    ]);

    return statsAggregation.length > 0 
      ? {
          dialogCount: statsAggregation[0].dialogCount,
          unreadDialogsCount: statsAggregation[0].unreadDialogsCount
        }
      : { dialogCount: 0, unreadDialogsCount: 0 };
  } catch (_error) {
    console.error(`Error getting user stats for user ${userId}:`, _error);
    return { dialogCount: 0, unreadDialogsCount: 0 };
  }
}

