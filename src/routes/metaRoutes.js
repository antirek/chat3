import express from 'express';
import metaController from '../controllers/metaController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';

const router = express.Router();

/**
 * @swagger
 * /api/meta/{entityType}/{entityId}/{key}:
 *   get:
 *     summary: Get specific meta key for an entity
 *     tags: [Meta]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [user, dialog, message, tenant, system, dialogMember]
 *         description: Entity type
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Entity ID
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Meta key
 *     responses:
 *       200:
 *         description: Meta value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                     value:
 *                       type: string
 *       404:
 *         description: Entity or meta key not found
 */
router.get('/:entityType/:entityId/:key', apiAuth, requirePermission('read'), metaController.getMetaKey);

/**
 * @swagger
 * /api/meta/{entityType}/{entityId}/{key}:
 *   put:
 *     summary: Set or update meta tag for an entity
 *     tags: [Meta]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [user, dialog, message, tenant, system, dialogMember]
 *         description: Entity type
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Entity ID
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Meta key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *             properties:
 *               value:
 *                 description: Any value (string, number, boolean, object, array)
 *               dataType:
 *                 type: string
 *                 enum: [string, number, boolean, object, array]
 *                 default: string
 *             example:
 *               value: "Welcome to the chat!"
 *               dataType: "string"
 *     responses:
 *       200:
 *         description: Meta set successfully
 *       404:
 *         description: Entity not found
 */
router.put('/:entityType/:entityId/:key', apiAuth, requirePermission('write'), metaController.setMeta);

/**
 * @swagger
 * /api/meta/{entityType}/{entityId}/{key}:
 *   delete:
 *     summary: Delete meta key for an entity
 *     tags: [Meta]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [user, dialog, message, tenant, system, dialogMember]
 *         description: Entity type
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Entity ID
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Meta key
 *     responses:
 *       200:
 *         description: Meta deleted successfully
 *       404:
 *         description: Entity or meta key not found
 */
router.delete('/:entityType/:entityId/:key', apiAuth, requirePermission('delete'), metaController.deleteMeta);

/**
 * @swagger
 * /api/meta/{entityType}/{entityId}:
 *   get:
 *     summary: Get all meta tags for an entity
 *     tags: [Meta]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [user, dialog, message, tenant, system, dialogMember]
 *         description: Entity type
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Entity ID
 *     responses:
 *       200:
 *         description: Meta tags as key-value object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   additionalProperties: true
 *       404:
 *         description: Entity not found
 */
router.get('/:entityType/:entityId', apiAuth, requirePermission('read'), metaController.getMeta);

export default router;

