import { MessageReaction, Message } from '@chat3/models';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import {
  setMessageReaction,
  isAppServiceError,
  appServiceErrorToHttpStatus,
  appServiceErrorToHttpBody
} from '@chat3/app-services';
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
      const userId = pathUserId || queryUserId;
      log(`Получены параметры: messageId=${messageId}, userId=${userId || 'нет'}, reaction=${reaction || 'нет'}`);

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

  async setOrUnsetReaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'post /users/:userId/dialogs/:dialogId/messages/:messageId/reactions/:action';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { messageId, action, userId: pathUserId } = req.params;
      const { reaction } = req.body as { reaction?: string };
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

      if (action !== 'set' && action !== 'unset') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'action must be set or unset'
        });
        return;
      }

      const result = await setMessageReaction({
        tenantId: req.tenantId!,
        userId,
        messageId,
        reaction,
        action
      });

      log(`Отправка успешного ответа: messageId=${messageId}, userId=${userId}, reaction=${reaction}`);
      if (result.httpStatus === 200) {
        res.json({
          data: result.data,
          message: result.message
        });
      } else {
        res.status(result.httpStatus).json({
          data: result.data,
          message: result.message
        });
      }    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      if (isAppServiceError(error)) {
        res.status(appServiceErrorToHttpStatus(error)).json(appServiceErrorToHttpBody(error));
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
