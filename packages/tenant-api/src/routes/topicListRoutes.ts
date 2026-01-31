import express from 'express';
import { topicController } from '../controllers/topicController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validateQuery } from '../validators/middleware.js';
import { queryWithFilterSchema } from '../validators/schemas/index.js';

const router = express.Router();

/**
 * @swagger
 * /api/topics:
 *   get:
 *     summary: Get all topics for tenant (all dialogs)
 *     tags: [Topics]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: Filter by topicId, dialogId, meta.* (e.g. (topicId,eq,topic_xxx)&(dialogId,eq,dlg_xxx))
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort (e.g. (createdAt,desc) or (dialogId,asc))
 *     responses:
 *       200:
 *         description: List of topics
 *       400:
 *         description: Invalid filter format
 */
router.get(
  '/',
  apiAuth,
  requirePermission('read'),
  validateQuery(queryWithFilterSchema),
  topicController.getTenantTopics
);

export default router;
