import { MessageReaction, Message, Dialog } from '../../../models/index.js';
import * as eventUtils from '../utils/eventUtils.js';
import * as metaUtils from '../utils/metaUtils.js';
import { sanitizeResponse } from '../utils/responseUtils.js';
import { buildReactionSet } from '../utils/userDialogUtils.js';

const messageReactionController = {
  // Получить все реакции для сообщения
  async getMessageReactions(req, res) {
    try {
      const { messageId, userId: pathUserId } = req.params;
      const { reaction, userId: queryUserId } = req.query;
      // userId из пути имеет приоритет над query параметром
      const userId = pathUserId || queryUserId;

      // Проверяем, что сообщение существует и принадлежит tenant
      const message = await Message.findOne({
        messageId: messageId,
        tenantId: req.tenantId
      });

      if (!message) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
      }

      // Формируем фильтр
      const filter = {
        messageId: messageId,
        tenantId: req.tenantId
      };

      if (reaction) {
        filter.reaction = reaction;
      }

      if (userId) {
        filter.userId = userId;
      }

      // Получаем реакции
      const reactions = await MessageReaction.find(filter)
        .select('-__v')
        .sort({ createdAt: -1 });

      res.json({
        data: sanitizeResponse({
          reactions: reactions
        }),
        message: 'Message reactions retrieved successfully'
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid message ID'
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Установить или снять реакцию (set/unset)
  async setOrUnsetReaction(req, res) {
    try {
      const { messageId, action, userId: pathUserId } = req.params;
      const { reaction } = req.body;
      // userId берется из пути запроса или из middleware
      const userId = pathUserId || req.userId;

      if (!userId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'User ID is required'
        });
      }

      if (!reaction) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Reaction is required'
        });
      }

      // Проверяем, что сообщение существует и принадлежит tenant
      const message = await Message.findOne({
        messageId: messageId,
        tenantId: req.tenantId
      });

      if (!message) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
      }

      if (action === 'set') {
        // Устанавливаем реакцию
        const existingReaction = await MessageReaction.findOne({
          tenantId: req.tenantId,
          messageId: messageId,
          userId: userId,
          reaction: reaction
        });

        if (existingReaction) {
          // Реакция уже существует
          return res.json({
            data: existingReaction,
            message: 'Reaction already exists'
          });
        }

        // Создаем новую реакцию
        const reactionDoc = new MessageReaction({
          tenantId: req.tenantId,
          messageId: messageId,
          userId: userId,
          reaction: reaction
        });
        await reactionDoc.save();

        // Получаем диалог и его метаданные для события
        const dialog = await Dialog.findOne({
          dialogId: message.dialogId,
          tenantId: req.tenantId
        }).lean();

        if (!dialog) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Dialog not found'
          });
        }

        const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialog.dialogId);
        const dialogSection = eventUtils.buildDialogSection({
          dialogId: dialog.dialogId,
          tenantId: dialog.tenantId,
          createdAt: dialog.createdAt,
          meta: dialogMeta || {}
        });

        // Формируем reactionSet для события
        const reactionSet = await buildReactionSet(req.tenantId, messageId, userId);

        const messageSection = eventUtils.buildMessageSection({
          messageId,
          dialogId: message.dialogId,
          senderId: message.senderId,
          type: message.type,
          content: message.content,
          reactionUpdate: {
            userId,
            reaction,
            oldReaction: null,
            reactionSet: reactionSet
          }
        });

        const reactionContext = eventUtils.buildEventContext({
          eventType: 'message.reaction.update',
          dialogId: message.dialogId,
          entityId: messageId,
          messageId,
          includedSections: ['dialog', 'message'],
          updatedFields: ['message.reaction']
        });

        await eventUtils.createEvent({
          tenantId: req.tenantId,
          eventType: 'message.reaction.update',
          entityType: 'messageReaction',
          entityId: messageId,
          actorId: userId,
          actorType: 'user',
          data: eventUtils.composeEventData({
            context: reactionContext,
            dialog: dialogSection,
            message: messageSection
          })
        });

        res.status(201).json({
          data: sanitizeResponse({
            reaction: reactionDoc
          }),
          message: 'Reaction set successfully'
        });
      } else if (action === 'unset') {
        // Снимаем реакцию
        const reactionToDelete = await MessageReaction.findOne({
          tenantId: req.tenantId,
          messageId: messageId,
          userId: userId,
          reaction: reaction
        });

        if (!reactionToDelete) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Reaction not found'
          });
        }

        // Удаляем реакцию
        await MessageReaction.deleteOne({ _id: reactionToDelete._id });

        // Получаем диалог и его метаданные для события
        const dialog = await Dialog.findOne({
          dialogId: message.dialogId,
          tenantId: req.tenantId
        }).lean();

        if (!dialog) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Dialog not found'
          });
        }

        const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialog.dialogId);
        const dialogSection = eventUtils.buildDialogSection({
          dialogId: dialog.dialogId,
          tenantId: dialog.tenantId,
          createdAt: dialog.createdAt,
          meta: dialogMeta || {}
        });

        // Формируем reactionSet для события
        const reactionSet = await buildReactionSet(req.tenantId, messageId, userId);

        const removeContext = eventUtils.buildEventContext({
          eventType: 'message.reaction.update',
          dialogId: message.dialogId,
          entityId: messageId,
          messageId,
          includedSections: ['dialog', 'message'],
          updatedFields: ['message.reaction']
        });

        const removeMessageSection = eventUtils.buildMessageSection({
          messageId,
          dialogId: message.dialogId,
          senderId: message.senderId,
          type: message.type,
          content: message.content,
          reactionUpdate: {
            userId,
            reaction: null,
            oldReaction: reactionToDelete.reaction,
            reactionSet: reactionSet
          }
        });

        await eventUtils.createEvent({
          tenantId: req.tenantId,
          eventType: 'message.reaction.update',
          entityType: 'messageReaction',
          entityId: messageId,
          actorId: userId,
          actorType: 'user',
          data: eventUtils.composeEventData({
            context: removeContext,
            dialog: dialogSection,
            message: removeMessageSection
          })
        });

        res.json({
          data: sanitizeResponse({}),
          message: 'Reaction unset successfully'
        });
      }
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid message ID'
        });
      }
      if (error.code === 11000) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Reaction already exists for this user and message'
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

export default messageReactionController;

