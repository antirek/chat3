import express from 'express';
import messageStatusController from '../controllers/messageStatusController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';

const router = express.Router();

/**
 * @swagger
 * /api/messages/{messageId}/status:
 *   get:
 *     summary: Get message status for a specific message
 *     tags: [MessageStatus]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message statuses retrieved successfully
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
 *                       _id:
 *                         type: string
 *                       messageId:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [unread, delivered, read]
 *                       readAt:
 *                         type: string
 *                         format: date-time
 *                       deliveredAt:
 *                         type: string
 *                         format: date-time
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 message:
 *                   type: string
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get('/:messageId/status', apiAuth, requirePermission('read'), messageStatusController.getMessageStatus);

/**
 * @swagger
 * /api/messages/{messageId}/status:
 *   put:
 *     summary: Update message status (mark as read/delivered)
 *     tags: [MessageStatus]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - status
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID
 *                 example: "carl"
 *               status:
 *                 type: string
 *                 enum: [unread, delivered, read]
 *                 description: New status
 *                 example: "read"
 *             example:
 *               userId: "carl"
 *               status: "read"
 *     responses:
 *       200:
 *         description: Message status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     messageId:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     readAt:
 *                       type: string
 *                       format: date-time
 *                     deliveredAt:
 *                       type: string
 *                       format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad Request - Missing required fields or invalid status
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.put('/:messageId/status', apiAuth, requirePermission('write'), messageStatusController.updateMessageStatus);

/**
 * @swagger
 * /api/users/{userId}/unread:
 *   get:
 *     summary: Get unread messages for a user
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
 *         description: Number of messages per page
 *     responses:
 *       200:
 *         description: Unread messages retrieved successfully
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
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get('/users/:userId/unread', apiAuth, requirePermission('read'), messageStatusController.getUnreadMessages);

/**
 * @swagger
 * /api/dialogs/{dialogId}/unread:
 *   get:
 *     summary: Get unread messages for a dialog
 *     tags: [MessageStatus]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *         description: Dialog ID
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by specific user
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
 *         description: Number of messages per page
 *     responses:
 *       200:
 *         description: Unread messages for dialog retrieved successfully
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
 *       404:
 *         description: Dialog not found
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get('/dialogs/:dialogId/unread', apiAuth, requirePermission('read'), messageStatusController.getDialogUnreadMessages);

export default router;
