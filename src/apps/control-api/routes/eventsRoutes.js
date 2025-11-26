import express from 'express';
import { eventsController } from '../controllers/eventsController.js';

const router = express.Router();

/**
 * @swagger
 * /api/dialogs/{dialogId}/events:
 *   get:
 *     summary: Get events for a dialog
 *     tags: [Events & Updates]
 *     description: |
 *       Получает все события, связанные с диалогом.
 *       Этот endpoint предназначен для внутреннего использования и не требует аутентификации.
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the dialog
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         required: true
 *         description: Tenant ID (можно также передать через заголовок X-Tenant-Id)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of events to return
 *     responses:
 *       200:
 *         description: List of events for the dialog
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Bad Request - tenantId is required
 *       404:
 *         description: Dialog not found
 *       500:
 *         description: Internal Server Error
 */
router.get('/dialogs/:dialogId/events', eventsController.getDialogEvents);

/**
 * @swagger
 * /api/dialogs/{dialogId}/updates:
 *   get:
 *     summary: Get updates for a dialog
 *     tags: [Events & Updates]
 *     description: |
 *       Получает все обновления, связанные с диалогом.
 *       Этот endpoint предназначен для внутреннего использования и не требует аутентификации.
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the dialog
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         required: true
 *         description: Tenant ID (можно также передать через заголовок X-Tenant-Id)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of updates to return
 *     responses:
 *       200:
 *         description: List of updates for the dialog
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Bad Request - tenantId is required
 *       404:
 *         description: Dialog not found
 *       500:
 *         description: Internal Server Error
 */
router.get('/dialogs/:dialogId/updates', eventsController.getDialogUpdates);

/**
 * @swagger
 * /api/messages/{messageId}/events:
 *   get:
 *     summary: Get events for a message
 *     tags: [Events & Updates]
 *     description: |
 *       Получает все события, связанные с сообщением.
 *       Этот endpoint предназначен для внутреннего использования и не требует аутентификации.
 *     parameters:
 *       - in: path
 *         name: messageId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the message
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         required: true
 *         description: Tenant ID (можно также передать через заголовок X-Tenant-Id)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of events to return
 *     responses:
 *       200:
 *         description: List of events for the message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Bad Request - tenantId is required
 *       404:
 *         description: Message not found
 *       500:
 *         description: Internal Server Error
 */
router.get('/messages/:messageId/events', eventsController.getMessageEvents);

/**
 * @swagger
 * /api/messages/{messageId}/updates:
 *   get:
 *     summary: Get updates for a message
 *     tags: [Events & Updates]
 *     description: |
 *       Получает все обновления, связанные с сообщением.
 *       Этот endpoint предназначен для внутреннего использования и не требует аутентификации.
 *     parameters:
 *       - in: path
 *         name: messageId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the message
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         required: true
 *         description: Tenant ID (можно также передать через заголовок X-Tenant-Id)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of updates to return
 *     responses:
 *       200:
 *         description: List of updates for the message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Bad Request - tenantId is required
 *       404:
 *         description: Message not found
 *       500:
 *         description: Internal Server Error
 */
router.get('/messages/:messageId/updates', eventsController.getMessageUpdates);

export default router;

