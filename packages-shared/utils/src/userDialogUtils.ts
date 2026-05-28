import { DialogMember, MessageStatus, MessageReaction, User } from '@chat3/models';
import * as metaUtils from './metaUtils.js';

/**
 * Получение информации об отправителе сообщения
 */

interface SenderInfo {
  userId: string;
  createdAt: number | null;
  meta: Record<string, unknown>;
}

export async function getSenderInfo(
  tenantId: string, 
  senderId: string, 
  cache: Map<string, SenderInfo | null> = new Map(), 
  _options: Record<string, unknown> = {}
): Promise<SenderInfo | null> {
  if (!senderId) {
    return null;
  }

  const cacheKey = senderId;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
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

  const senderInfo: SenderInfo = {
    userId: senderId,
    createdAt: (user as { createdAt?: number })?.createdAt ?? null,
    meta: meta as Record<string, unknown>
  };

  cache.set(cacheKey, senderInfo);
  return senderInfo;
}

interface MetaRecord {
  key: string;
  value: unknown;
}

/**
 * Объединение meta записей в объект {key: value}
 */
export function mergeMetaRecords(records: MetaRecord[] = []): Record<string, unknown> {
  if (!records.length) {
    return {};
  }

  const result: Record<string, unknown> = {};
  records.forEach((record) => {
    result[record.key] = record.value;
  });

  return result;
}

interface StatusMessageMatrixItem {
  userType: string | null;
  status: string;
  count: number;
}

/**
 * Матрица текущих статусов получателей сообщения (исключая отправителя).
 * Для каждого userId берётся последняя запись MessageStatus по createdAt, затем считается
 * число получателей по паре (userType, status).
 */
export async function buildStatusMessageMatrix(
  tenantId: string,
  _messageId: string,
  senderId: string
): Promise<StatusMessageMatrixItem[]> {
  const normalizedSenderId = (senderId || '').trim().toLowerCase();

  return (await MessageStatus.aggregate([
    {
      $match: {
        tenantId,
        messageId: _messageId
      }
    },
    {
      $addFields: {
        normalizedUserId: { $toLower: { $ifNull: ['$userId', ''] } }
      }
    },
    {
      $match: {
        normalizedUserId: { $ne: normalizedSenderId }
      }
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$normalizedUserId',
        userType: { $first: '$userType' },
        status: { $first: '$status' }
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
  ])) as StatusMessageMatrixItem[];
}

interface ReactionSetItem {
  reaction: string;
  count: number;
  me: boolean;
}

/**
 * Формирование reactionSet для сообщения
 */
export async function buildReactionSet(
  tenantId: string, 
  _messageId: string, 
  currentUserId: string
): Promise<ReactionSetItem[]> {
  const allReactions = await MessageReaction.find({
    tenantId: tenantId,
    messageId: _messageId
  }).lean();

  const reactionMap = new Map<string, ReactionSetItem>();
  
  allReactions.forEach(r => {
    const reactionObj = r as { reaction: string; userId: string };
    const reactionType = reactionObj.reaction;
    if (!reactionMap.has(reactionType)) {
      reactionMap.set(reactionType, {
        reaction: reactionType,
        count: 0,
        me: false
      });
    }
    const item = reactionMap.get(reactionType)!;
    item.count++;
    if (reactionObj.userId === currentUserId) {
      item.me = true;
    }
  });
  
  return Array.from(reactionMap.values());
}

interface ContextUserInfo {
  userId: string;
  createdAt: number | null;
  meta: Record<string, unknown>;
  name?: string | null;
}

type FetchMetaFunction = (entityType: string, entityId: string) => Promise<Record<string, unknown>>;

/**
 * Получение информации о пользователе для контекста
 */
export async function getContextUserInfo(
  tenantId: string, 
  userId: string, 
  fetchMeta: FetchMetaFunction
): Promise<ContextUserInfo | null> {
  const contextUser = await User.findOne({
    userId: userId,
    tenantId: tenantId
  }).select('userId name createdAt').lean();

  if (contextUser) {
    const contextUserMeta = await fetchMeta('user', userId);
    return {
      userId: (contextUser as { userId: string }).userId,
      createdAt: (contextUser as { createdAt?: number })?.createdAt ?? null,
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

interface UserStats {
  dialogCount: number;
  unreadDialogsCount: number;
}

/**
 * Вычисляет статистику пользователя (dialogCount и unreadDialogsCount)
 * Используется в update-worker для создания UserUpdate
 * @param tenantId - ID тенанта
 * @param userId - ID пользователя
 * @returns {dialogCount: number, unreadDialogsCount: number}
 */
export async function getUserStats(tenantId: string, userId: string): Promise<UserStats> {
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
    ]) as Array<{ dialogCount: number; unreadDialogsCount: number }>;

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
