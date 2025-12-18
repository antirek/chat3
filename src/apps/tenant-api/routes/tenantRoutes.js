import express from 'express';
import { tenantController } from '../controllers/tenantController.js';
import { apiAuth, requirePermission, apiAuthForTenantCreation } from '../middleware/apiAuth.js';
import { validateBody, validateQuery } from '../validators/middleware.js';
import { createTenantSchema, paginationSchema } from '../validators/schemas/index.js';

const router = express.Router();

/**
 * @swagger
 * /api/tenants:
 *   get:
 *     summary: Get all tenants
 *     tags: [Tenants]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of tenants
 *       401:
 *         description: Unauthorized
 */
router.get('/', apiAuth, requirePermission('read'), validateQuery(paginationSchema), tenantController.getAll);

/**
 * @swagger
 * /api/tenants/{tenantId}:
 *   get:
 *     summary: Get tenant by tenantId
 *     tags: [Tenants]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID (e.g., tnt_default)
 *     responses:
 *       200:
 *         description: Tenant details with meta tags
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     tenantId:
 *                       type: string
 *                     createdAt:
 *                       type: number
 *                     meta:
 *                       type: object
 *                       additionalProperties: true
 *       404:
 *         description: Tenant not found
 */
router.get('/:id', apiAuth, requirePermission('read'), tenantController.getById);

/**
 * @swagger
 * /api/tenants:
 *   post:
 *     summary: Create new tenant
 *     tags: [Tenants]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tenantId:
 *                 type: string
 *                 maxLength: 20
 *                 description: Tenant ID (optional, auto-generated if not provided)
 *               meta:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Meta tags for the tenant (optional)
 *     responses:
 *       201:
 *         description: Tenant created
 *       400:
 *         description: Validation error
 */
router.post('/', apiAuthForTenantCreation, validateBody(createTenantSchema), tenantController.create);

/**
 * @swagger
 * /api/tenants/{tenantId}:
 *   delete:
 *     summary: Delete tenant by tenantId
 *     tags: [Tenants]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID (e.g., tnt_default)
 *     responses:
 *       200:
 *         description: Tenant deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 tenantId:
 *                   type: string
 *       404:
 *         description: Tenant not found
 */
router.delete('/:id', apiAuth, requirePermission('delete'), tenantController.delete);

export default router;

