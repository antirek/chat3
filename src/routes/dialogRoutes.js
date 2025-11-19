import express from 'express';
import { dialogController } from '../controllers/dialogController.js';
import dialogMemberController from '../controllers/dialogMemberController.js';
import typingController from '../controllers/typingController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validateDialogId, validateUserId } from '../validators/urlValidators/index.js';
import { validateBody, validateQuery } from '../validators/middleware.js';
import { createDialogSchema, queryWithFilterSchema } from '../validators/schemas/index.js';

const router = express.Router();

/**
 * @swagger
 * /api/dialogs:
 *   get:
 *     summary: Get all dialogs with advanced meta filtering
 *     description: |
 *       Получить список диалогов с поддержкой сложных фильтров.
 *       
 *       **Два формата фильтров:**
 *       
 *       1. **JSON формат** (старый, все еще поддерживается):
 *          - `{"meta":{"type":"internal"}}`
 *          - `{"meta":{"type":"internal","channelType":"whatsapp"}}`
 *       
 *       2. **Операторный формат** (новый, более гибкий):
 *          - `(meta.type,eq,internal)` - type равен internal
 *          - `(meta.channelType,ne,telegram)` - channelType НЕ равен telegram
 *          - `(meta.type,in,[internal,external])` - type в массиве
 *          
 *       **Поддерживаемые операторы:**
 *       - `eq` - равно
 *       - `ne` - не равно (NOT EQUAL)
 *       - `in` - в массиве
 *       - `nin` - не в массиве
 *       - `gt` - больше
 *       - `gte` - больше или равно
 *       - `lt` - меньше
 *       - `lte` - меньше или равно
 *       - `regex` - регулярное выражение
 *       - `exists` - существование поля
 *       
 *       **Комбинирование фильтров (AND логика):**
 *       - `(meta.type,eq,internal)&(meta.channelType,ne,telegram)` - internal И НЕ telegram
 *       - `(meta.type,eq,external)&(meta.channelType,in,[whatsapp,telegram])` - external И (whatsapp ИЛИ telegram)
 *     tags: [Dialogs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
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
 *         description: Количество элементов на странице
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: |
 *           Фильтр по meta полям. Примеры:
 *           
 *           JSON: `{"meta":{"type":"internal"}}`
 *           
 *           Операторы: `(meta.type,eq,internal)&(meta.channelType,ne,telegram)`
 *         examples:
 *           json-simple:
 *             summary: JSON - простой фильтр
 *             value: '{"meta":{"type":"internal"}}'
 *           json-multiple:
 *             summary: JSON - множественный
 *             value: '{"meta":{"type":"internal","channelType":"whatsapp"}}'
 *           operator-not-equal:
 *             summary: Оператор - НЕ равно
 *             value: '(meta.channelType,ne,telegram)'
 *           operator-combined:
 *             summary: Оператор - комбинированный (internal + НЕ telegram)
 *             value: '(meta.type,eq,internal)&(meta.channelType,ne,telegram)'
 *           operator-in-array:
 *             summary: Оператор - в массиве
 *             value: '(meta.type,in,[internal,external])'
 *           members-with-john:
 *             summary: Members - диалоги с john
 *             value: '(meta.members,in,[john])'
 *           members-with-sara-carl:
 *             summary: Members - диалоги с sara или carl
 *             value: '(meta.members,in,[sara,carl])'
 *           members-without-kirk:
 *             summary: Members - диалоги без kirk
 *             value: '(meta.members,nin,[kirk])'
 *           members-combined:
 *             summary: Members + Type - internal диалоги с john
 *             value: '(meta.type,eq,internal)&(meta.members,in,[john])'
 *           members-whatsapp-john:
 *             summary: Members + Channel - WhatsApp диалоги с john
 *             value: '(meta.channelType,eq,whatsapp)&(meta.members,in,[john])'
 *     responses:
 *       200:
 *         description: Список диалогов с участниками и meta данными
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
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
 *       400:
 *         description: Неверный формат фильтра
 */
router.get('/', apiAuth, requirePermission('read'), validateQuery(queryWithFilterSchema), dialogController.getAll);

