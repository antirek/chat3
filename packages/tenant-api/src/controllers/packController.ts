import { Pack, PackLink, Dialog, PackStats, UserPackStats } from '@chat3/models';
import type { ActorType } from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import { parseFilters, buildFilterQuery } from '../utils/queryParser.js';
import { loadPackMessages } from '../utils/packMessageUtils.js';
import { enrichMessagesWithMetaAndStatuses } from '../utils/messageEnrichment.js';
import { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/apiAuth.js';

export const packController = {
  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const page = Math.max(1, parseInt(String(req.query.page)) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 10));
      const skip = (page - 1) * limit;
      const sortField = req.query.sort ? String(req.query.sort) : 'createdAt';
      const sortDirection = req.query.sortDirection === 'asc' ? 1 : -1;
      const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

      let query: Record<string, unknown> = { tenantId };
      if (req.query.filter) {
        try {
          const parsedFilters = parseFilters(String(req.query.filter));
          const metaQuery = await buildFilterQuery(tenantId, 'pack', parsedFilters);
          Object.assign(query, metaQuery);
        } catch (err: any) {
          res.status(400).json({
            error: 'Bad Request',
            message: err.message || 'Invalid filter format'
          });
          return;
        }
      }

      const [packs, total] = await Promise.all([
        Pack.find(query).sort(sort).skip(skip).limit(limit).select('-__v').lean(),
        Pack.countDocuments(query)
      ]);

      const packIds = (packs as any[]).map((p) => p.packId);
      const [metaByPack, countByPack, statsByPack] = await Promise.all([
        (async () => {
          const out: Record<string, Record<string, unknown>> = {};
          for (const packId of packIds) {
            out[packId] = await metaUtils.getEntityMeta(tenantId, 'pack', packId);
          }
          return out;
        })(),
        packIds.length > 0
          ? PackLink.aggregate([
              { $match: { tenantId, packId: { $in: packIds } } },
              { $group: { _id: '$packId', dialogCount: { $sum: 1 } } }
            ]).then((rows) => Object.fromEntries((rows as any[]).map((r) => [r._id, r.dialogCount])))
          : Promise.resolve({}),
        packIds.length > 0
          ? PackStats.find({ tenantId, packId: { $in: packIds } })
              .select('-__v')
              .lean()
              .then((rows) => Object.fromEntries((rows as any[]).map((row) => [row.packId, row])))
          : Promise.resolve({})
      ]);

      const data = (packs as any[]).map((p) => ({
        ...p,
        meta: metaByPack[p.packId] || {},
        stats: {
          dialogCount: countByPack[p.packId] ?? 0,
          messageCount: statsByPack[p.packId]?.messageCount ?? 0,
          uniqueMemberCount: statsByPack[p.packId]?.uniqueMemberCount ?? 0,
          sumMemberCount: statsByPack[p.packId]?.sumMemberCount ?? 0,
          uniqueTopicCount: statsByPack[p.packId]?.uniqueTopicCount ?? 0,
          sumTopicCount: statsByPack[p.packId]?.sumTopicCount ?? 0,
          lastUpdatedAt: statsByPack[p.packId]?.lastUpdatedAt ?? null
        }
      }));

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
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const pack = await Pack.create([{ tenantId }]);

      const created = pack[0];

      const { actorId, actorType } = resolveEventActor(req);
      const packSection = eventUtils.buildPackSection({
        packId: created.packId,
        tenantId,
        createdAt: created.createdAt,
        meta: {},
        stats: { dialogCount: 0 }
      });
      const packContext = eventUtils.buildEventContext({
        eventType: 'pack.create',
        entityId: created.packId,
        packId: created.packId,
        includedSections: ['pack'],
        updatedFields: ['pack']
      });

      await eventUtils.createEvent({
        tenantId,
        eventType: 'pack.create',
        entityType: 'pack',
        entityId: created.packId,
        actorId,
        actorType,
        data: eventUtils.composeEventData({
          context: packContext,
          pack: packSection
        })
      });

      res.status(201).json({
        data: sanitizeResponse({
          packId: created.packId,
          tenantId: created.tenantId,
          createdAt: created.createdAt
        })
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { packId } = req.params;
      const tenantId = req.tenantId!;

      const pack = await Pack.findOne({ packId, tenantId })
        .select('-__v')
        .lean();

      if (!pack) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Pack not found'
        });
        return;
      }

      const [meta, dialogCount, packStats] = await Promise.all([
        metaUtils.getEntityMeta(tenantId, 'pack', packId),
        PackLink.countDocuments({ packId, tenantId }),
        PackStats.findOne({ tenantId, packId }).select('-__v').lean()
      ]);

      res.json({
        data: sanitizeResponse({
          ...pack,
          meta,
          stats: {
            dialogCount,
            messageCount: packStats?.messageCount ?? 0,
            uniqueMemberCount: packStats?.uniqueMemberCount ?? 0,
            sumMemberCount: packStats?.sumMemberCount ?? 0,
            uniqueTopicCount: packStats?.uniqueTopicCount ?? 0,
            sumTopicCount: packStats?.sumTopicCount ?? 0,
            lastUpdatedAt: packStats?.lastUpdatedAt ?? null
          }
        })
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { packId } = req.params;
      const tenantId = req.tenantId!;

      const pack = await Pack.findOne({ packId, tenantId });

      if (!pack) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Pack not found'
        });
        return;
      }

      const [meta, dialogCount, packStatsDoc] = await Promise.all([
        metaUtils.getEntityMeta(tenantId, 'pack', packId),
        PackLink.countDocuments({ packId, tenantId }),
        PackStats.findOne({ tenantId, packId }).lean()
      ]);

      const packSection = eventUtils.buildPackSection({
        packId,
        tenantId,
        createdAt: pack.createdAt,
        meta,
        stats: {
          dialogCount,
          messageCount: packStatsDoc?.messageCount,
          uniqueMemberCount: packStatsDoc?.uniqueMemberCount,
          sumMemberCount: packStatsDoc?.sumMemberCount,
          uniqueTopicCount: packStatsDoc?.uniqueTopicCount,
          sumTopicCount: packStatsDoc?.sumTopicCount
        }
      });

      const packStatsSection = packStatsDoc
        ? eventUtils.buildPackStatsSection({
            packId,
            messageCount: packStatsDoc.messageCount,
            uniqueMemberCount: packStatsDoc.uniqueMemberCount,
            sumMemberCount: packStatsDoc.sumMemberCount,
            uniqueTopicCount: packStatsDoc.uniqueTopicCount,
            sumTopicCount: packStatsDoc.sumTopicCount,
            lastUpdatedAt: packStatsDoc.lastUpdatedAt ?? null
          })
        : null;

      const { actorId, actorType } = resolveEventActor(req);
      const packContext = eventUtils.buildEventContext({
        eventType: 'pack.delete',
        entityId: packId,
        packId,
        includedSections: ['pack', 'packStats'],
        updatedFields: ['pack', 'packStats']
      });

      await PackLink.deleteMany({ packId, tenantId });
      await PackStats.deleteOne({ tenantId, packId });
      await UserPackStats.deleteMany({ tenantId, packId });
      await Pack.deleteOne({ packId, tenantId });

      await eventUtils.createEvent({
        tenantId,
        eventType: 'pack.delete',
        entityType: 'pack',
        entityId: packId,
        actorId,
        actorType,
        data: eventUtils.composeEventData({
          context: packContext,
          pack: packSection,
          packStats: packStatsSection || undefined
        })
      });

      res.status(200).json({
        data: { packId },
        message: 'Pack deleted'
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  async addDialog(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { packId } = req.params;
      const { dialogId } = req.body as { dialogId: string };
      const tenantId = req.tenantId!;

      const pack = await Pack.findOne({ packId, tenantId });
      if (!pack) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Pack not found'
        });
        return;
      }

      const dialog = await Dialog.findOne({ dialogId, tenantId });
      if (!dialog) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
        return;
      }

      if (dialog.tenantId !== pack.tenantId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Dialog and pack must belong to the same tenant'
        });
        return;
      }

      const existing = await PackLink.findOne({ packId, dialogId });
      if (existing) {
        res.status(200).json({
          data: sanitizeResponse({
            packId,
            dialogId,
            addedAt: existing.addedAt,
            alreadyInPack: true
          }),
          message: 'Dialog already in pack'
        });
        return;
      }

      const link = await PackLink.create([{
        packId,
        dialogId,
        tenantId
      }]);

      const created = link[0];

      const [packMeta, dialogMeta, totalDialogs] = await Promise.all([
        metaUtils.getEntityMeta(tenantId, 'pack', packId),
        metaUtils.getEntityMeta(tenantId, 'dialog', dialogId),
        PackLink.countDocuments({ packId, tenantId })
      ]);

      const packSection = eventUtils.buildPackSection({
        packId,
        tenantId,
        createdAt: pack.createdAt,
        meta: packMeta,
        stats: { dialogCount: totalDialogs }
      });

      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdBy: (dialog as any).createdBy ?? null,
        createdAt: dialog.createdAt,
        meta: dialogMeta
      });

      const { actorId, actorType } = resolveEventActor(req);
      const packContext = eventUtils.buildEventContext({
        eventType: 'pack.dialog.add',
        entityId: packId,
        dialogId,
        packId,
        includedSections: ['pack', 'dialog'],
        updatedFields: ['pack.dialogs']
      });

      await eventUtils.createEvent({
        tenantId,
        eventType: 'pack.dialog.add',
        entityType: 'pack',
        entityId: packId,
        actorId,
        actorType,
        data: eventUtils.composeEventData({
          context: packContext,
          pack: packSection,
          dialog: dialogSection
        })
      });

      res.status(201).json({
        data: sanitizeResponse({
          packId,
          dialogId,
          addedAt: created.addedAt
        })
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  async removeDialog(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { packId, dialogId } = req.params;
      const tenantId = req.tenantId!;

      const pack = await Pack.findOne({ packId, tenantId });
      if (!pack) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Pack not found'
        });
        return;
      }

      const result = await PackLink.deleteOne({ packId, dialogId, tenantId });

      if (result.deletedCount === 0) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found in pack'
        });
        return;
      }

      const [packMeta, dialogMeta, totalDialogs, dialog] = await Promise.all([
        metaUtils.getEntityMeta(tenantId, 'pack', packId),
        metaUtils.getEntityMeta(tenantId, 'dialog', dialogId),
        PackLink.countDocuments({ packId, tenantId }),
        Dialog.findOne({ dialogId, tenantId })
      ]);

      const packSection = eventUtils.buildPackSection({
        packId,
        tenantId,
        createdAt: pack.createdAt,
        meta: packMeta,
        stats: { dialogCount: totalDialogs }
      });

      const dialogSection = dialog
        ? eventUtils.buildDialogSection({
            dialogId: dialog.dialogId,
            tenantId: dialog.tenantId,
            createdBy: (dialog as any).createdBy ?? null,
            createdAt: dialog.createdAt,
            meta: dialogMeta
          })
        : null;

      const { actorId, actorType } = resolveEventActor(req);
      const packContext = eventUtils.buildEventContext({
        eventType: 'pack.dialog.remove',
        entityId: packId,
        dialogId,
        packId,
        includedSections: ['pack', 'dialog'],
        updatedFields: ['pack.dialogs']
      });

      await eventUtils.createEvent({
        tenantId,
        eventType: 'pack.dialog.remove',
        entityType: 'pack',
        entityId: packId,
        actorId,
        actorType,
        data: eventUtils.composeEventData({
          context: packContext,
          pack: packSection,
          dialog: dialogSection || undefined
        })
      });

      res.status(200).json({
        data: { packId, dialogId },
        message: 'Dialog removed from pack'
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  async getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { packId } = req.params;
      const tenantId = req.tenantId!;

      const limitParam = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
      const parsedLimit = Number.isFinite(limitParam) ? limitParam : undefined;
      const filter = typeof req.query.filter === 'string' && req.query.filter.length > 0 ? String(req.query.filter) : null;
      const cursor = typeof req.query.cursor === 'string' && req.query.cursor.length > 0 ? String(req.query.cursor) : null;

      let packMessages;
      try {
        packMessages = await loadPackMessages({
          tenantId,
          packId,
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
        sourceDialogId: message.dialogId
      }));

      res.json({
        data: sanitizeResponse(dataWithSource),
        cursor: packMessages.pageInfo.cursor,
        hasMore: packMessages.pageInfo.hasMore
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  async getDialogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { packId } = req.params;
      const tenantId = req.tenantId!;
      const page = Math.max(1, parseInt(String(req.query.page)) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 10));
      const skip = (page - 1) * limit;

      const pack = await Pack.findOne({ packId, tenantId });
      if (!pack) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Pack not found'
        });
        return;
      }

      const [links, total] = await Promise.all([
        PackLink.find({ packId, tenantId })
          .sort({ addedAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('dialogId addedAt')
          .lean(),
        PackLink.countDocuments({ packId, tenantId })
      ]);

      res.json({
        data: links.map((l) => ({ dialogId: l.dialogId, addedAt: l.addedAt })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

function resolveEventActor(req: AuthenticatedRequest): { actorId: string; actorType: ActorType } {
  if (req.userId) {
    return { actorId: req.userId, actorType: 'user' };
  }

  const apiKeyName = typeof req.apiKey?.name === 'string' ? req.apiKey.name.trim() : '';
  if (apiKeyName) {
    return { actorId: apiKeyName, actorType: 'api' };
  }

  return { actorId: 'system', actorType: 'system' };
}
