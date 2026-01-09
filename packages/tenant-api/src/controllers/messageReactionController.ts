import { MessageReaction, Message, Dialog } from '@chat3/models';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { buildReactionSet } from '@chat3/utils/userDialogUtils.js';
import { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/apiAuth.js';

const messageReactionController = {
  // Получить все реакции для сообщения
  async getMessageReactions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /users/:userId/dialogs/:dialogId/messages/:messageId/reactions';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { messageId, userId: pathUserId } = req.params;
      const { reaction, userId: queryUserId } = req.query as { reaction?: string; userId?: string };
      // userId из пути имеет приоритет над query параметром
      const userId = pathUserId || queryUserId;
      log(`Получены параметры: messageId=${messageId}, userId=${userId || 'нет'}, reaction=${reaction || 'нет'}`);

      // Проверяем, что сообщение существует и принадлежит tenant
      log(`Поиск сообщения: messageId=${messageId}, tenantId=${req.tenantId}`);
      const message = await Message.findOne({
        messageId: messageId,
        tenantId: req.tenantId!
      });

      if (!message) {
        log(`Сообщение не найдено: messageId=${messageId}`);
        res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
        return;
      }
      log(`Сообщение найдено: messageId=${message.messageId}`);

      // Формируем фильтр
      const filter: any = {
        messageId: messageId,
        tenantId: req.tenantId!
      };

      if (reaction) {
        filter.reaction = reaction;
      }

      if (userId) {
        filter.userId = userId;
      }

      // Получаем реакции
      log(`Поиск реакций: filter=${JSON.stringify(filter)}`);
      const reactions = await MessageReaction.find(filter)
        .select('-__v')
        .sort({ createdAt: -1 });
      log(`Найдено реакций: ${reactions.length}`);

      log(`Отправка ответа: ${reactions.length} реакций`);
      res.json({
        data: sanitizeResponse({
          reactions: reactions
        }),
        message: 'Message reactions retrieved successfully'
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      if (error.name === 'CastError') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid message ID'
        });
        return;
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Установить или снять реакцию (set/unset)
  async setOrUnsetReaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'post /users/:userId/dialogs/:dialogId/messages/:messageId/reactions/:action';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { messageId, action, userId: pathUserId } = req.params;
      const { reaction } = req.body as { reaction?: string };
      // userId берется из пути запроса или из middleware
      const userId = pathUserId || req.userId;
      log(`Получены параметры: messageId=${messageId}, action=${action}, userId=${userId}, reaction=${reaction || 'нет'}`);

      if (!userId) {
        log(`Ошибка валидации: отсутствует userId`);
        res.status(400).json({
          error: 'Bad Request',
          message: 'User ID is required'
        });
        return;
      }

      if (!reaction) {
        log(`Ошибка валидации: отсутствует reaction`);
        res.status(400).json({
          error: 'Bad Request',
          message: 'Reaction is required'
        });
        return;
      }

      // Проверяем, что сообщение существует и принадлежит tenant
      log(`Поиск сообщения: messageId=${messageId}, tenantId=${req.tenantId}`);
      const message = await Message.findOne({
        messageId: messageId,
        tenantId: req.tenantId!
      });

      if (!message) {
        log(`Сообщение не найдено: messageId=${messageId}`);
        res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
        return;
      }
      log(`Сообщение найдено: messageId=${message.messageId}`);

      if (action === 'set') {
        log(`Установка реакции: messageId=${messageId}, userId=${userId}, reaction=${reaction}`);
        // Устанавливаем реакцию
        const existingReaction = await MessageReaction.findOne({
          tenantId: req.tenantId!,
          messageId: messageId,
          userId: userId,
          reaction: reaction
        });

        if (existingReaction) {
          // Реакция уже существует
          log(`Реакция уже существует: messageId=${messageId}, userId=${userId}, reaction=${reaction}`);
          res.json({
            data: existingReaction,
            message: 'Reaction already exists'
          });
          return;
        }

        // Создаем новую реакцию
        log(`Создание новой реакции: messageId=${messageId}, userId=${userId}, reaction=${reaction}`);
        const reactionDoc = new MessageReaction({
          tenantId: req.tenantId!,
          messageId: messageId,
          userId: userId,
          reaction: reaction
        });
        await reactionDoc.save();
        log(`Реакция создана: reactionId=${reactionDoc._id}`);

        // Получаем диалог и его метаданные для события
        const dialog = await Dialog.findOne({
          dialogId: message.dialogId,
          tenantId: req.tenantId!
        }).lean();

        if (!dialog) {
          res.status(404).json({
            error: 'Not Found',
            message: 'Dialog not found'
          });
          return;
        }

        const dialogMeta = await metaUtils.getEntityMeta(req.tenantId!, 'dialog', dialog.dialogId);
        const dialogSection = eventUtils.buildDialogSection({
          dialogId: dialog.dialogId,
          tenantId: dialog.tenantId,
          createdAt: dialog.createdAt,
          meta: dialogMeta || {}
        });

        // Формируем reactionSet для события
        const reactionSet = await buildReactionSet(req.tenantId!, messageId, userId);

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

        log(`Создание события message.reaction.update: messageId=${messageId}, userId=${userId}, reaction=${reaction}`);
        await eventUtils.createEvent({
          tenantId: req.tenantId!,
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

        log(`Отправка успешного ответа: messageId=${messageId}, userId=${userId}, reaction=${reaction}`);
        res.status(201).json({
          data: sanitizeResponse({
            reaction: reactionDoc
          }),
          message: 'Reaction set successfully'
        });
      } else if (action === 'unset') {
        log(`Снятие реакции: messageId=${messageId}, userId=${userId}, reaction=${reaction}`);
        // Снимаем реакцию
        const reactionToDelete = await MessageReaction.findOne({
          tenantId: req.tenantId!,
          messageId: messageId,
          userId: userId,
          reaction: reaction
        });

        if (!reactionToDelete) {
          log(`Реакция не найдена: messageId=${messageId}, userId=${userId}, reaction=${reaction}`);
          res.status(404).json({
            error: 'Not Found',
            message: 'Reaction not found'
          });
          return;
        }

        // Удаляем реакцию
        // ВАЖНО: Используем метод на документе, чтобы сработал middleware post('remove')
        log(`Удаление реакции: reactionId=${reactionToDelete._id}`);
        await reactionToDelete.deleteOne();
        log(`Реакция удалена: reactionId=${reactionToDelete._id}`);

        // Получаем диалог и его метаданные для события
        const dialog = await Dialog.findOne({
          dialogId: message.dialogId,
          tenantId: req.tenantId!
        }).lean();

        if (!dialog) {
          res.status(404).json({
            error: 'Not Found',
            message: 'Dialog not found'
          });
          return;
        }

        const dialogMeta = await metaUtils.getEntityMeta(req.tenantId!, 'dialog', dialog.dialogId);
        const dialogSection = eventUtils.buildDialogSection({
          dialogId: dialog.dialogId,
          tenantId: dialog.tenantId,
          createdAt: dialog.createdAt,
          meta: dialogMeta || {}
        });

        // Формируем reactionSet для события
        const reactionSet = await buildReactionSet(req.tenantId!, messageId, userId);

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

        log(`Создание события message.reaction.update (unset): messageId=${messageId}, userId=${userId}, reaction=${reaction}`);
        await eventUtils.createEvent({
          tenantId: req.tenantId!,
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

        log(`Отправка успешного ответа: messageId=${messageId}, userId=${userId}, reaction=${reaction}`);
        res.json({
          data: sanitizeResponse({}),
          message: 'Reaction unset successfully'
        });
      }
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      if (error.name === 'CastError') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid message ID'
        });
        return;
      }
      if (error.code === 11000) {
        res.status(409).json({
          error: 'Conflict',
          message: 'Reaction already exists for this user and message'
        });
        return;
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  }
};

export default messageReactionController;
