import express from 'express';
import { initController } from '../controllers/initController.js';

const router = express.Router();

/**
 * @swagger
 * /api/init:
 *   post:
 *     summary: Initialize system (create default tenant and API key)
 *     tags: [Initialization]
 *     description: |
 *       Создает tenant с ID 'tnt_default' и API ключ, если они не существуют.
 *       Этот endpoint не требует аутентификации и предназначен для первоначальной настройки системы.
 *     responses:
 *       200:
 *         description: Initialization completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     tenant:
 *                       type: object
 *                       properties:
 *                         tenantId:
 *                           type: string
 *                         name:
 *                           type: string
 *                         created:
 *                           type: boolean
 *                     apiKey:
 *                       type: object
 *                       properties:
 *                         key:
 *                           type: string
 *                         name:
 *                           type: string
 *                         created:
 *                           type: boolean
 *       207:
 *         description: Initialization completed with some errors
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: processing
 *                     note:
 *                       type: string
 */
router.post('/seed', initController.seed);

export default router;

