import { Pack, PackLink, PackStats, DialogMember, UserPackStats, Message } from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { loadPackMessages } from '../utils/packMessageUtils.js';
import { enrichMessagesWithMetaAndStatuses, getSenderInfo } from '../utils/messageEnrichment.js';
import { Response } from 'express';
import { parseFilters, buildFilterQuery } from '../utils/queryParser.js';
import type { AuthenticatedRequest } from '../middleware/apiAuth.js';

/**
 * Получить пак в контексте пользователя
 * GET /api/users/:userId/packs/:packId
 * Ответ: данные пака (meta, stats по паку) + userStats (unreadCount, lastUpdatedAt для пользователя).
 */
export async function getUserPackById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const routePath = 'get /users/:userId/packs/:packId';
  const log = (...args: any[]) => {
    console.log(`[${routePath}]`, ...args);
  };
  log('>>>>> start');

  try {
    const { userId, packId } = req.params;
    const tenantId = req.tenantId!;

    const pack = await Pack.findOne({ packId, tenantId }).select('-__v').lean();
    if (!pack) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Pack not found'
      });
      return;
    }

    const userDialogIds = (await DialogMember.find({ userId, tenantId }).select('dialogId').lean())
      .map((m: { dialogId: string }) => m.dialogId);
    const packDialogIds = (await PackLink.find({ packId, tenantId }).select('dialogId').lean())
      .map((l: { dialogId: string }) => l.dialogId);
    const hasAccess = userDialogIds.some((d) => packDialogIds.includes(d));
    if (!hasAccess) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Pack not found or user has no access (user is not in any dialog of this pack)'
      });
      return;
    }

    const [meta, dialogCount, packStatsDoc, userPackStatsDoc] = await Promise.all([
      metaUtils.getEntityMeta(tenantId, 'pack', packId),
      PackLink.countDocuments({ packId, tenantId }),
      PackStats.findOne({ tenantId, packId }).select('-__v').lean(),
      UserPackStats.findOne({ tenantId, userId, packId }).select('unreadCount lastUpdatedAt createdAt').lean()
    ]);

    const packStats = packStatsDoc as { messageCount?: number; uniqueMemberCount?: number; sumMemberCount?: number; uniqueTopicCount?: number; sumTopicCount?: number; lastUpdatedAt?: number } | null;
    const userStats = userPackStatsDoc as { unreadCount?: number; lastUpdatedAt?: number; createdAt?: number } | null;

    const data = {
      ...(pack as Record<string, unknown>),
      meta: meta || {},
      stats: {
        dialogCount,
        messageCount: packStats?.messageCount ?? 0,
        uniqueMemberCount: packStats?.uniqueMemberCount ?? 0,
        sumMemberCount: packStats?.sumMemberCount ?? 0,
        uniqueTopicCount: packStats?.uniqueTopicCount ?? 0,
        sumTopicCount: packStats?.sumTopicCount ?? 0,
        lastUpdatedAt: packStats?.lastUpdatedAt ?? null
      },
      userStats: {
        unreadCount: userStats?.unreadCount ?? 0,
        lastUpdatedAt: userStats?.lastUpdatedAt ?? null,
        createdAt: userStats?.createdAt ?? null
      }
    };

    res.json({
      data: sanitizeResponse(data)
    });
  } catch (error: any) {
    console.error('Error in getUserPackById:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  } finally {
    log('>>>>> end');
  }
}

/**
 * Получить список паков пользователя (паки, в диалогах которых пользователь участвует)
 * GET /api/users/:userId/packs
 * Ответ: для каждого пака секция stats (UserPackStats: unreadCount, lastUpdatedAt, createdAt).
 * Поддерживаются фильтр по unreadCount и сортировка по unreadCount.
 */
