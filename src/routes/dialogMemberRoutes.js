import express from 'express';
import dialogMemberController from '../controllers/dialogMemberController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validateDialogId } from '../validators/urlValidators/index.js';
import { validateBody } from '../validators/middleware.js';
import { setUnreadCountSchema, addDialogMemberSchema } from '../validators/schemas/index.js';

const router = express.Router();

/**
 * @swagger
 * /api/dialogs/{dialogId}/members/add:
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
 *               type:
 *                 type: string
 *                 description: User type (user, bot, contact, etc.)
 *                 example: "user"
 *               name:
 *                 type: string
 *                 description: User name
 *                 example: "Carl Johnson"
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
 *       404:
 *         description: Dialog not found
 */
router.post('/:dialogId/members/add', apiAuth, requirePermission('write'), validateDialogId, validateBody(addDialogMemberSchema), dialogMemberController.addDialogMember);

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
router.post('/:dialogId/members/:userId/remove', apiAuth, requirePermission('write'), validateDialogId, validateUserId, dialogMemberController.removeDialogMember);

/**
 * @swagger
 * /api/dialogs/{dialogId}/members/{userId}/unread:
 *   patch:
 *     summary: Manually set unread count for a dialog member
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               unreadCount:
 *                 type: integer
 *                 minimum: 0
 *               lastSeenAt:
 *                 type: integer
 *                 description: Optional microsecond timestamp to use for lastSeenAt
 *               reason:
 *                 type: string
 *                 description: Optional reason for audit trail
 *             required:
 *               - unreadCount
 *     responses:
 *       200:
 *         description: Unread count updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/DialogMember'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Dialog or member not found
 */
router.patch(
  '/:dialogId/members/:userId/unread',
  apiAuth,
  requirePermission('write'),
  validateDialogId,
  validateUserId,
  validateBody(setUnreadCountSchema),
  dialogMemberController.setUnreadCount
);

export default router;
