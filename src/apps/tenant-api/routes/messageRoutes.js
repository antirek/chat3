import express from 'express';
import messageController from '../controllers/messageController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validateDialogId } from '../validators/urlValidators/index.js';
import { validateBody, validateQuery } from '../validators/middleware.js';
import { createMessageSchema, messagesQuerySchema } from '../validators/schemas/index.js';

const router = express.Router();

/**
 * @swagger
 * /api/dialogs/{dialogId}/messages:
 *   get:
 *     summary: Get messages for a specific dialog
 *     tags: [Messages]
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
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: |
 *           Advanced filter format with operators:
 *           - Simple: (field,operator,value)
 *           - Multiple: (field1,op1,val1)&(field2,op2,val2)
 *           - Operators: eq, ne, in, nin, gt, gte, lt, lte, regex, exists
 *           - Meta filters: (meta.key,operator,value)
 *           - Examples:
 *             - (type,eq,internal.text) - internal text messages
 *             - (type,eq,internal.text) - internal text messages
 *             - (senderId,eq,carl) - messages from sender 'carl'
 *             - (meta.channelType,eq,whatsapp) - WhatsApp messages
 *             - (meta.channelId,eq,W0000) - messages with channel ID W0000
 *             - (type,eq,internal.text)&(meta.channelType,eq,telegram) - internal text messages from Telegram
 *             - (senderId,in,[carl,sara]) - messages from carl or sara
 *             - (meta.channelType,ne,telegram) - messages not from Telegram
 *     responses:
 *       200:
 *         description: List of messages with meta data
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
 *                       content:
 *                         type: string
 *                       senderId:
 *                         type: string
 *                       type:
 *                         type: string
 *                       tenantId:
 *                         type: object
 *                       dialogId:
 *                         type: object
 *                       meta:
 *                         type: object
 *                         description: Message meta data (channelType, channelId)
 *                       statuses:
 *                         type: array
 *                         description: Array of message statuses sorted by date (newest first)
 *                         items:
 *                           type: object
 *                           properties:
 *                             userId:
 *                               type: string
 *                             status:
 *                               type: string
 *                               enum: [sent, delivered, read]
 *                             readAt:
 *                               type: string
 *                               format: date-time
 *                             createdAt:
 *                               type: string
 *                               format: date-time
 *                       createdAt:
 *                         type: string
 *                         format: date-time
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
 *         description: Bad Request - Invalid dialog ID or filter format
 *       404:
 *         description: Dialog not found
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get('/:dialogId/messages', apiAuth, requirePermission('read'), validateDialogId, validateQuery(messagesQuerySchema), messageController.getDialogMessages);

/**
 * @swagger
 * /api/dialogs/{dialogId}/messages:
 *   post:
 *     summary: Create new message in dialog
 *     tags: [Messages]
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
 *               - content
 *               - senderId
 *             properties:
 *               content:
 *                 type: string
 *                 description: Message content
 *                 example: "Hello, how are you?"
 *               senderId:
 *                 type: string
 *                 description: Sender ID (string, not ObjectId)
 *                 example: "carl"
 *               type:
 *                 type: string
 *                 description: Message type
 *                 default: "internal.text"
 *                 example: "internal.text"
 *               meta:
 *                 type: object
 *                 description: Message meta data
 *                 properties:
 *                   channelType:
 *                     type: string
 *                     example: "whatsapp"
 *                   channelId:
 *                     type: string
 *                     example: "W0000"
 *                   priority:
 *                     type: string
 *                     example: "high"
 *                 example:
 *                   channelType: "whatsapp"
 *                   channelId: "W0000"
 *                   priority: "high"
 *     responses:
 *       201:
 *         description: Message created successfully
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
 *                     content:
 *                       type: string
 *                     senderId:
 *                       type: string
 *                     type:
 *                       type: string
 *                     tenantId:
 *                       type: object
 *                     dialogId:
 *                       type: object
 *                     meta:
 *                       type: object
 *                       description: Message meta data
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *                   example: "Message created successfully"
 *       400:
 *         description: Bad Request - Missing required fields or validation error
 *       404:
 *         description: Dialog not found
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.post('/:dialogId/messages', apiAuth, requirePermission('write'), validateDialogId, validateBody(createMessageSchema), messageController.createMessage);


export default router;
