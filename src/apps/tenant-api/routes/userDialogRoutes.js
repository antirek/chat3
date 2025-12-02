import express from 'express';
import userDialogController from '../controllers/userDialogController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validateUserId, validateDialogId, validateMessageId } from '../validators/urlValidators/index.js';
import { validateQuery } from '../validators/middleware.js';
import { userDialogsQuerySchema } from '../validators/schemas/index.js';

const router = express.Router();

/**
 * @swagger
 * /api/users/{userId}/dialogs:
 *   get:
 *     summary: Get user's dialogs with pagination and sorting by last interaction
 *     tags: [UserDialogs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
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
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: includeLastMessage
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include last message for each dialog
 *     responses:
 *       200:
 *         description: User dialogs retrieved successfully
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
 *                       dialogId:
 *                         type: string
 *                       unreadCount:
 *                         type: integer
 *                       lastSeenAt:
 *                         type: string
 *                         format: date-time
 *                       lastMessageAt:
 *                         type: string
 *                         format: date-time
 *                       isActive:
 *                         type: boolean
 *                       joinedAt:
 *                         type: string
 *                         format: date-time
 *                       lastInteractionAt:
 *                         type: string
 *                         format: date-time
 *                       lastMessage:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           content:
 *                             type: string
 *                           senderId:
 *                             type: string
 *                           type:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get('/:userId/dialogs', apiAuth, requirePermission('read'), validateUserId, validateQuery(userDialogsQuerySchema), userDialogController.getUserDialogs);

/**
 * @swagger
 * /api/users/{userId}/dialogs/{dialogId}/messages:
 *   get:
 *     summary: Get messages from a dialog in context of specific user
 *     description: |
 *       Возвращает сообщения с контекстными данными пользователя (isMine, myReaction, statusMessageMatrix).
 *       Доступно только для участников диалога.
 *       
 *       **Важно**: 
 *       - `context.statuses` всегда возвращает `null` (устарело)
 *       - Для получения информации о статусах используйте `statusMessageMatrix` в корне каждого объекта сообщения
 *       - `statusMessageMatrix` содержит агрегированные данные о статусах других пользователей, исключая текущего
 *     tags: [UserDialogs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
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
 *           default: 50
 *         description: Number of messages per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: -createdAt
 *         description: Sort order (e.g., -createdAt for newest first)
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: Filter expression (e.g., (senderId,eq,john))
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
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
 *                       messageId:
 *                         type: string
 *                       dialogId:
 *                         type: string
 *                       senderId:
 *                         type: string
 *                       content:
 *                         type: string
 *                       type:
 *                         type: string
 *                       createdAt:
 *                         type: number
 *                       updatedAt:
 *                         type: number
 *                       reactionCounts:
 *                         type: object
 *                       meta:
 *                         type: object
 *                       context:
 *                         type: object
 *                         description: User-specific context data
 *                         properties:
 *                           userId:
 *                             type: string
 *                             description: ID of the user this context is for
 *                           isMine:
 *                             type: boolean
 *                             description: True if current user is the sender
 *                           statuses:
 *                             type: array
 *                             nullable: true
 *                             description: |
 *                               Статусы сообщения для текущего пользователя.
 *                               ⚠️ **DEPRECATED**: Всегда возвращает `null`.
 *                               Для получения информации о статусах используйте `statusMessageMatrix` в корне объекта сообщения.
 *                           myReaction:
 *                             type: string
 *                             nullable: true
 *                             description: Current user's reaction (emoji) or null
 *                       statusMessageMatrix:
 *                         type: array
 *                         description: |
 *                           Матрица статусов сообщения, сгруппированная по userType и status.
 *                           Исключает статусы текущего пользователя (userId из пути запроса).
 *                           
 *                           Каждый элемент матрицы содержит:
 *                           - userType: тип пользователя (user, bot, contact) или null
 *                           - status: статус сообщения (sent, unread, delivered, read)
 *                           - count: количество пользователей данного типа с данным статусом
 *                           
 *                           Пример:
 *                           [
 *                             {count: 2, userType: "bot", status: "unread"},
 *                             {count: 1, userType: "user", status: "read"},
 *                             {count: 3, userType: "user", status: "unread"}
 *                           ]
 *                         items:
 *                           type: object
 *                           properties:
 *                             userType:
 *                               type: string
 *                               nullable: true
 *                               description: Тип пользователя (user, bot, contact) или null, если тип не определен
 *                               example: "user"
 *                             status:
 *                               type: string
 *                               enum: [sent, unread, delivered, read]
 *                               description: Статус сообщения
 *                               example: "read"
 *                             count:
 *                               type: integer
 *                               description: Количество пользователей данного типа с данным статусом
 *                               example: 5
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - User is not a member of this dialog
 *       404:
 *         description: Dialog not found
 */
