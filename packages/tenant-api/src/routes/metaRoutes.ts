import express from 'express';
import metaController from '../controllers/metaController.js';
import metaIndexController from '../controllers/metaIndexController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { 
    validateEntityType, 
    validateEntityId, 
    validateMetaKey,
} from '../validators/urlValidators/index.js';
import { validateBody } from '../validators/middleware.js';
import {
  setMetaSchema,
  registerMetaIndexSchema,
  bulkSetMetaSchema,
  bulkDeleteMetaSchema
} from '../validators/schemas/index.js';

const router = express.Router();

router.post(
  '/index/:entityType',
  apiAuth,
  requirePermission('write'),
  validateEntityType,
  validateBody(registerMetaIndexSchema),
  metaIndexController.registerDefinitions
);

router.get(
  '/index/:entityType',
  apiAuth,
  requirePermission('read'),
  validateEntityType,
  metaIndexController.listDefinitions
);

router.get(
  '/index/:entityType/:indexId',
  apiAuth,
  requirePermission('read'),
  validateEntityType,
  metaIndexController.getDefinition
);

router.delete(
  '/index/:entityType/:indexId',
  apiAuth,
  requirePermission('write'),
  validateEntityType,
  metaIndexController.deleteDefinition
);

/**
 * @swagger
 * /api/meta/{entityType}/{entityId}/{key}:
 *   put:
 *     summary: Set or update meta tag for an entity
 *     tags: [Meta]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [user, dialog, message, tenant, system, dialogMember, topic]
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
router.put(
  '/:entityType/:entityId',
  apiAuth,
  requirePermission('write'),
  validateEntityType,
  validateEntityId,
  validateBody(bulkSetMetaSchema),
  metaController.setMetaBulk
);

router.delete(
  '/:entityType/:entityId',
  apiAuth,
  requirePermission('delete'),
  validateEntityType,
  validateEntityId,
  validateBody(bulkDeleteMetaSchema),
  metaController.deleteMetaBulk
);

router.put('/:entityType/:entityId/:key', 
    apiAuth, requirePermission('write'), validateEntityType, 
    validateEntityId, validateMetaKey, 
    validateBody(setMetaSchema), 
    metaController.setMeta);

/**
 * @swagger
 * /api/meta/{entityType}/{entityId}/{key}:
 *   delete:
 *     summary: Delete meta key for an entity
 *     tags: [Meta]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [user, dialog, message, tenant, system, dialogMember, topic]
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
router.delete('/:entityType/:entityId/:key', 
    apiAuth, 
    requirePermission('delete'), validateEntityType, 
    validateEntityId, validateMetaKey, 
    metaController.deleteMeta);

/**
 * @swagger
 * /api/meta/{entityType}/{entityId}:
 *   get:
 *     summary: Get all meta tags for an entity
 *     tags: [Meta]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [user, dialog, message, tenant, system, dialogMember, topic]
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
router.get('/:entityType/:entityId', apiAuth, requirePermission('read'), 
validateEntityType, validateEntityId, metaController.getMeta);

export default router;

