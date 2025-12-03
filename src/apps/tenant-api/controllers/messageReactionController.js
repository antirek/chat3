import { MessageReaction, Message, Dialog } from '../../../models/index.js';
import * as eventUtils from '../utils/eventUtils.js';
import * as reactionUtils from '../utils/reactionUtils.js';
import { sanitizeResponse } from '../utils/responseUtils.js';

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

      // Получаем агрегированные счетчики из Message
      const reactionCounts = message.reactionCounts || {};

      res.json({
        data: sanitizeResponse({
          reactions: reactions,
          counts: reactionCounts
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
      const { reaction, userId: bodyUserId } = req.body;
      // Приоритет: userId из пути > userId из тела запроса > userId из middleware
      const userId = pathUserId || bodyUserId || req.userId;

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

        // Увеличиваем счетчик
        await reactionUtils.incrementReactionCount(req.tenantId, messageId, reaction);

        // Получаем обновленное сообщение
        const updatedMessage = await Message.findOne({ messageId: messageId });

        const dialogSection = eventUtils.buildDialogSection({
          dialogId: message.dialogId
        });

        const memberSection = eventUtils.buildMemberSection({
          userId
        });

        const actorSection = eventUtils.buildActorSection({
          actorId: userId,
          actorType: 'user'
        });

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
            counts: updatedMessage.reactionCounts
          }
        });

        const reactionContext = eventUtils.buildEventContext({
          eventType: 'message.reaction.add',
          dialogId: message.dialogId,
          entityId: messageId,
          messageId,
          includedSections: ['dialog', 'message.reaction', 'member', 'actor'],
          updatedFields: ['message.reaction']
        });

        await eventUtils.createEvent({
          tenantId: req.tenantId,
          eventType: 'message.reaction.add',
          entityType: 'messageReaction',
          entityId: messageId,
          actorId: userId,
          actorType: 'user',
          data: eventUtils.composeEventData({
            context: reactionContext,
            dialog: dialogSection,
            member: memberSection,
            message: messageSection,
            actor: actorSection
          })
        });

        res.status(201).json({
          data: sanitizeResponse({
            reaction: reactionDoc,
            counts: updatedMessage.reactionCounts
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

        // Уменьшаем счетчик
        await reactionUtils.decrementReactionCount(req.tenantId, messageId, reaction);

        // Получаем обновленное сообщение
        const updatedMessage = await Message.findOne({ messageId: messageId });

        const dialogSection = eventUtils.buildDialogSection({
          dialogId: message.dialogId
        });

        const memberSection = eventUtils.buildMemberSection({
          userId
        });

        const actorSection = eventUtils.buildActorSection({
          actorId: userId,
          actorType: 'user'
        });

        const removeContext = eventUtils.buildEventContext({
          eventType: 'message.reaction.remove',
          dialogId: message.dialogId,
          entityId: messageId,
          messageId,
          includedSections: ['dialog', 'message.reaction', 'member', 'actor'],
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
            counts: updatedMessage.reactionCounts
          }
        });

        await eventUtils.createEvent({
          tenantId: req.tenantId,
          eventType: 'message.reaction.remove',
          entityType: 'messageReaction',
          entityId: messageId,
          actorId: userId,
          actorType: 'user',
          data: eventUtils.composeEventData({
            context: removeContext,
            dialog: dialogSection,
            member: memberSection,
            message: removeMessageSection,
            actor: actorSection
          })
        });

        res.json({
          data: sanitizeResponse({
            counts: updatedMessage.reactionCounts
          }),
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

