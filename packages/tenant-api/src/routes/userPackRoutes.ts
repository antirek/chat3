import express from 'express';
import * as userController from '../controllers/userController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validateUserId, validateDialogId } from '../validators/urlValidators/index.js';
import { validateQuery } from '../validators/middleware.js';
import { queryWithFilterSchema } from '../validators/schemas/index.js';

const router = express.Router();

/**
 * @swagger
 * /api/users/{userId}/packs:
 *   get:
 *     summary: Список паков пользователя
 *     description: |
 *       Возвращает паки, в которые входят диалоги пользователя. Поддерживает пагинацию, фильтрацию и сортировку.
 *       Для каждого пака возвращаются meta, stats (unreadCount, lastUpdatedAt, dialogCount).
 *     tags: [UserPacks]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Номер страницы
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Количество на странице
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: Фильтр (field,operator,value), например по unreadCount
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Поле сортировки (createdAt, unreadCount и т.д.)
 *       - in: query
 *         name: sortDirection
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Направление сортировки
 *     responses:
 *       200:
 *         description: Список паков пользователя
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       packId:
 *                         type: string
 *                       meta:
 *                         type: object
 *                       stats:
 *                         type: object
 *                         properties:
 *                           unreadCount:
 *                             type: integer
 *                           lastUpdatedAt:
 *                             type: number
 *                             nullable: true
 *                           dialogCount:
 *                             type: integer
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       400:
 *         description: Неверный формат filter
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal Server Error
 */
router.get(
  '/:userId/packs',
  apiAuth,
  requirePermission('read'),
  validateUserId,
  validateQuery(queryWithFilterSchema),
  userController.getUserPacks
);

/**
 * @swagger
 * /api/users/{userId}/dialogs/{dialogId}/packs:
 *   get:
 *     summary: Паки диалога
 *     description: Возвращает список паков, в которые входит указанный диалог. Доступно только участникам диалога.
 *     tags: [UserPacks]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *         description: Dialog ID
 *     responses:
 *       200:
 *         description: Список паков диалога
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       packId:
 *                         type: string
 *                       addedAt:
 *                         type: number
 *                       createdAt:
 *                         type: number
 *                         nullable: true
 *                       meta:
 *                         type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Диалог не найден или пользователь не участник
 *       500:
 *         description: Internal Server Error
 */
router.get(
  '/:userId/dialogs/:dialogId/packs',
  apiAuth,
  requirePermission('read'),
  validateUserId,
  validateDialogId,
  userController.getDialogPacks
);

export default router;