/**
 * @swagger
 * /api/dialogs/{dialogId}/members:
 *   get:
 *     summary: List members of a dialog with filtering
 *     tags: [DialogMember]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: Фильтры участников в формате queryParser. Поддерживаются поля `userId`, `role`, `isActive`, `unreadCount`, даты и `meta.*`.
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Поле сортировки (`joinedAt`, `lastSeenAt`, `lastMessageAt`, `unreadCount`, `userId`, `role`, `isActive`).
 *       - in: query
 *         name: sortDirection
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Paginated list of dialog members
 *       404:
 *         description: Dialog not found
 */
router.get(
  '/:dialogId/members',
  apiAuth,
  requirePermission('read'),
  validateDialogId,
  validateQuery(queryWithFilterSchema),
  dialogMemberController.getDialogMembers
);

/**
 * @swagger
 * /api/dialogs/{id}:
 *   get:
 *     summary: Get dialog by ID
 *     tags: [Dialogs]
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
 *         description: Dialog details
 */
router.get('/:id', apiAuth, requirePermission('read'), validateDialogId, dialogController.getById);

/**
 * @swagger
 * /api/dialogs:
 *   post:
 *     summary: Create new dialog
 *     tags: [Dialogs]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - createdBy
 *             properties:
 *               name:
 *                 type: string
 *                 description: Название диалога
 *               createdBy:
 *                 type: string
 *                 description: ID создателя диалога
 *               members:
 *                 type: array
 *                 description: Массив участников диалога
 *                 items:
 *                   type: object
 *                   required:
 *                     - userId
 *                   properties:
 *                     userId:
 *                       type: string
 *                       description: ID пользователя (обязательное поле)
 *                     type:
 *                       type: string
 *                       description: Тип пользователя (user, bot, contact и т.д.)
 *                     name:
 *                       type: string
 *                       description: Имя пользователя
 *                 example:
 *                   - userId: "carl"
 *                     type: "user"
 *                     name: "Carl Johnson"
 *                   - userId: "bot_123"
 *                     type: "bot"
 *                     name: "Support Bot"
 *               meta:
 *                 type: object
 *                 additionalProperties: true
 *                 description: |
 *                   Произвольные мета-теги. Можно передать простые значения (`"channel": "whatsapp"`) или расширенный объект
 *                   `{ "value": "...", "dataType": "...", "scope": "user_123" }`, чтобы сразу задать тип и персональный `scope`.
 *             example:
 *               name: "VIP чат"
 *               createdBy: "agent_42"
 *               members:
 *                 - userId: "carl"
 *                   type: "user"
 *                   name: "Carl Johnson"
 *                 - userId: "bot_123"
 *                   type: "bot"
 *               meta:
 *                 channel: "whatsapp"
 *                 greeting:
 *                   value: "Здравствуйте!"
 *                   dataType: "string"
 *                   scope: "user_alice"
 *     responses:
 *       201:
 *         description: Dialog created
 */
router.post('/', apiAuth, requirePermission('write'), validateBody(createDialogSchema), dialogController.create);

/**
 * @swagger
 * /api/dialogs/{dialogId}/member/{userId}/typing:
 *   post:
 *     summary: Emit typing indicator for dialog
 *     description: Сообщить участникам диалога, что пользователь начал набирать сообщение. Клиенты самостоятельно скрывают индикатор, если не получают повторный сигнал в течение нескольких секунд.
 *     tags: [DialogMember]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID диалога (формат dlg_xxx)
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID пользователя, который печатает
 *     responses:
 *       202:
 *         description: Сигнал принят и событие отправлено участникам
 *       404:
 *         description: Диалог не найден или пользователь не является участником
 */
router.post('/:dialogId/member/:userId/typing', apiAuth, requirePermission('write'), validateDialogId, validateUserId, typingController.sendTyping);


/**
 * @swagger
 * /api/dialogs/{id}:
 *   delete:
 *     summary: Delete dialog
 *     tags: [Dialogs]
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
 *         description: Dialog deleted
 */
router.delete('/:id', apiAuth, requirePermission('delete'), validateDialogId, dialogController.delete);

export default router;


