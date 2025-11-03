import express from 'express';
import { dialogController } from '../controllers/dialogController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';

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
router.get('/', apiAuth, requirePermission('read'), dialogController.getAll);

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
router.get('/:id', apiAuth, requirePermission('read'), dialogController.getById);

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
 *               - createdBy
 *             properties:
 *               name:
 *                 type: string
 *               createdBy:
 *                 type: string
 *     responses:
 *       201:
 *         description: Dialog created
 */
router.post('/', apiAuth, requirePermission('write'), dialogController.create);


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
router.delete('/:id', apiAuth, requirePermission('delete'), dialogController.delete);

export default router;


