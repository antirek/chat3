import { DialogMember, Dialog, Message, Meta, MessageStatus, MessageReaction, User } from '../../../models/index.js';
import * as metaUtils from './metaUtils.js';
import { parseFilters, extractMetaFilters } from './queryParser.js';

/**
 * Получение информации об отправителе сообщения
 */
export async function getSenderInfo(tenantId, senderId, cache = new Map(), metaOptions) {
  if (!senderId) {
    return null;
  }

  const cacheKey = metaOptions?.scope ? `${senderId}:${metaOptions.scope}` : senderId;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const user = await User.findOne({
    userId: senderId,
    tenantId
  })
    .select('userId name lastActiveAt createdAt updatedAt')
    .lean();

  const meta = await metaUtils.getEntityMeta(tenantId, 'user', senderId, metaOptions);

  if (!user && (!meta || Object.keys(meta).length === 0)) {
    cache.set(cacheKey, null);
    return null;
  }

  const senderInfo = {
    userId: senderId,
    lastActiveAt: user?.lastActiveAt ?? null,
    createdAt: user?.createdAt ?? null,
    updatedAt: user?.updatedAt ?? null,
    meta
  };

  cache.set(cacheKey, senderInfo);
  return senderInfo;
}

/**
 * Объединение meta записей для определенного scope
 */
export function mergeMetaRecordsForScope(records = [], scope) {
  if (!records.length) {
    return {};
  }

  const result = {};

  if (scope) {
    records
      .filter(record => record.scope === scope)
      .forEach((record) => {
        result[record.key] = record.value;
      });

    records
      .filter(record => record.scope === null || typeof record.scope === 'undefined')
      .forEach((record) => {
        if (!Object.prototype.hasOwnProperty.call(result, record.key)) {
          result[record.key] = record.value;
        }
      });
  } else {
    records
      .filter(record => record.scope === null || typeof record.scope === 'undefined')
      .forEach((record) => {
        result[record.key] = record.value;
      });
  }

  return result;
}

/**
 * Формирование матрицы статусов сообщения (исключая статусы текущего пользователя)
 */
export async function buildStatusMessageMatrix(tenantId, messageId, excludeUserId) {
  return await MessageStatus.aggregate([
    {
      $match: {
        tenantId: tenantId,
        messageId: messageId,
        userId: { $ne: excludeUserId }
      }
    },
    {
      $group: {
        _id: {
          userType: { $ifNull: ['$userType', null] },
          status: '$status'
        },
        count: { $sum: 1 }
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
export async function buildReactionSet(tenantId, messageId, currentUserId) {
  const allReactions = await MessageReaction.find({
    tenantId: tenantId,
    messageId: messageId
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
  }).select('userId name lastActiveAt createdAt updatedAt').lean();

  if (contextUser) {
    const contextUserMeta = await fetchMeta('user', userId);
    return {
      userId: contextUser.userId,
      lastActiveAt: contextUser.lastActiveAt ?? null,
      createdAt: contextUser.createdAt ?? null,
      updatedAt: contextUser.updatedAt ?? null,
      meta: contextUserMeta
    };
  } else {
    // Fallback: пользователь не существует в Chat3 API, но может быть meta теги
    const contextUserMeta = await fetchMeta('user', userId);
    if (contextUserMeta && Object.keys(contextUserMeta).length > 0) {
      return {
        userId: userId,
        name: null,
        lastActiveAt: null,
        createdAt: null,
        updatedAt: null,
        meta: contextUserMeta
      };
    }
  }
  return null;
}

