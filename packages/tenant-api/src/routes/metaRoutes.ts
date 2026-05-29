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

/**
 * @swagger
 * /api/meta/index/{entityType}:
 *   post:
 *     summary: Register meta index definition(s)
 *     description: |
 *       DDL правил уникальности, обязательности и allowlist meta-ключей для тенанта.
 *       Один объект в теле — одно правило; массив `indexes` — пакетная регистрация.
 *       Query `dryRun=true` — только проверка существующих данных без записи.
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
 *           enum: [user, dialog, message, tenant, system, dialogMember, topic, pack]
 *         description: Entity type for index rules
 *       - in: query
 *         name: dryRun
 *         schema:
 *           type: boolean
 *           default: false
 *         description: If true, validate only (HTTP 200, definition not persisted)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/MetaIndexRule'
 *               - type: object
 *                 required: [indexes]
 *                 properties:
 *                   indexes:
 *                     type: array
 *                     minItems: 1
 *                     items:
 *                       $ref: '#/components/schemas/MetaIndexRule'
 *           examples:
 *             unique:
 *               summary: Unique key
 *               value:
 *                 keys: [contactId]
 *                 mode: unique
 *             requiredWithWhen:
 *               summary: Required keys when condition matches
 *               value:
 *                 keys: [phone, nickname]
 *                 mode: required
 *                 when:
 *                   key: type
 *                   op: eq
 *                   value: telegram
 *             allowlist:
 *               summary: Allowed meta key names
 *               value:
 *                 keys: [key, channel, externalId, label]
 *                 mode: allowed
 *             batch:
 *               summary: Multiple rules
 *               value:
 *                 indexes:
 *                   - keys: [contactId]
 *                     mode: unique
 *                   - keys: [contactId]
 *                     mode: required
 *     responses:
 *       201:
 *         description: Definition(s) registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/MetaIndexDefinition'
 *                     - type: array
 *                       items:
 *                         $ref: '#/components/schemas/MetaIndexDefinition'
 *                 message:
 *                   type: string
 *       200:
 *         description: Dry run passed (dryRun=true)
 *       400:
 *         description: Invalid spec (INVALID_INDEX_SPEC, INDEX_KEYS_REQUIRED, …)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MetaIndexError'
 *       409:
 *         description: Conflict with existing data or definition (DUPLICATE_INDEX, INDEX_CONFLICT_EXISTING_DATA, SCHEMA_CONFLICT_EXISTING_DATA, INDEX_DEFINITION_CONFLICT, INDEX_KEYS_NOT_IN_ALLOWLIST)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MetaIndexError'
 */
router.post(
  '/index/:entityType',
  apiAuth,
  requirePermission('write'),
  validateEntityType,
  validateBody(registerMetaIndexSchema),
  metaIndexController.registerDefinitions
);

/**
 * @swagger
 * /api/meta/index/{entityType}:
 *   get:
 *     summary: List meta index definitions for tenant
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
 *           enum: [user, dialog, message, tenant, system, dialogMember, topic, pack]
 *         description: Entity type
 *     responses:
 *       200:
 *         description: Index definitions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MetaIndexDefinition'
 */
router.get(
  '/index/:entityType',
  apiAuth,
  requirePermission('read'),
  validateEntityType,
  metaIndexController.listDefinitions
);

/**
 * @swagger
 * /api/meta/index/{entityType}/{indexId}:
 *   get:
 *     summary: Get one meta index definition
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
 *           enum: [user, dialog, message, tenant, system, dialogMember, topic, pack]
 *       - in: path
 *         name: indexId
 *         required: true
 *         schema:
 *           type: string
 *         description: Definition id (e.g. unique:contactId, required:phone, allowed:keys, or custom id)
 *         example: unique:contactId
 *     responses:
 *       200:
 *         description: Index definition
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/MetaIndexDefinition'
 *       404:
 *         description: Definition not found
 */
router.get(
  '/index/:entityType/:indexId',
  apiAuth,
  requirePermission('read'),
  validateEntityType,
  metaIndexController.getDefinition
);

/**
 * @swagger
 * /api/meta/index/{entityType}/{indexId}:
 *   delete:
 *     summary: Delete meta index definition
 *     description: Removes the definition; for `unique` mode also deletes MetaIndex slots.
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
 *           enum: [user, dialog, message, tenant, system, dialogMember, topic, pack]
 *       - in: path
 *         name: indexId
 *         required: true
 *         schema:
 *           type: string
 *         example: unique:contactId
 *     responses:
 *       200:
 *         description: Definition deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Index definition deleted
 *       404:
 *         description: Definition not found
 */
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

