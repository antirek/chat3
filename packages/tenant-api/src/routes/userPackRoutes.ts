import express from 'express';
import * as userPackController from '../controllers/userPackController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validateUserId, validateDialogId, validatePackId } from '../validators/urlValidators/index.js';
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
  userPackController.getUserPacks
);

/**
 * @swagger
 * /api/users/{userId}/packs/{packId}:
 *   get:
 *     summary: Пак в контексте пользователя
 *     description: |
 *       Возвращает данные пака (meta, stats по паку) и данные в контексте пользователя (userStats: unreadCount, lastUpdatedAt).
 *       Доступно только если пользователь участвует хотя бы в одном диалоге этого пака.
 *     tags: [UserPacks]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *         description: User ID
 *       - in: path
 *         name: packId
 *         required: true
 *         schema: { type: string }
 *         description: Pack ID (pck_xxx)
 *     responses:
 *       200:
 *         description: Пак с meta, stats и userStats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     packId: { type: string }
 *                     meta: { type: object }
 *                     stats:
 *                       type: object
 *                       properties:
 *                         dialogCount: { type: integer }
 *                         messageCount: { type: integer }
 *                         uniqueMemberCount: { type: integer }
 *                         sumMemberCount: { type: integer }
 *                         uniqueTopicCount: { type: integer }
 *                         sumTopicCount: { type: integer }
 *                         lastUpdatedAt: { type: number, nullable: true }
 *                     userStats:
 *                       type: object
 *                       properties:
 *                         unreadCount: { type: integer }
 *                         lastUpdatedAt: { type: number, nullable: true }
 *                         createdAt: { type: number, nullable: true }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Pack not found or user has no access }
 *       500: { description: Internal Server Error }
 */
router.get(
  '/:userId/packs/:packId',
  apiAuth,
  requirePermission('read'),
  validateUserId,
  validatePackId,
  userPackController.getUserPackById
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
  userPackController.getDialogPacks
);

export default router;
