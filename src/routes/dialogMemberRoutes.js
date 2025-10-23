import express from 'express';
import dialogMemberController from '../controllers/dialogMemberController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';

const router = express.Router();

/**
 * @swagger
 * /api/dialogs/{dialogId}/members/{userId}/unread-count:
 *   get:
 *     summary: Get unread message count for a user in a specific dialog
 *     tags: [DialogMember]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *         description: Dialog ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     dialogId:
 *                       type: string
 *                     unreadCount:
 *                       type: integer
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get('/:dialogId/members/:userId/unread-count', apiAuth, requirePermission('read'), dialogMemberController.getUserDialogUnreadCount);

/**
 * @swagger
 * /api/dialogs/{dialogId}/members/{userId}/unread-count/sync:
 *   post:
 *     summary: Sync unread count for a user in a specific dialog
 *     tags: [DialogMember]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *         description: Dialog ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Unread count synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     dialogId:
 *                       type: string
 *                     unreadCount:
 *                       type: integer
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.post('/:dialogId/members/:userId/unread-count/sync', apiAuth, requirePermission('write'), dialogMemberController.syncUserDialogUnreadCount);

/**
 * @swagger
 * /api/dialogs/{dialogId}/members/{userId}/unread-count/reset:
 *   post:
 *     summary: Reset unread count for a user in a specific dialog
 *     tags: [DialogMember]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *         description: Dialog ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Unread count reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     dialogId:
 *                       type: string
 *                     unreadCount:
 *                       type: integer
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.post('/:dialogId/members/:userId/unread-count/reset', apiAuth, requirePermission('write'), dialogMemberController.resetUserDialogUnreadCount);

/**
 * @swagger
 * /api/dialogs/{dialogId}/members/{userId}/last-seen:
 *   put:
 *     summary: Update last seen time for a user in a dialog
 *     tags: [DialogMember]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *         description: Dialog ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Last seen updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     dialogId:
 *                       type: string
 *                     lastSeenAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.put('/:dialogId/members/:userId/last-seen', apiAuth, requirePermission('write'), dialogMemberController.updateLastSeen);

/**
 * @swagger
 * /api/dialogs/{dialogId}/members:
 *   get:
 *     summary: Get all members of a dialog
 *     tags: [DialogMember]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *         description: Dialog ID
 *     responses:
 *       200:
 *         description: Dialog members retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get('/:dialogId/members', apiAuth, requirePermission('read'), dialogMemberController.getDialogMembers);

/**
 * @swagger
 * /api/dialogs/{dialogId}/members:
 *   post:
 *     summary: Add a member to a dialog
 *     tags: [DialogMember]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *         description: Dialog ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID to add to dialog
 *                 example: "carl"
 *     responses:
 *       201:
 *         description: Member added to dialog successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     dialogId:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad Request - Missing required fields
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.post('/:dialogId/members', apiAuth, requirePermission('write'), dialogMemberController.addDialogMember);

/**
 * @swagger
 * /api/dialogs/{dialogId}/members/{userId}:
 *   delete:
 *     summary: Remove a member from a dialog
 *     tags: [DialogMember]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *         description: Dialog ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Member removed from dialog successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.delete('/:dialogId/members/:userId', apiAuth, requirePermission('delete'), dialogMemberController.removeDialogMember);

/**
 * @swagger
 * /api/dialog-members:
 *   get:
 *     summary: Get all dialog members for a tenant
 *     tags: [DialogMember]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
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
 *     responses:
 *       200:
 *         description: Dialog members retrieved successfully
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
router.get('/', apiAuth, requirePermission('read'), dialogMemberController.getAllDialogMembers);

export default router;
