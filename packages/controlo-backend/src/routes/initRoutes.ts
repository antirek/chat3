import express, { Router } from 'express';
import { initController } from '../controllers/initController.js';

const router: Router = express.Router();

/**
 * @swagger
 * /api/init:
 *   post:
 *     summary: Initialize system (create default tenant and API key)
 *     tags: [Initialization]
 *     description: |
 *       Создает tenant с ID 'tnt_default' и API ключ, если они не существуют.
 *       Этот endpoint не требует аутентификации и предназначен для первоначальной настройки системы.
 *       
 *       **Важно:** Этот endpoint предназначен только для внутреннего использования и не должен быть доступен извне в production.
 *     requestBody:
 *       required: false
 *       description: Тело запроса не требуется
 *     responses:
 *       200:
 *         description: Initialization completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Initialization completed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     tenant:
 *                       type: object
 *                       properties:
 *                         tenantId:
 *                           type: string
 *                           example: tnt_default
 *                         created:
 *                           type: boolean
 *                           example: true
 *                         message:
 *                           type: string
 *                           description: Сообщение (если tenant уже существует)
 *                     apiKey:
 *                       type: object
 *                       properties:
 *                         key:
 *                           type: string
 *                           example: chat3_abc123...
 *                         name:
 *                           type: string
 *                           example: Default API Key
 *                         created:
 *                           type: boolean
 *                           example: true
 *                         message:
 *                           type: string
 *                           description: Сообщение (если API ключ уже существует)
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Массив ошибок (если есть)
 *       207:
 *         description: Initialization completed with some errors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Initialization completed with some errors
 *                 data:
 *                   type: object
 *                   properties:
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 *       500:
 *         description: Internal Server Error
 */
router.post('/', initController.initialize);

/**
 * @swagger
 * /api/init/seed:
 *   post:
 *     summary: Run database seed script
 *     tags: [Initialization]
 *     description: |
 *       Запускает скрипт заполнения базы данных тестовыми данными.
 *       Операция выполняется асинхронно. Ответ возвращается сразу (202 Accepted),
 *       а скрипт продолжает работу в фоне.
 *       
 *       **Важно:** Этот endpoint предназначен только для внутреннего использования и не должен быть доступен извне в production.
 *     requestBody:
 *       required: false
 *       description: Тело запроса не требуется
 *     responses:
 *       202:
 *         description: Seed script started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Seed script started
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: processing
 *                     note:
 *                       type: string
 *                       example: This operation may take some time. Check server logs for progress.
 *       500:
 *         description: Internal Server Error
 */
router.post('/seed', initController.seed);

/**
 * @swagger
 * /api/init/recalculate-stats:
 *   post:
 *     summary: Recalculate user stats for all users
 *     tags: [Initialization]
 *     description: |
 *       Пересчитывает все счетчики (dialogCount, unreadDialogsCount, totalUnreadCount, totalMessagesCount)
 *       для всех пользователей во всех тенантах.
 *       Операция выполняется асинхронно. Ответ возвращается сразу (202 Accepted),
 *       а пересчет продолжается в фоне.
 *       
 *       **Важно:** Этот endpoint предназначен только для внутреннего использования и не должен быть доступен извне в production.
 *     requestBody:
 *       required: false
 *       description: Тело запроса не требуется
 *     responses:
 *       202:
 *         description: Recalculate user stats started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Recalculate user stats started
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: processing
 *                     note:
 *                       type: string
 *                       example: This operation may take some time. Check server logs for progress.
 *       500:
 *         description: Internal Server Error
 */
router.post('/recalculate-stats', initController.recalculateUserStats);

/**
 * @swagger
 * /api/init/sync-pack-stats:
 *   post:
 *     summary: Sync pack stats (UserPackStats) from UserDialogStats
 *     tags: [Initialization]
 *     description: |
 *       Синхронизирует счетчики непрочитанных паков (UserPackStats.unreadCount) из счетчиков диалогов (UserDialogStats).
 *       Для каждого пака суммирует unreadCount по всем диалогам пака для каждого пользователя.
 *       Операция выполняется асинхронно (202 Accepted).
 *     responses:
 *       202:
 *         description: Sync pack stats started
 *       500:
 *         description: Internal Server Error
 */
router.post('/sync-pack-stats', initController.syncPackStats);

export default router;
