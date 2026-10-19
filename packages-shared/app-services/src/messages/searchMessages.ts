import { Message, MessageStatus } from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import * as topicUtils from '@chat3/utils/topicUtils.js';
import {
  parseFilters,
  parseSort,
  buildFilterQuery
} from '@chat3/utils/queryParser.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import {
  getSenderInfo,
  buildStatusMessageMatrix,
  buildReactionSet
} from '@chat3/utils/userDialogUtils.js';
import { AppServiceError, isAppServiceError } from '../errors/AppServiceError.js';

export interface SearchMessagesInput {
  tenantId: string;
  page?: number;
  limit?: number;
  filter?: string | null;
  sort?: string | null;
}

export interface SearchMessagesPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface SearchMessagesResult {
  data: any[];
  pagination: SearchMessagesPagination;
}

/**
 * Tenant-wide message list/search (REST GET /api/messages parity).
 * No membership gate — integrator API-key scope.
 */
export async function searchMessages(
  input: SearchMessagesInput
): Promise<SearchMessagesResult> {
  const tenantId = input.tenantId;
  if (!tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const page = input.page && input.page > 0 ? input.page : 1;
  const limit = input.limit && input.limit > 0 ? input.limit : 10;
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = { tenantId };

  if (input.filter) {
    try {
      const parsedFilters = parseFilters(String(input.filter));
      const filterQuery = await buildFilterQuery(tenantId, 'message', parsedFilters);
      Object.assign(query, filterQuery);
    } catch (err: any) {
      if (isAppServiceError(err)) throw err;
      throw new AppServiceError('VALIDATION', err?.message || 'Invalid filter format');
    }
  }

  let sortOption: any = { createdAt: -1 };
  if (input.sort) {
    const parsed = parseSort(String(input.sort));
    if (parsed) {
      sortOption = parsed;
    } else {
      const sortMatch = String(input.sort).match(/\(([^,]+),([^)]+)\)/);
      if (sortMatch) {
        sortOption = { [sortMatch[1]]: sortMatch[2] === 'asc' ? 1 : -1 };
      }
    }
  }

  const [messages, total] = await Promise.all([
    Message.find(query)
      .select(
        'messageId dialogId senderId content type createdAt deleted deletedAt deletedBy edited editedAt editedBy topicId'
      )
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    Message.countDocuments(query)
  ]);

  const messageIds = messages.map((m) => m.messageId);
  const allStatuses = messageIds.length
    ? await MessageStatus.find({
        tenantId,
        messageId: { $in: messageIds }
      })
        .select('messageId userId userType tenantId status createdAt')
        .lean()
    : [];

  const statusesByMessage: Record<string, any[]> = {};
  for (const status of allStatuses) {
    if (!statusesByMessage[status.messageId]) {
      statusesByMessage[status.messageId] = [];
    }
    statusesByMessage[status.messageId].push(status);
  }

  const topicsByDialog = new Map<string, Set<string>>();
  for (const msg of messages) {
    if (msg.dialogId && msg.topicId) {
      if (!topicsByDialog.has(msg.dialogId)) {
        topicsByDialog.set(msg.dialogId, new Set());
      }
      topicsByDialog.get(msg.dialogId)!.add(msg.topicId);
    }
  }

  const topicsCache = new Map<string, Map<string, any>>();
  for (const [dialogId, topicIdSet] of topicsByDialog.entries()) {
    try {
      const topicsMap = await topicUtils.getTopicsWithMetaBatch(
        tenantId,
        dialogId,
        Array.from(topicIdSet)
      );
      topicsCache.set(dialogId, topicsMap);
    } catch {
      topicsCache.set(dialogId, new Map());
    }
  }

  const senderInfoCache = new Map<string, any>();

  const enriched = await Promise.all(
    messages.map(async (message) => {
      const meta = await metaUtils.getEntityMeta(tenantId, 'message', message.messageId);
      const topic =
        message.dialogId && message.topicId
          ? topicsCache.get(message.dialogId)?.get(message.topicId) || null
          : null;
      const statusMessageMatrix = await buildStatusMessageMatrix(
        tenantId,
        message.messageId,
        message.senderId
      );
      const reactionSet = await buildReactionSet(tenantId, message.messageId, null);
      const senderInfo = await getSenderInfo(tenantId, message.senderId, senderInfoCache);

      const senderNorm = String(message.senderId || '').toLowerCase();
      const messageStatuses = statusesByMessage[message.messageId] || [];
      const latestByUser = new Map<string, (typeof messageStatuses)[number]>();
      for (const row of messageStatuses) {
        const uid = String(row.userId || '').toLowerCase();
        if (!uid || uid === senderNorm) continue;
        const prev = latestByUser.get(uid);
        if (!prev || (row.createdAt || 0) > (prev.createdAt || 0)) {
          latestByUser.set(uid, row);
        }
      }

      return {
        ...message,
        meta,
        topic,
        statusMessageMatrix,
        reactionSet,
        senderInfo: senderInfo || null,
        statuses: Array.from(latestByUser.values())
      };
    })
  );

  return {
    data: sanitizeResponse(enriched) as any[],
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0
    }
  };
}
