import express from 'express';
import userDialogController from '../controllers/userDialogController.js';
import messageReactionController from '../controllers/messageReactionController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validateUserId, validateDialogId, validateMessageId, validateAction, validateStatus } from '../validators/urlValidators/index.js';
import { validateQuery, validateBody } from '../validators/middleware.js';
import { userDialogsQuerySchema, addReactionSchema, reactionsQuerySchema } from '../validators/schemas/index.js';

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
 *       Возвращает сообщения с контекстными данными пользователя (isMine, statusMessageMatrix, reactionSet).
 *       Доступно только для участников диалога.
 *       
 *       **Важно**: 
 *       - `context.statuses` удалено из ответа
 *       - Для получения информации о статусах используйте `statusMessageMatrix` в корне каждого объекта сообщения
 *       - `statusMessageMatrix` содержит агрегированные данные о статусах всех получателей, исключая отправителя сообщения
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
 *                               ⚠️ **REMOVED**: Поле удалено из ответа.
 *                               Для получения информации о статусах используйте `statusMessageMatrix` в корне объекта сообщения.
 *                       statusMessageMatrix:
 *                         type: array
 *                         description: |
 *                           Матрица статусов сообщения, сгруппированная по userType и status.
 *                           Исключает статусы отправителя сообщения (senderId).
 *                           
 *                           **Важно:**
 *                           - Матрица содержит суммарные значения по всем статусам в истории
 *                           - Каждое изменение статуса увеличивает счетчик для соответствующей комбинации userType и status
 *                           - Это позволяет видеть, сколько раз сообщение проходило через каждый статус
 *                           
 *                           Каждый элемент матрицы содержит:
 *                           - userType: тип пользователя (user, bot, contact) или null
 *                           - status: статус сообщения (sent, unread, delivered, read)
 *                           - count: суммарное количество записей в истории для данной комбинации userType и status
 *                           
 *                           Пример:
 *                           Если пользователь marta (userType: "user") менял статус: unread → delivered → read,
 *                           то в матрице будет:
 *                           [
 *                             {count: 1, userType: "user", status: "unread"},
 *                             {count: 1, userType: "user", status: "delivered"},
 *                             {count: 1, userType: "user", status: "read"}
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
 *                       reactionSet:
 *                         type: array
 *                         description: |
 *                           Набор реакций на сообщение, сгруппированный по типу реакции.
 *                           Каждый элемент содержит:
 *                           - reaction: эмодзи реакции (например, "👍", "❤️")
 *                           - count: количество пользователей, поставивших эту реакцию
 *                           - me: true, если текущий пользователь поставил эту реакцию, иначе false
 *                           
 *                           Пример:
 *                           [
 *                             {reaction: "👍", count: 5, me: true},
 *                             {reaction: "❤️", count: 3, me: false}
 *                           ]
 *                         items:
 *                           type: object
 *                           properties:
 *                             reaction:
 *                               type: string
 *                               description: Эмодзи реакции
 *                               example: "👍"
 *                             count:
 *                               type: integer
 *                               description: Количество пользователей с этой реакцией
 *                               example: 5
 *                             me:
 *                               type: boolean
 *                               description: true, если текущий пользователь поставил эту реакцию
 *                               example: true
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
 *       - `context.statuses` удалено из ответа
 *       - Для получения информации о статусах используйте `statusMessageMatrix` в корне объекта сообщения
 *       - `statusMessageMatrix` содержит агрегированные данные о статусах всех получателей, исключая отправителя сообщения
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
 *                             ⚠️ **REMOVED**: Поле удалено из ответа.
 *                             Для получения информации о статусах используйте `statusMessageMatrix` в корне объекта сообщения.
 *                     statusMessageMatrix:
 *                       type: array
 *                       description: |
 *                         Матрица статусов сообщения, сгруппированная по userType и status.
 *                         Исключает статусы текущего пользователя (userId из пути запроса).
 *                         
 *                         **Важно:**
 *                         - Матрица содержит суммарные значения по всем статусам в истории
 *                         - Каждое изменение статуса увеличивает счетчик для соответствующей комбинации userType и status
 *                         - Это позволяет видеть, сколько раз сообщение проходило через каждый статус
 *                         
 *                         Каждый элемент матрицы содержит:
 *                         - userType: тип пользователя (user, bot, contact) или null
 *                         - status: статус сообщения (sent, unread, delivered, read)
 *                         - count: суммарное количество записей в истории для данной комбинации userType и status
 *                         
 *                         Пример:
 *                         Если пользователь marta (userType: "user") менял статус: unread → delivered → read,
 *                         то в матрице будет:
 *                         [
 *                           {count: 1, userType: "user", status: "unread"},
 *                           {count: 1, userType: "user", status: "delivered"},
 *                           {count: 1, userType: "user", status: "read"}
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
 *                     reactionSet:
 *                       type: array
 *                       description: |
 *                         Набор реакций на сообщение, сгруппированный по типу реакции.
 *                         Каждый элемент содержит:
 *                         - reaction: эмодзи реакции (например, "👍", "❤️")
 *                         - count: количество пользователей, поставивших эту реакцию
 *                         - me: true, если текущий пользователь поставил эту реакцию, иначе false
 *                         
 *                         Пример:
 *                         [
 *                           {reaction: "👍", count: 5, me: true},
 *                           {reaction: "❤️", count: 3, me: false}
 *                         ]
 *                       items:
 *                         type: object
 *                         properties:
 *                           reaction:
 *                             type: string
 *                             description: Эмодзи реакции
 *                             example: "👍"
 *                           count:
 *                             type: integer
 *                             description: Количество пользователей с этой реакцией
 *                             example: 5
 *                           me:
 *                             type: boolean
 *                             description: true, если текущий пользователь поставил эту реакцию
 *                             example: true
 *       403:
 *         description: Forbidden - User is not a member of this dialog
 *       404:
 *         description: Message not found
 */
router.get('/:userId/dialogs/:dialogId/messages/:messageId', apiAuth, requirePermission('read'), validateUserId, validateDialogId, validateMessageId, userDialogController.getUserDialogMessage);


/**
 * @swagger
 * /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/statuses:
 *   get:
 *     summary: Get paginated list of all message statuses (history)
 *     description: |
 *       Возвращает постраничный список всех статусов сообщения из истории изменений.
 *       
 *       **Важно о MessageStatus:**
 *       - MessageStatus хранит полную историю изменений статусов для каждого пользователя
 *       - Каждое изменение статуса создает новую запись в истории (не обновляет существующую)
 *       - Один пользователь может иметь несколько записей статусов для одного сообщения
 *       - Записи отсортированы по времени создания (createdAt) в порядке убывания
 *       
 *       Доступен только для участников диалога.
 *     tags: [MessageStatus]
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
 *                   description: |
 *                     Массив записей истории статусов сообщения.
 *                     Каждая запись представляет одно изменение статуса для конкретного пользователя.
 *                     Записи отсортированы по времени создания (createdAt) в порядке убывания (новые первыми).
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         description: Уникальный идентификатор записи статуса
 *                       messageId:
 *                         type: string
 *                         description: ID сообщения
 *                       userId:
 *                         type: string
 *                         description: ID пользователя, для которого установлен статус
 *                       userType:
 *                         type: string
 *                         nullable: true
 *                         description: |
 *                           Тип пользователя (user, bot, contact и т.д.).
 *                           Заполняется автоматически при создании записи на основе типа пользователя.
 *                       tenantId:
 *                         type: string
 *                         description: ID тенанта
 *                       status:
 *                         type: string
 *                         enum: [sent, unread, delivered, read]
 *                         description: |
 *                           Статус сообщения:
 *                           - sent: отправлено
 *                           - unread: не прочитано
 *                           - delivered: доставлено
 *                           - read: прочитано
 *                       createdAt:
 *                         type: number
 *                         description: Timestamp создания записи (микросекунды)
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

/**
 * @swagger
 * /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/reactions:
 *   get:
 *     summary: Get all reactions for a message
 *     description: |
 *       Возвращает все реакции на сообщение.
 *       Доступен только для участников диалога.
 *     tags: [MessageReactions]
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
 *         name: reaction
 *         schema:
 *           type: string
 *         description: Filter by reaction type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *     responses:
 *       200:
 *         description: Reactions retrieved successfully
 *       403:
 *         description: Forbidden - User is not a member of this dialog
 *       404:
 *         description: Message not found
 */
router.get('/:userId/dialogs/:dialogId/messages/:messageId/reactions', 
  apiAuth,
  requirePermission('read'),
  validateUserId,
  validateDialogId,
  validateMessageId,
  validateQuery(reactionsQuerySchema),
  userDialogController.checkDialogMembership,
  messageReactionController.getMessageReactions
);

/**
 * @swagger
 * /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/reactions/{action}:
 *   post:
 *     summary: Set or unset reaction for a message
 *     description: |
 *       Устанавливает (set) или снимает (unset) реакцию на сообщение.
 *       Доступен только для участников диалога.
 *       - action='set': добавляет реакцию (если её еще нет)
 *       - action='unset': удаляет реакцию (если она существует)
 *     tags: [MessageReactions]
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
 *       - in: path
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [set, unset]
 *         description: Action to perform - 'set' to add reaction, 'unset' to remove
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reaction
 *             properties:
 *               reaction:
 *                 type: string
 *                 description: Reaction type (emoji or text)
 *                 example: "👍"
 *     responses:
 *       201:
 *         description: Reaction set successfully
 *       200:
 *         description: Reaction unset successfully
 *       403:
 *         description: Forbidden - User is not a member of this dialog
 *       404:
 *         description: Message not found or reaction not found (for unset)
 */
router.post('/:userId/dialogs/:dialogId/messages/:messageId/reactions/:action',
  apiAuth,
  requirePermission('write'),
  validateUserId,
  validateDialogId,
  validateMessageId,
  validateAction,
  validateBody(addReactionSchema),
  userDialogController.checkDialogMembership,
  messageReactionController.setOrUnsetReaction
);

/**
 * @swagger
 * /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/status/{status}:
 *   post:
 *     summary: Create new message status entry (add to history)
 *     description: |
 *       Создает новую запись в истории статусов сообщения для указанного пользователя.
 *       
 *       **Важно о MessageStatus:**
 *       - Каждое изменение статуса создает новую запись в истории (не обновляет существующую)
 *       - MessageStatus хранит полную историю всех изменений статусов для каждого пользователя
 *       - При создании новой записи автоматически заполняется поле `userType` на основе типа пользователя
 *       - Автоматически обновляются счетчики непрочитанных сообщений (unreadCount)
 *       - Генерируется событие изменения статуса для других участников диалога
 *       
 *       Доступен только для участников диалога.
 *       
 *       Статусы:
 *       - unread: не прочитано (по умолчанию для новых сообщений)
 *       - delivered: доставлено
 *       - read: прочитано
 *     tags: [MessageStatus]
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
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [unread, delivered, read]
 *         description: New status
 *         example: "read"
 *     responses:
 *       200:
 *         description: Message status entry created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   description: Созданная запись в истории статусов
 *                   properties:
 *                     _id:
 *                       type: string
 *                       description: Уникальный идентификатор записи статуса
 *                     messageId:
 *                       type: string
 *                       description: ID сообщения
 *                     userId:
 *                       type: string
 *                       description: ID пользователя
 *                     userType:
 *                       type: string
 *                       nullable: true
 *                       description: |
 *                         Тип пользователя (user, bot, contact и т.д.).
 *                         Заполняется автоматически при создании записи.
 *                     tenantId:
 *                       type: string
 *                       description: ID тенанта
 *                     status:
 *                       type: string
 *                       enum: [sent, unread, delivered, read]
 *                       description: Установленный статус сообщения
 *                     createdAt:
 *                       type: number
 *                       description: Timestamp создания записи (микросекунды)
 *                 message:
 *                   type: string
 *                   description: Сообщение об успешном создании записи
 *       400:
 *         description: Bad Request - Invalid status
 *       403:
 *         description: Forbidden - User is not a member of this dialog
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized - Invalid API key
 */
router.post('/:userId/dialogs/:dialogId/messages/:messageId/status/:status',
  apiAuth,
  requirePermission('write'),
  validateUserId,
  validateDialogId,
  validateMessageId,
  validateStatus,
  userDialogController.checkDialogMembership,
  userDialogController.updateMessageStatus
);

export default router;