export async function getUserPacks(req: AuthenticatedRequest, res: Response): Promise<void> {
  const routePath = 'get /users/:userId/packs';
  const log = (...args: any[]) => {
    console.log(`[${routePath}]`, ...args);
  };
  log('>>>>> start');

  try {
    const { userId } = req.params;
    const tenantId = req.tenantId!;
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 10));
    const skip = (page - 1) * limit;
    const sortField = req.query.sort ? String(req.query.sort) : 'createdAt';
    const sortDirection = req.query.sortDirection === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

    log(`userId=${userId}, page=${page}, limit=${limit}, filter=${req.query.filter || 'нет'}, sort=${sortField}`);

    const userDialogIds = (await DialogMember.find({ userId, tenantId }).select('dialogId').lean())
      .map((m: any) => m.dialogId);

    if (userDialogIds.length === 0) {
      res.json({
        data: [],
        pagination: { page, limit, total: 0, pages: 0 }
      });
      return;
    }

    const candidatePackIds = await PackLink.find({
      dialogId: { $in: userDialogIds },
      tenantId
    })
      .distinct('packId')
      .exec();

    if (candidatePackIds.length === 0) {
      res.json({
        data: [],
        pagination: { page, limit, total: 0, pages: 0 }
      });
      return;
    }

    let packIdsFilter: string[] = candidatePackIds;
    let unreadCountCondition: Record<string, unknown> | undefined;

    if (req.query.filter) {
      try {
        const parsedFilters = parseFilters(String(req.query.filter)) as Record<string, unknown>;
        unreadCountCondition = parsedFilters.unreadCount as Record<string, unknown> | undefined;
        const restFilters = { ...parsedFilters };
        delete restFilters.unreadCount;

        const hasRestFilters = Object.keys(restFilters).length > 0;
        if (hasRestFilters) {
          const packQuery = await buildFilterQuery(tenantId, 'pack', restFilters);
          const candidateSet = new Set(candidatePackIds);
          const matchedByFilter = await Pack.find({ tenantId, ...packQuery })
            .select('packId')
            .lean();
          packIdsFilter = (matchedByFilter as any[])
            .map((p) => p.packId)
            .filter((id) => candidateSet.has(id));
        }

        if (unreadCountCondition !== undefined && packIdsFilter.length > 0) {
          const unreadPackIds = await UserPackStats.find({
            tenantId,
            userId,
            packId: { $in: packIdsFilter },
            unreadCount: unreadCountCondition as any
          })
            .distinct('packId')
            .exec();
          packIdsFilter = unreadPackIds;
        }
      } catch (err: any) {
        res.status(400).json({
          error: 'Bad Request',
          message: err.message || 'Invalid filter format'
        });
        return;
      }
    }

    const total = packIdsFilter.length;

    let pagePackIds: string[];
    let packs: any[];

    if (sortField === 'unreadCount') {
      const statsRows = await UserPackStats.find({
        tenantId,
        userId,
        packId: { $in: packIdsFilter }
      })
        .select('packId unreadCount lastUpdatedAt createdAt')
        .lean();
      const statsByPack = new Map(
        (statsRows as any[]).map((r) => [r.packId, { unreadCount: r.unreadCount ?? 0, lastUpdatedAt: r.lastUpdatedAt ?? null, createdAt: r.createdAt ?? null }])
      );
      const sortedPackIds = [...packIdsFilter].sort((a, b) => {
        const uA = statsByPack.get(a)?.unreadCount ?? 0;
        const uB = statsByPack.get(b)?.unreadCount ?? 0;
        return sortDirection === -1 ? uB - uA : uA - uB;
      });
      pagePackIds = sortedPackIds.slice(skip, skip + limit);
      packs = await Pack.find({ packId: { $in: pagePackIds }, tenantId })
        .select('-__v')
        .lean();
      packs.sort((a: any, b: any) => pagePackIds.indexOf(a.packId) - pagePackIds.indexOf(b.packId));
    } else {
      packs = await Pack.find({ packId: { $in: packIdsFilter }, tenantId })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .lean();
      pagePackIds = packs.map((p: any) => p.packId);
    }

    const metaByPack: Record<string, Record<string, unknown>> = {};
    for (const packId of pagePackIds) {
      metaByPack[packId] = await metaUtils.getEntityMeta(tenantId, 'pack', packId);
    }

    const [statsByPack, dialogCountByPack, packLinksForPage] = await Promise.all([
      pagePackIds.length > 0
        ? UserPackStats.find({ tenantId, userId, packId: { $in: pagePackIds } })
            .select('packId unreadCount lastUpdatedAt createdAt')
            .lean()
            .then((rows) => {
              const map = new Map<string, { unreadCount: number; lastUpdatedAt: number | null; createdAt: number | null }>();
              for (const row of rows as any[]) {
                map.set(row.packId, {
                  unreadCount: row.unreadCount ?? 0,
                  lastUpdatedAt: row.lastUpdatedAt ?? null,
                  createdAt: row.createdAt ?? null
                });
              }
              return map;
            })
        : Promise.resolve(new Map<string, { unreadCount: number; lastUpdatedAt: number | null; createdAt: number | null }>()),
      pagePackIds.length > 0
        ? PackLink.aggregate([
            { $match: { packId: { $in: pagePackIds }, tenantId } },
            { $group: { _id: '$packId', dialogCount: { $sum: 1 } } }
          ]).then((rows: any[]) => Object.fromEntries(rows.map((r) => [r._id, r.dialogCount ?? 0])))
        : Promise.resolve({} as Record<string, number>),
      pagePackIds.length > 0
        ? PackLink.find({ packId: { $in: pagePackIds }, tenantId })
            .select('packId dialogId')
            .lean()
        : Promise.resolve([])
    ]);

    const userDialogIdsSet = new Set(userDialogIds);
    const dialogToPackIds = new Map<string, string[]>();
    for (const link of packLinksForPage as { packId: string; dialogId: string }[]) {
      if (!userDialogIdsSet.has(link.dialogId)) continue;
      if (!dialogToPackIds.has(link.dialogId)) {
        dialogToPackIds.set(link.dialogId, []);
      }
      dialogToPackIds.get(link.dialogId)!.push(link.packId);
    }
    const allDialogIdsForPacks = [...dialogToPackIds.keys()];

    let lastMessageByPack = new Map<string, { messageId: string; content?: string; senderId: string; type: string; createdAt: number; dialogId: string }>();
    if (allDialogIdsForPacks.length > 0) {
      const recentMessages = await Message.find({
        tenantId,
        dialogId: { $in: allDialogIdsForPacks }
      })
        .sort({ createdAt: -1 })
        .limit(300)
        .select('messageId content senderId type createdAt dialogId')
        .lean();
      const assignedPacks = new Set<string>();
      for (const msg of recentMessages as any[]) {
        const packIds = dialogToPackIds.get(msg.dialogId) || [];
        for (const packId of packIds) {
          if (assignedPacks.has(packId)) continue;
          assignedPacks.add(packId);
          lastMessageByPack.set(packId, {
            messageId: msg.messageId,
            content: msg.content,
            senderId: msg.senderId,
            type: msg.type,
            createdAt: msg.createdAt,
            dialogId: msg.dialogId
          });
        }
        if (assignedPacks.size === pagePackIds.length) break;
      }
    }

    const senderIdsFromLastMessages = [...new Set(Array.from(lastMessageByPack.values()).map((m) => m.senderId).filter(Boolean))];
    const senderInfoCache = new Map();
    await Promise.all(
      senderIdsFromLastMessages.map((senderId) => getSenderInfo(tenantId, senderId, senderInfoCache))
    );

    const data = packs.map((p: any) => {
      const st = statsByPack.get(p.packId);
      const dialogCount = dialogCountByPack[p.packId] ?? 0;
      const lastMsg = lastMessageByPack.get(p.packId);
      let lastMessage: any = null;
      let lastActivityAt: number | null = null;
      if (lastMsg) {
        lastActivityAt = lastMsg.createdAt;
        lastMessage = {
          messageId: lastMsg.messageId,
          content: lastMsg.content,
          senderId: lastMsg.senderId,
          type: lastMsg.type,
          createdAt: lastMsg.createdAt,
          dialogId: lastMsg.dialogId
        };
        const senderInfo = senderInfoCache.get(lastMsg.senderId);
        if (senderInfo) lastMessage.senderInfo = senderInfo;
      }
      return {
        ...p,
        meta: metaByPack[p.packId] || {},
        stats: {
          unreadCount: st?.unreadCount ?? 0,
          lastUpdatedAt: st?.lastUpdatedAt ?? null,
          createdAt: st?.createdAt ?? null,
          dialogCount
        },
        lastMessage,
        lastActivityAt
      };
    });

    res.json({
      data: data.map((item) => sanitizeResponse(item)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Error in getUserPacks:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  } finally {
    log('>>>>> end');
  }
}

/**
 * Получить список паков для диалога (паки, в которые входит данный диалог)
 * GET /api/users/:userId/dialogs/:dialogId/packs
 */
export async function getDialogPacks(req: AuthenticatedRequest, res: Response): Promise<void> {
  const routePath = 'get /users/:userId/dialogs/:dialogId/packs';
  const log = (...args: any[]) => {
    console.log(`[${routePath}]`, ...args);
  };
  log('>>>>> start');

  try {
    const { userId, dialogId } = req.params;
    const tenantId = req.tenantId!;

    const isMember = await DialogMember.findOne({ userId, dialogId, tenantId });
    if (!isMember) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Dialog not found or user is not a member'
      });
      return;
    }

    const links = await PackLink.find({ dialogId, tenantId })
      .sort({ addedAt: -1 })
      .select('packId addedAt')
      .lean();

    const packIds = links.map((l: any) => l.packId);
    const metaByPack: Record<string, Record<string, unknown>> = {};
    for (const packId of packIds) {
      metaByPack[packId] = await metaUtils.getEntityMeta(tenantId, 'pack', packId);
    }

    const packs = await Pack.find({ packId: { $in: packIds }, tenantId })
      .select('-__v')
      .lean();

    const packMap = new Map<string, { packId: string; createdAt?: number }>(
      (packs as { packId: string; createdAt?: number }[]).map((p) => [p.packId, p])
    );
    const data = links.map((l: any) => {
      const pack = packMap.get(l.packId);
      return {
        packId: l.packId,
        addedAt: l.addedAt,
        ...(pack ? { createdAt: pack.createdAt } : {}),
        meta: metaByPack[l.packId] || {}
      };
    });

    res.json({
      data: data.map((item) => sanitizeResponse(item))
    });
  } catch (error: any) {
    console.error('Error in getDialogPacks:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  } finally {
    log('>>>>> end');
  }
}

