import express from 'express';
import * as userController from '../controllers/userController.js';
import { apiAuth } from '../middleware/apiAuth.js';
import { validateBody } from '../validators/middleware.js';
import { validateUserId } from '../validators/urlValidators/index.js';
import { createUserSchema, updateUserSchema } from '../validators/schemas/bodySchemas.js';

const router = express.Router();

/**
 * GET /api/users
 * Получить список всех пользователей
 */
router.get('/', apiAuth, userController.getUsers);

/**
 * GET /api/users/:userId
 * Получить пользователя по userId
 */
router.get('/:userId', apiAuth, validateUserId, userController.getUserById);

/**
 * POST /api/users
 * Создать нового пользователя
 */
router.post('/', apiAuth, validateBody(createUserSchema), userController.createUser);

/**
 * PUT /api/users/:userId
 * Обновить пользователя
 */
router.put('/:userId', apiAuth, validateUserId, validateBody(updateUserSchema), userController.updateUser);

/**
 * DELETE /api/users/:userId
 * Удалить пользователя
 */
router.delete('/:userId', apiAuth, validateUserId, userController.deleteUser);

/**
 * POST /api/users/:userId/activity
 * Обновить lastActiveAt для пользователя
 */
router.post('/:userId/activity', apiAuth, validateUserId, userController.updateUserActivity);

export default router;