router.get('/:userId/dialogs/:dialogId/messages', apiAuth, requirePermission('read'), validateUserId, validateDialogId, userDialogController.getUserDialogMessages);

/**
 * @swagger
 * /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}:
 *   get:
 *     summary: Get single message in context of specific user
 *     description: |
 *       Возвращает детальную информацию о сообщении с контекстными данными пользователя, матрицей статусов и реакциями.
 *       
 *       **Важно**: 
 *       - `context.statuses` всегда возвращает `null` (устарело)
 *       - Для получения информации о статусах используйте `statusMessageMatrix` в корне объекта сообщения
 *       - `statusMessageMatrix` содержит агрегированные данные о статусах других пользователей, исключая текущего
 *     tags: [UserDialogs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
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
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message info retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     messageId:
 *                       type: string
 *                     dialogId:
 *                       type: string
 *                     senderId:
 *                       type: string
 *                     content:
 *                       type: string
 *                     type:
 *                       type: string
 *                     createdAt:
 *                       type: number
 *                     updatedAt:
 *                       type: number
 *                     reactionCounts:
 *                       type: object
 *                     meta:
 *                       type: object
 *                     context:
 *                       type: object
 *                       properties:
 *                         userId:
 *                           type: string
 *                         isMine:
 *                           type: boolean
 *                         statuses:
 *                           type: array
 *                           nullable: true
 *                           description: |
 *                             Статусы сообщения для текущего пользователя.
 *                             ⚠️ **DEPRECATED**: Всегда возвращает `null`.
 *                             Для получения информации о статусах используйте `statusMessageMatrix` в корне объекта сообщения.
 *                         myReaction:
 *                           type: string
 *                           nullable: true
 *                     statusMessageMatrix:
 *                       type: array
 *                       description: |
 *                         Матрица статусов сообщения, сгруппированная по userType и status.
 *                         Исключает статусы текущего пользователя (userId из пути запроса).
 *                         
 *                         Каждый элемент матрицы содержит:
 *                         - userType: тип пользователя (user, bot, contact) или null
 *                         - status: статус сообщения (sent, unread, delivered, read)
 *                         - count: количество пользователей данного типа с данным статусом
 *                         
 *                         Пример:
 *                         [
 *                           {count: 2, userType: "bot", status: "unread"},
 *                           {count: 1, userType: "user", status: "read"},
 *                           {count: 3, userType: "user", status: "unread"}
 *                         ]
 *                       items:
 *                         type: object
 *                         properties:
 *                           userType:
 *                             type: string
 *                             nullable: true
 *                             description: Тип пользователя (user, bot, contact) или null, если тип не определен
 *                             example: "user"
 *                           status:
 *                             type: string
 *                             enum: [sent, unread, delivered, read]
 *                             description: Статус сообщения
 *                             example: "read"
 *                           count:
 *                             type: integer
 *                             description: Количество пользователей данного типа с данным статусом
 *                             example: 5
 *                     reactions:
 *                       type: array
 *                       description: All reactions from all users
 *       403:
 *         description: Forbidden - User is not a member of this dialog
 *       404:
 *         description: Message not found
 */
