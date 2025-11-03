import express from 'express';
import dialogMemberController from '../controllers/dialogMemberController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';

const router = express.Router();

/**
 * @swagger
 * /api/dialogs/{dialogId}/members/{userId}/add:
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
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to add to dialog
 *         example: "carl"
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
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.post('/:dialogId/members/:userId/add', apiAuth, requirePermission('write'), dialogMemberController.addDialogMember);

/**
 * @swagger
 * /api/dialogs/{dialogId}/members/{userId}/remove:
 *   post:
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
 *         description: User ID to remove from dialog
 *         example: "carl"
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
router.post('/:dialogId/members/:userId/remove', apiAuth, requirePermission('write'), dialogMemberController.removeDialogMember);

export default router;
