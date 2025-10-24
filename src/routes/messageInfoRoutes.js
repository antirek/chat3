import express from 'express';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import messageController from '../controllers/messageController.js';

const router = express.Router();

/**
 * @swagger
 * /api/messages/{messageId}:
 *   get:
 *     summary: Get message by ID
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 content:
 *                   type: string
 *                 senderId:
 *                   type: string
 *                 type:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                 dialogId:
 *                   type: string
 *                 tenantId:
 *                   type: string
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get('/:messageId', apiAuth, requirePermission('read'), messageController.getMessageById);

export default router;
