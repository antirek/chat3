import express from 'express';
import { packController } from '../controllers/packController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validatePackId, validateDialogId } from '../validators/urlValidators/index.js';
import { validateBody, validateQuery } from '../validators/middleware.js';
import { createPackSchema, addDialogToPackSchema, packMessagesQuerySchema } from '../validators/schemas/index.js';

const router = express.Router();

/**
 * @swagger
 * /api/packs:
 *   get:
 *     summary: Список паков
 *     description: Список паков с пагинацией, фильтрацией по meta и сортировкой. Для каждого пака — stats (dialogCount, messageCount и т.д.).
 *     tags: [Packs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: filter
 *         schema: { type: string }
 *         description: Фильтр по meta (field,operator,value)
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: createdAt }
 *       - in: query
 *         name: sortDirection
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200: { description: Список паков с pagination }
 *       400: { description: Неверный filter }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       500: { description: Internal Server Error }
 */
router.get(
  '/',
  apiAuth,
  requirePermission('read'),
  packController.list
);

/**
 * @swagger
 * /api/packs:
 *   post:
 *     summary: Создать пак
 *     description: Создаёт новый пак. Тело запроса пустое.
 *     tags: [Packs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *     requestBody: { required: true, content: { application/json: { schema: { type: object } } } }
 *     responses:
 *       201: { description: Пак создан }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       500: { description: Internal Server Error }
 */
router.post(
  '/',
  apiAuth,
  requirePermission('write'),
  validateBody(createPackSchema),
  packController.create
);

/**
 * @swagger
 * /api/packs/{packId}/dialogs:
 *   post:
 *     summary: Добавить диалог в пак
 *     tags: [Packs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: packId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dialogId]
 *             properties:
 *               dialogId: { type: string, example: "dlg_xxxxxxxxxxxxxxxxxxxx" }
 *     responses:
 *       201: { description: Диалог добавлен в пак }
 *       400: { description: Bad Request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Pack or Dialog not found }
 *       500: { description: Internal Server Error }
 */
router.post(
  '/:packId/dialogs',
  apiAuth,
  requirePermission('write'),
  validatePackId,
  validateBody(addDialogToPackSchema),
  packController.addDialog
);

/**
 * @swagger
 * /api/packs/{packId}/dialogs/{dialogId}:
 *   delete:
 *     summary: Удалить диалог из пака
 *     tags: [Packs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: packId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Диалог удалён из пака }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Dialog not found in pack }
 *       500: { description: Internal Server Error }
 */
router.delete(
  '/:packId/dialogs/:dialogId',
  apiAuth,
  requirePermission('write'),
  validatePackId,
  validateDialogId,
  packController.removeDialog
);

/**
 * @swagger
 * /api/packs/{packId}/dialogs:
 *   get:
 *     summary: Список диалогов пака
 *     tags: [Packs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: packId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Список диалогов с meta }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Pack not found }
 *       500: { description: Internal Server Error }
 */
router.get(
  '/:packId/dialogs',
  apiAuth,
  requirePermission('read'),
  validatePackId,
  packController.getDialogs
);

/**
 * @swagger
 * /api/packs/{packId}/messages:
 *   get:
 *     summary: Сообщения по паку (cursor pagination)
 *     description: Сообщения из всех диалогов пака, отсортированные по createdAt. Поддержка limit, cursor, filter.
 *     tags: [Packs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: packId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *       - in: query
 *         name: filter
 *         schema: { type: string }
 *     responses:
 *       200: { description: data, hasMore, cursor }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Pack not found }
 *       500: { description: Internal Server Error }
 */
router.get(
  '/:packId/messages',
  apiAuth,
  requirePermission('read'),
  validatePackId,
  validateQuery(packMessagesQuerySchema),
  packController.getMessages
);

/**
 * @swagger
 * /api/packs/{packId}:
 *   get:
 *     summary: Получить пак по ID
 *     tags: [Packs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: packId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Пак с meta и stats }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Pack not found }
 *       500: { description: Internal Server Error }
 */
router.get(
  '/:packId',
  apiAuth,
  requirePermission('read'),
  validatePackId,
  packController.getById
);

/**
 * @swagger
 * /api/packs/{packId}:
 *   delete:
 *     summary: Удалить пак
 *     tags: [Packs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: packId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Pack deleted }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Pack not found }
 *       500: { description: Internal Server Error }
 */
router.delete(
  '/:packId',
  apiAuth,
  requirePermission('delete'),
  validatePackId,
  packController.delete
);

export default router;
