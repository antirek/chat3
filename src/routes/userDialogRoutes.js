import express from 'express';
import userDialogController from '../controllers/userDialogController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validateUserId } from '../validators/urlValidators/index.js';
import { validateQuery } from '../validators/middleware.js';
import { userDialogsQuerySchema } from '../validators/schemas/index.js';

const router = express.Router();

/**
 * @swagger
 * /api/users/{userId}/dialogs:
 *   get:
 *     summary: Get user's dialogs with pagination and sorting by last interaction
 *     tags: [UserDialogs]
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
 *         description: Number of items per page
 *       - in: query
 *         name: includeLastMessage
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include last message for each dialog
 *     responses:
 *       200:
 *         description: User dialogs retrieved successfully
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
 *                       dialogId:
 *                         type: string
 *                       dialogName:
 *                         type: string
 *                       unreadCount:
 *                         type: integer
 *                       lastSeenAt:
 *                         type: string
 *                         format: date-time
 *                       lastMessageAt:
 *                         type: string
 *                         format: date-time
 *                       isActive:
 *                         type: boolean
 *                       joinedAt:
 *                         type: string
 *                         format: date-time
 *                       lastInteractionAt:
 *                         type: string
 *                         format: date-time
 *                       lastMessage:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           content:
 *                             type: string
 *                           senderId:
 *                             type: string
 *                           type:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
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
router.get('/:userId/dialogs', apiAuth, requirePermission('read'), validateUserId, validateQuery(userDialogsQuerySchema), userDialogController.getUserDialogs);

/**
 * @swagger
 * /api/users/{userId}/dialogs/{dialogId}/messages:
 *   get:
 *     summary: Get messages from a dialog in context of specific user
 *     description: Returns messages with user-specific data (myStatus, isMine, myReaction). Only accessible if user is a dialog member.
 *     tags: [UserDialogs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *         description: Dialog ID
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
 *         description: Number of messages per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: -createdAt
 *         description: Sort order (e.g., -createdAt for newest first)
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: Filter expression (e.g., (senderId,eq,john))
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
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
 *                       messageId:
 *                         type: string
 *                       dialogId:
 *                         type: string
 *                       senderId:
 *                         type: string
 *                       content:
 *                         type: string
 *                       type:
 *                         type: string
 *                       createdAt:
 *                         type: number
 *                       updatedAt:
 *                         type: number
 *                       reactionCounts:
 *                         type: object
 *                       meta:
 *                         type: object
 *                       isMine:
 *                         type: boolean
 *                         description: True if current user is the sender
 *                       myStatus:
 *                         type: string
 *                         enum: [sent, unread, delivered, read]
 *                         description: Message status for current user
 *                       myReaction:
 *                         type: string
 *                         nullable: true
 *                         description: Current user's reaction (emoji) or null
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
 *         description: Forbidden - User is not a member of this dialog
 *       404:
 *         description: Dialog not found
 */
router.get('/:userId/dialogs/:dialogId/messages', apiAuth, requirePermission('read'), validateUserId, userDialogController.getUserDialogMessages);

export default router;
