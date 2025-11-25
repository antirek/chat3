import express from 'express';
import messageController from '../controllers/messageController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validateMessageId } from '../validators/urlValidators/index.js';
import { validateBody, validateQuery } from '../validators/middleware.js';
import { messagesQuerySchema, updateMessageContentSchema } from '../validators/schemas/index.js';

const router = express.Router();

/**
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Get all messages with filtering and pagination
 *     tags: [Messages]
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
 *             - (senderId,eq,carl) - messages from sender 'carl'
 *             - (content,regex,привет) - messages containing 'привет'
 *             - (type,eq,internal.text)&(senderId,eq,carl) - internal text messages from carl
 *             - (senderId,in,[carl,sara]) - messages from carl or sara
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: |
 *           Sort format: (field,direction)
 *           - Examples:
 *             - (createdAt,desc) - newest first
 *             - (createdAt,asc) - oldest first
 *             - (senderId,asc) - by sender alphabetically
 *     responses:
 *       200:
 *         description: List of messages with meta data and statuses
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
 *                       dialogId:
 *                         type: string
 *                       meta:
 *                         type: object
 *                         description: Message meta data
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
 *                       updatedAt:
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
 *         description: Bad Request - Invalid filter or sort format
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal Server Error
 */
router.get('/', apiAuth, requirePermission('read'), validateQuery(messagesQuerySchema), messageController.getAll);

/**
 * @swagger
 * /api/messages/{messageId}/events:
 *   get:
 *     summary: Get events for a message
 *     tags: [Messages]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the message
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of events to return
 *     responses:
 *       200:
 *         description: List of events for the message
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
 *       404:
 *         description: Message not found
 *       500:
 *         description: Internal Server Error
 */
router.get('/:messageId/events', apiAuth, requirePermission('read'), validateMessageId, messageController.getMessageEvents);

/**
 * @swagger
 * /api/messages/{messageId}:
 *   get:
 *     summary: Get a message by ID
 *     tags: [Messages]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the message to retrieve
 *     responses:
 *       200:
 *         description: Message data
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
 *                     dialogId:
 *                       type: string
 *                     meta:
 *                       type: object
 *                     statuses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                           status:
 *                             type: string
 *                           readAt:
 *                             type: string
 *                             format: date-time
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Message not found
 *       500:
 *         description: Internal Server Error
 */
router.get('/:messageId', apiAuth, requirePermission('read'), validateMessageId, messageController.getMessageById);

/**
 * @swagger
 * /api/messages/{messageId}:
 *   put:
 *     summary: Update message content
 *     description: Updates only the content of the message. All other fields remain unchanged.
 *     tags: [Messages]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the message to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: New message content
 *                 example: "Updated message text"
 *     responses:
 *       200:
 *         description: Message content updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *                   example: "Message content updated successfully"
 *       400:
 *         description: Bad Request - Invalid content or validation error
 *       401:
 *         description: Unauthorized - Invalid API key
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Message not found
 *       500:
 *         description: Internal Server Error
 */
router.put(
  '/:messageId',
  apiAuth,
  requirePermission('write'),
  validateMessageId,
  validateBody(updateMessageContentSchema),
  messageController.updateMessageContent
);

export default router;