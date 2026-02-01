import express from 'express';
import { topicController } from '../controllers/topicController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validateDialogId, validateTopicId } from '../validators/urlValidators/index.js';
import { validateQuery, validateBody } from '../validators/middleware.js';
import { queryWithFilterSchema, patchTopicSchema } from '../validators/schemas/index.js';

const router = express.Router();

/**
 * @swagger
 * /api/dialogs/{dialogId}/topics:
 *   get:
 *     summary: Get all topics for a dialog
 *     tags: [Topics]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
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
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of topics
 *       403:
 *         description: User is not a member of the dialog
 *       404:
 *         description: Dialog not found
 */
router.get(
  '/:dialogId/topics',
  apiAuth,
  requirePermission('read'),
  validateDialogId,
  validateQuery(queryWithFilterSchema),
  topicController.getDialogTopics
);

/**
 * @swagger
 * /api/dialogs/{dialogId}/topics:
 *   post:
 *     summary: Create a new topic
 *     tags: [Topics]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               meta:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       201:
 *         description: Topic created
 *       403:
 *         description: User is not a member of the dialog
 *       404:
 *         description: Dialog not found
 */
router.post(
  '/:dialogId/topics',
  apiAuth,
  requirePermission('write'),
  validateDialogId,
  topicController.createTopic
);

/**
 * @swagger
 * /api/dialogs/{dialogId}/topics/{topicId}:
 *   get:
 *     summary: Get topic by ID
 *     tags: [Topics]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: topicId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Topic details
 *       404:
 *         description: Topic not found
 */
router.get(
  '/:dialogId/topics/:topicId',
  apiAuth,
  requirePermission('read'),
  validateDialogId,
  validateTopicId,
  topicController.getTopic
);

/**
 * @swagger
 * /api/dialogs/{dialogId}/topics/{topicId}:
 *   patch:
 *     summary: Update topic (meta tags)
 *     tags: [Topics]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: topicId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               meta:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: Topic updated
 *       404:
 *         description: Topic not found
 */
router.patch(
  '/:dialogId/topics/:topicId',
  apiAuth,
  requirePermission('write'),
  validateDialogId,
  validateTopicId,
  validateBody(patchTopicSchema),
  topicController.updateTopic
);

export default router;
