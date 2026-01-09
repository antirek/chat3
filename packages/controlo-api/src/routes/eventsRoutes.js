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

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Get all events with pagination
 *     tags: [Events & Updates]
 *     description: |
 *       Получает все события с пагинацией и фильтрацией.
 *       События отсортированы в обратном хронологическом порядке (новые первыми).
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         required: true
 *         description: Tenant ID (можно также передать через заголовок X-Tenant-Id)
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
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *         description: Filter by event type
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *         description: Filter by entity type
 *       - in: query
 *         name: entityId
 *         schema:
 *           type: string
 *         description: Filter by entity ID
 *       - in: query
 *         name: actorId
 *         schema:
 *           type: string
 *         description: Filter by actor ID
 *     responses:
 *       200:
 *         description: List of events with pagination
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
 *         description: Bad Request - tenantId is required
 *       500:
 *         description: Internal Server Error
 */
router.get('/events', eventsController.getAllEvents);

/**
 * @swagger
 * /api/updates:
 *   get:
 *     summary: Get all updates with pagination
 *     tags: [Events & Updates]
 *     description: |
 *       Получает все обновления с пагинацией и фильтрацией.
 *       Обновления отсортированы в обратном хронологическом порядке (новые первыми).
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         required: true
 *         description: Tenant ID (можно также передать через заголовок X-Tenant-Id)
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
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: dialogId
 *         schema:
 *           type: string
 *         description: Filter by dialog ID
 *       - in: query
 *         name: entityId
 *         schema:
 *           type: string
 *         description: Filter by entity ID
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *         description: Filter by event type
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *         description: Filter by event ID (ObjectId)
 *       - in: query
 *         name: published
 *         schema:
 *           type: boolean
 *         description: Filter by published status
 *     responses:
 *       200:
 *         description: List of updates with pagination
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
 *         description: Bad Request - tenantId is required
 *       500:
 *         description: Internal Server Error
 */
router.get('/updates', eventsController.getAllUpdates);

export default router;

