import express from 'express';
import { eventController } from '../controllers/eventController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Event:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         tenantId:
 *           type: string
 *         eventType:
 *           type: string
 *           enum: [dialog.create, dialog.update, dialog.delete, message.create, message.update, message.delete, dialog.member.add, dialog.member.remove, dialog.member.update, message.status.create, message.status.update]
 *         entityType:
 *           type: string
 *           enum: [dialog, message, dialogMember, messageStatus, tenant]
 *         entityId:
 *           type: string
 *         actorId:
 *           type: string
 *         actorType:
 *           type: string
 *           enum: [user, system, bot, api]
 *         data:
 *           type: object
 *         metadata:
 *           type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Получить все события
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Номер страницы
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Количество событий на странице
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *         description: Фильтр по типу события
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *         description: Фильтр по типу сущности
 *       - in: query
 *         name: entityId
 *         schema:
 *           type: string
 *         description: Фильтр по ID сущности
 *       - in: query
 *         name: actorId
 *         schema:
 *           type: string
 *         description: Фильтр по ID актора
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Начальная дата фильтра
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Конечная дата фильтра
 *     responses:
 *       200:
 *         description: Список событий
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Event'
 *                 pagination:
 *                   type: object
 */
router.get('/', apiAuth, requirePermission('read'), eventController.getAll);

/**
 * @swagger
 * /api/events/stats:
 *   get:
 *     summary: Получить статистику по событиям
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Статистика по событиям
 */
router.get('/stats', apiAuth, requirePermission('read'), eventController.getStats);

/**
 * @swagger
 * /api/events/type/{eventType}:
 *   get:
 *     summary: Получить события по типу
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: eventType
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: События указанного типа
 */
router.get('/type/:eventType', apiAuth, requirePermission('read'), eventController.getByType);

/**
 * @swagger
 * /api/events/actor/{actorId}:
 *   get:
 *     summary: Получить события по актору
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: actorId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: События указанного актора
 */
router.get('/actor/:actorId', apiAuth, requirePermission('read'), eventController.getByActor);

/**
 * @swagger
 * /api/events/entity/{entityType}/{entityId}:
 *   get:
 *     summary: Получить события для конкретной сущности
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: События для указанной сущности
 */
router.get('/entity/:entityType/:entityId', apiAuth, requirePermission('read'), eventController.getEntityEvents);

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Получить событие по ID
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Информация о событии
 *       404:
 *         description: Событие не найдено
 */
router.get('/:id', apiAuth, requirePermission('read'), eventController.getById);

/**
 * @swagger
 * /api/events/cleanup:
 *   delete:
 *     summary: Удалить старые события
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               beforeDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Старые события удалены
 */
router.delete('/cleanup', apiAuth, requirePermission('delete'), eventController.deleteOld);

export default router;

