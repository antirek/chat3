import express from 'express';
import messageStatusController from '../controllers/messageStatusController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validateMessageId, validateUserId, validateStatus } from '../validators/urlValidators/index.js';

const router = express.Router();

/**
 * @swagger
 * /api/messages/{messageId}/status/{userId}/{status}:
 *   post:
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
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *         example: "carl"
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
 *         description: Bad Request - Invalid status
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.post('/:messageId/status/:userId/:status', apiAuth, requirePermission('write'), validateMessageId, validateUserId, validateStatus, messageStatusController.updateMessageStatus);

export default router;
