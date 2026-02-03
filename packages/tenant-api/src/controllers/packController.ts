import { Pack, PackLink, Dialog } from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { parseFilters, buildFilterQuery } from '../utils/queryParser.js';
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

      await PackLink.deleteMany({ packId, tenantId });
      await Pack.deleteOne({ packId, tenantId });

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
