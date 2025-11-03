import express from 'express';
import dialogMemberController from '../controllers/dialogMemberController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';

const router = express.Router();

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

export default router;
