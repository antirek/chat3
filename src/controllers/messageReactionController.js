import { MessageReaction, Message, Dialog } from '../models/index.js';
import * as eventUtils from '../utils/eventUtils.js';
import * as reactionUtils from '../utils/reactionUtils.js';

const messageReactionController = {
  // Получить все реакции для сообщения
  async getMessageReactions(req, res) {
    try {
      const { messageId } = req.params;
      const { reaction, userId } = req.query;

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
        data: {
          reactions: reactions,
          counts: reactionCounts
        },
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

  // Добавить или обновить реакцию
  async addOrUpdateReaction(req, res) {
    try {
      const { messageId } = req.params;
      const { reaction } = req.body;
      const userId = req.userId || req.body.userId; // Из запроса или из middleware

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

      // Проверяем существующую реакцию этого пользователя
      const existingReaction = await MessageReaction.findOne({
        tenantId: req.tenantId,
        messageId: messageId,
        userId: userId
      });

      let reactionDoc;
      let eventType;
      let oldReaction = null;

      if (existingReaction) {
        // Обновляем существующую реакцию
        oldReaction = existingReaction.reaction;
        
        if (existingReaction.reaction === reaction) {
          // Та же реакция - ничего не делаем
          return res.json({
            data: existingReaction,
            message: 'Reaction already exists'
          });
        }

        // Обновляем реакцию
        existingReaction.reaction = reaction;
        existingReaction.updatedAt = new Date();
        reactionDoc = await existingReaction.save();

        eventType = 'message.reaction.update';

        // Обновляем счетчики: уменьшаем старую, увеличиваем новую
        await reactionUtils.decrementReactionCount(req.tenantId, messageId, oldReaction);
        await reactionUtils.incrementReactionCount(req.tenantId, messageId, reaction);
      } else {
        // Создаем новую реакцию
        reactionDoc = new MessageReaction({
          tenantId: req.tenantId,
          messageId: messageId,
          userId: userId,
          reaction: reaction
        });
        reactionDoc = await reactionDoc.save();

        eventType = 'message.reaction.add';

        // Увеличиваем счетчик новой реакции
        await reactionUtils.incrementReactionCount(req.tenantId, messageId, reaction);
      }

      // Получаем обновленное сообщение для получения актуальных счетчиков
      const updatedMessage = await Message.findOne({ messageId: messageId });

      // Создаем событие
      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: eventType,
        entityType: 'messageReaction',
        entityId: reactionDoc._id,
        actorId: userId,
        actorType: 'user',
        data: {
          dialogId: message.dialogId, // Добавляем dialogId для генерации MessageUpdate
          messageId: messageId,
          reaction: reaction,
          oldReaction: oldReaction,
          reactionCounts: updatedMessage.reactionCounts
        },
        metadata: eventUtils.extractMetadataFromRequest(req)
      });

      res.status(existingReaction ? 200 : 201).json({
        data: {
          reaction: reactionDoc,
          counts: updatedMessage.reactionCounts
        },
        message: existingReaction ? 'Reaction updated successfully' : 'Reaction added successfully'
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid message ID'
        });
      }
      if (error.code === 11000) {
        // Duplicate key error - реакция уже существует
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
  },

  // Удалить реакцию
  async removeReaction(req, res) {
    try {
      const { messageId, reaction } = req.params;
      const userId = req.userId || req.query.userId; // Из запроса или из middleware

      if (!userId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'User ID is required'
        });
      }

      // Проверяем, что сообщение существует
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
        tenantId: req.tenantId,
        messageId: messageId,
        userId: userId
      };

      // Если указан конкретный тип реакции, удаляем только его
      if (reaction) {
        filter.reaction = reaction;
      }

      // Находим реакцию для события
      const reactionToDelete = await MessageReaction.findOne(filter);

      if (!reactionToDelete) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Reaction not found'
        });
      }

      // Удаляем реакцию
      await MessageReaction.deleteOne({ _id: reactionToDelete._id });

      // Уменьшаем счетчик
      await reactionUtils.decrementReactionCount(req.tenantId, messageId, reactionToDelete.reaction);

      // Получаем обновленное сообщение для получения актуальных счетчиков
      const updatedMessage = await Message.findOne({ messageId: messageId });

      // Создаем событие
      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'message.reaction.remove',
        entityType: 'messageReaction',
        entityId: reactionToDelete._id,
        actorId: userId,
        actorType: 'user',
        data: {
          dialogId: message.dialogId, // Добавляем dialogId для генерации MessageUpdate
          messageId: messageId,
          reaction: reactionToDelete.reaction,
          reactionCounts: updatedMessage.reactionCounts
        },
        metadata: eventUtils.extractMetadataFromRequest(req)
      });

      res.json({
        data: {
          counts: updatedMessage.reactionCounts
        },
        message: 'Reaction removed successfully'
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
  }
};

export default messageReactionController;

