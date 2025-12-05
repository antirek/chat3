import express from 'express';
import * as userController from '../controllers/userController.js';
import { apiAuth } from '../middleware/apiAuth.js';
import { validateBody } from '../validators/middleware.js';
import { validateUserId } from '../validators/urlValidators/index.js';
import { createUserSchema, updateUserSchema } from '../validators/schemas/bodySchemas.js';

const router = express.Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     description: |
 *       Получить список пользователей с поддержкой пагинации и фильтрации.
 *       
 *       Возвращает пользователей с их meta тегами (theme, email, department и т.д.)
 *     tags: [Users]
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
 *           default: 50
 *         description: Количество пользователей на странице
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: |
 *           Фильтр в формате (field,operator,value)
 *           
 *           Примеры:
 *           - `(name,regex,^John)` - имя начинается с John
 *           - `(userId,in,[carl,marta,sara])` - userId в списке
 *         examples:
 *           by-name:
 *             summary: По имени
 *             value: '(name,regex,^Carl)'
 *           by-userId:
 *             summary: По userId
 *             value: '(userId,in,[carl,marta])'
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Сортировка в формате JSON, например `{"createdAt":-1}`
 *     responses:
 *       200:
 *         description: Список пользователей
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
 *                       userId:
 *                         type: string
 *                         example: "carl"
 *                       tenantId:
 *                         type: string
 *                         example: "tnt_default"
 *                       name:
 *                         type: string
 *                         example: "Carl Johnson"
 *                       type:
 *                         type: string
 *                         example: "user"
 *                       createdAt:
 *                         type: string
 *                         example: "1730891234567.123456"
 *                       meta:
 *                         type: object
 *                         example: {"theme": "dark", "email": "carl@example.com"}
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
 *         description: Unauthorized - invalid API key
 */
router.get('/', apiAuth, userController.getUsers);

/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     summary: Get user by userId
 *     description: Получить информацию о пользователе по его userId, включая все meta теги
 *     tags: [Users]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID (например, carl, marta, alice)
 *     responses:
 *       200:
 *         description: Информация о пользователе
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       example: "alice"
 *                     tenantId:
 *                       type: string
 *                       example: "tnt_default"
 *                     name:
 *                       type: string
 *                       example: "Alice Wonder"
 *                     type:
 *                       type: string
 *                       example: "user"
 *                     createdAt:
 *                       type: string
 *                       example: "1730891234567.123456"
 *                     meta:
 *                       type: object
 *                       example: {"theme": "dark", "email": "alice@example.com", "department": "Engineering"}
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:userId', apiAuth, validateUserId, userController.getUserById);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create new user
 *     description: |
 *       Создать нового пользователя.
 *       
 *       Только базовые поля (userId и name). Дополнительные данные (email, phone, department и т.д.) 
 *       добавляются через Meta API: `PUT /api/meta/user/{userId}/{key}`
 *     tags: [Users]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Уникальный идентификатор пользователя (lowercase)
 *                 example: "john"
 *               name:
 *                 type: string
 *                 description: Имя пользователя (опционально)
 *                 example: "John Doe"
 *               type:
 *                 type: string
 *                 description: Тип пользователя (user, bot, contact и т.д.). По умолчанию 'user'
 *                 example: "bot"
 *     responses:
 *       201:
 *         description: Пользователь создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     tenantId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *       409:
 *         description: Conflict - user already exists
 *       400:
 *         description: Validation error
 */
router.post('/', apiAuth, validateBody(createUserSchema), userController.createUser);

/**
 * @swagger
 * /api/users/{userId}:
 *   put:
 *     summary: Update user
 *     description: |
 *       Обновить данные пользователя.
 *       
 *       Можно обновить поля name и type. Для других полей используйте Meta API.
 *     tags: [Users]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Новое имя пользователя
 *                 example: "John Smith"
 *               type:
 *                 type: string
 *                 description: Тип пользователя (user, bot, contact и т.д.)
 *                 example: "bot"
 *     responses:
 *       200:
 *         description: Пользователь обновлен
 *       404:
 *         description: User not found
 *       400:
 *         description: Validation error
 */
router.put('/:userId', apiAuth, validateUserId, validateBody(updateUserSchema), userController.updateUser);

/**
 * @swagger
 * /api/users/{userId}:
 *   delete:
 *     summary: Delete user
 *     description: |
 *       Удалить пользователя.
 *       
 *       ⚠️ Внимание: это удалит пользователя из базы, но не удалит его участие в диалогах.
 *       Для полного удаления также необходимо удалить DialogMember записи.
 *     tags: [Users]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       204:
 *         description: Пользователь удален
 *       404:
 *         description: User not found
 */
router.delete('/:userId', apiAuth, validateUserId, userController.deleteUser);


export default router;