/**
 * Диалоги пака в контексте пользователя — только те диалоги пака, где пользователь участник
 * GET /api/users/:userId/packs/:packId/dialogs
 */
export async function getPackDialogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const routePath = 'get /users/:userId/packs/:packId/dialogs';
  const log = (...args: any[]) => {
    console.log(`[${routePath}]`, ...args);
  };
  log('>>>>> start');

  try {
    const { userId, packId } = req.params;
    const tenantId = req.tenantId!;
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 10));
    const skip = (page - 1) * limit;

    const userDialogIds = (await DialogMember.find({ userId, tenantId }).select('dialogId').lean()).map(
      (m: { dialogId: string }) => m.dialogId
    );
    if (userDialogIds.length === 0) {
      res.json({
        data: [],
        pagination: { page, limit, total: 0, pages: 0 }
      });
      return;
    }

    const [links, total] = await Promise.all([
      PackLink.find({
        tenantId,
        packId,
        dialogId: { $in: userDialogIds }
      })
        .sort({ addedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('dialogId addedAt')
        .lean(),
      PackLink.countDocuments({
        tenantId,
        packId,
        dialogId: { $in: userDialogIds }
      })
    ]);

    res.json({
      data: (links as { dialogId: string; addedAt: number }[]).map((l) => ({ dialogId: l.dialogId, addedAt: l.addedAt })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Error in getPackDialogs:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  } finally {
    log('>>>>> end');
  }
}

/**
 * Сообщения пака в контексте пользователя (cursor pagination)
 * GET /api/users/:userId/packs/:packId/messages
 * Доступно только если пользователь участвует хотя бы в одном диалоге этого пака.
 */
export async function getPackMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  const routePath = 'get /users/:userId/packs/:packId/messages';
  const log = (...args: any[]) => {
    console.log(`[${routePath}]`, ...args);
  };
  log('>>>>> start');

  try {
    const { userId, packId } = req.params;
    const tenantId = req.tenantId!;
    const limitParam = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
    const parsedLimit = Number.isFinite(limitParam) ? limitParam : undefined;
    const filter =
      typeof req.query.filter === 'string' && req.query.filter.length > 0 ? String(req.query.filter) : null;
    const cursor =
      typeof req.query.cursor === 'string' && req.query.cursor.length > 0 ? String(req.query.cursor) : null;

    const userDialogIds = (await DialogMember.find({ userId, tenantId }).select('dialogId').lean()).map(
      (m: { dialogId: string }) => m.dialogId
    );
    const packDialogIds = (await PackLink.find({ packId, tenantId }).select('dialogId').lean()).map(
      (l: { dialogId: string }) => l.dialogId
    );
    const userDialogSet = new Set(userDialogIds);
    const allowedDialogIds = packDialogIds.filter((d) => userDialogSet.has(d));
    if (allowedDialogIds.length === 0) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Pack not found or user has no access (user is not in any dialog of this pack)'
      });
      return;
    }

    let packMessages;
    try {
      packMessages = await loadPackMessages({
        tenantId,
        packId,
        dialogIds: allowedDialogIds,
        limit: parsedLimit,
        filter,
        cursor
      });
    } catch (error: any) {
      if (error?.message === 'PACK_NOT_FOUND') {
        res.status(404).json({
          error: 'Not Found',
          message: 'Pack not found'
        });
        return;
      }
      if (error?.name === 'FILTER_ERROR') {
        res.status(400).json({
          error: 'Bad Request',
          message: error?.message || 'Invalid filter format'
        });
        return;
      }
      throw error;
    }

    if (packMessages.messages.length === 0) {
      res.json({
        data: [],
        cursor: packMessages.pageInfo.cursor,
        hasMore: packMessages.pageInfo.hasMore
      });
      return;
    }

    const enriched = await enrichMessagesWithMetaAndStatuses(packMessages.messages, tenantId);
    const dataWithSource = enriched.map((message) => ({
      ...message,
      sourceDialogId: message.dialogId,
      context: {
        userId,
        isMine: message.senderId === userId
      }
    }));

    res.json({
      data: sanitizeResponse(dataWithSource),
      cursor: packMessages.pageInfo.cursor,
      hasMore: packMessages.pageInfo.hasMore
    });
  } catch (error: any) {
    console.error('Error in getPackMessages:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  } finally {
    log('>>>>> end');
  }
}