router.get('/:userId/dialogs/:dialogId/messages/:messageId', apiAuth, requirePermission('read'), validateUserId, validateDialogId, validateMessageId, userDialogController.getUserDialogMessage);

/**
 * @swagger
 * /api/users/{userId}/messages/{messageId}/statusMatrix:
 *   get:
 *     summary: Get message status matrix grouped by userType and status
 *     description: |
 *       Возвращает матрицу статусов сообщения, сгруппированную по userType и status.
 *       Исключает статусы текущего пользователя (userId из пути запроса).
 *       
 *       Матрица показывает, сколько пользователей каждого типа имеют каждый статус для данного сообщения.
 *       Это полезно для анализа доставки и прочтения сообщений в групповых чатах.
 *       
 *       ⚠️ **DEPRECATED**: Этот метод устарел. Используйте `/api/users/{userId}/dialogs/{dialogId}/messages/{messageId}` 
 *       который возвращает `statusMessageMatrix` в ответе.
 *     deprecated: true
 *     tags: [UserDialogs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID пользователя, статусы которого будут исключены из матрицы
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID сообщения
 *     responses:
 *       200:
 *         description: Матрица статусов успешно получена
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   description: |
 *                     Массив объектов, каждый из которых представляет комбинацию userType и status.
 *                     
 *                     Формат каждого элемента:
 *                     - userType: тип пользователя (user, bot, contact) или null, если тип не определен
 *                     - status: статус сообщения (sent, unread, delivered, read)
 *                     - count: количество пользователей данного типа с данным статусом
 *                     
 *                     Пример ответа:
 *                     [
 *                       {count: 2, userType: "bot", status: "unread"},
 *                       {count: 1, userType: "user", status: "read"},
 *                       {count: 3, userType: "user", status: "unread"},
 *                       {count: 1, userType: null, status: "delivered"}
 *                     ]
 *                   items:
 *                     type: object
 *                     properties:
 *                       userType:
 *                         type: string
 *                         nullable: true
 *                         description: Тип пользователя (user, bot, contact) или null, если тип не определен
 *                         example: "user"
 *                       status:
 *                         type: string
 *                         enum: [sent, unread, delivered, read]
 *                         description: Статус сообщения
 *                         example: "read"
 *                       count:
 *                         type: integer
 *                         description: Количество пользователей данного типа с данным статусом
 *                         example: 5
 *                 message:
 *                   type: string
 *                   description: Сообщение об успешном выполнении
 *                   example: "Message status matrix retrieved successfully"
 *       404:
 *         description: Message not found
 */
router.get('/:userId/messages/:messageId/statusMatrix', apiAuth, requirePermission('read'), validateUserId, validateMessageId, userDialogController.getMessageStatusMatrix);

/**
 * @swagger
 * /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/statuses:
 *   get:
 *     summary: Get paginated list of all message statuses
 *     description: |
 *       Возвращает постраничный список всех статусов сообщения.
 *       Доступен только для участников диалога.
 *     tags: [UserDialogs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
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
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
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
 *           default: 50
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Statuses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   description: Array of message statuses
 *                   items:
 *                     type: object
 *                     properties:
 *                       messageId:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       userType:
 *                         type: string
 *                         nullable: true
 *                       tenantId:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [sent, unread, delivered, read]
 *                       createdAt:
 *                         type: number
 *                       updatedAt:
 *                         type: number
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       403:
 *         description: Forbidden - User is not a member of this dialog
 *       404:
 *         description: Message not found
 */
router.get('/:userId/dialogs/:dialogId/messages/:messageId/statuses', apiAuth, requirePermission('read'), validateUserId, validateDialogId, validateMessageId, userDialogController.getMessageStatuses);

export default router;
