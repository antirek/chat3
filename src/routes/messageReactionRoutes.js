import express from 'express';
import messageReactionController from '../controllers/messageReactionController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';

const router = express.Router();

/**
 * @swagger
 * /api/messages/{messageId}/reactions:
 *   get:
 *     summary: Get all reactions for a message
 *     tags: [MessageReactions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *       - in: query
 *         name: reaction
 *         schema:
 *           type: string
 *         description: Filter by reaction type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *     responses:
 *       200:
 *         description: Reactions retrieved successfully
 *       404:
 *         description: Message not found
 */
router.get('/:messageId/reactions', 
  apiAuth,
  requirePermission('read'),
  messageReactionController.getMessageReactions
);

/**
 * @swagger
 * /api/messages/{messageId}/reactions:
 *   post:
 *     summary: Add or update reaction for a message
 *     tags: [MessageReactions]
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
 *               - reaction
 *             properties:
 *               reaction:
 *                 type: string
 *                 description: Reaction type (emoji or text)
 *                 example: "👍"
 *               userId:
 *                 type: string
 *                 description: User ID (if not provided in middleware)
 *     responses:
 *       201:
 *         description: Reaction added successfully
 *       200:
 *         description: Reaction updated successfully
 *       404:
 *         description: Message not found
 */
router.post('/:messageId/reactions',
  apiAuth,
  requirePermission('write'),
  messageReactionController.addOrUpdateReaction
);

/**
 * @swagger
 * /api/messages/{messageId}/reactions/{reaction}:
 *   delete:
 *     summary: Remove reaction from a message
 *     tags: [MessageReactions]
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
 *         name: reaction
 *         required: true
 *         schema:
 *           type: string
 *         description: Reaction type to remove
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: User ID (if not provided in middleware)
 *     responses:
 *       200:
 *         description: Reaction removed successfully
 *       404:
 *         description: Reaction not found
 */
router.delete('/:messageId/reactions/:reaction',
  apiAuth,
  requirePermission('write'),
  messageReactionController.removeReaction
);

export default router;

