import { 
  DialogMember, Dialog, Message,
  MessageStatus, 
  Topic,
  UserTopicStats
} from '@chat3/models';
import * as topicUtils from '@chat3/utils/topicUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { validateGetUserDialogMessagesResponse, validateGetUserDialogMessageResponse } from '../validators/schemas/responseSchemas.js';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import {
  getSenderInfo,
  buildStatusMessageMatrix,
  buildReactionSet,
  getContextUserInfo
} from '@chat3/utils/userDialogUtils.js';
import { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/apiAuth.js';
import {
  setMessageStatus,
  listUserDialogs,
  listUserDialogMessages,
  markDialogAllRead,
  isAppServiceError,
  appServiceErrorToHttpStatus,
  appServiceErrorToHttpBody
} from '@chat3/app-services';

const userDialogController = {
  // Get user's dialogs with optional last message
  async getUserDialogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /users/:userId/dialogs';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { userId } = req.params;
      const page = parseInt(String(req.query.page || '1')) || 1;
      const limit = parseInt(String(req.query.limit || '10')) || 10;
      log(`Получены параметры: userId=${userId}, page=${page}, limit=${limit}, filter=${req.query.filter || 'нет'}`);

      const result = await listUserDialogs({
        tenantId: req.tenantId!,
        userId,
        page,
        limit,
        filter: req.query.filter != null ? String(req.query.filter) : null,
        sort: req.query.sort != null ? String(req.query.sort) : null,
        unreadCount: req.query.unreadCount,
        lastSeenAt: req.query.lastSeenAt,
        lastMessageAt: req.query.lastMessageAt,
        includeLastMessage: true
      });

      log(`Всего диалогов: ${result.pagination.total}, найдено: ${result.data.length}, страница: ${page}, лимит: ${limit}`);
      log(`Отправка ответа: ${result.data.length} диалогов`);
      res.json(result);
    } catch (error: any) {
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
  },


  // Get messages from a dialog in context of specific user
  async getUserDialogMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /users/:userId/dialogs/:dialogId/messages';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { userId, dialogId } = req.params;
      const page = parseInt(String(req.query.page || '1')) || 1;
      const limit = parseInt(String(req.query.limit || '50')) || 50;
      log(`Получены параметры: userId=${userId}, dialogId=${dialogId}, page=${page}, limit=${limit}`);

      const result = await listUserDialogMessages({
        tenantId: req.tenantId!,
        userId,
        dialogId,
        page,
        limit,
        filter: req.query.filter != null ? String(req.query.filter) : null,
        sort: req.query.sort != null ? String(req.query.sort) : null
      });

      // Валидация структуры ответа (только в development)
      if (process.env.NODE_ENV !== 'production') {
        const validation = validateGetUserDialogMessagesResponse(result as any);
        if (!validation.valid) {
          console.warn('Response validation warning:', validation.error);
        }
      }

      log(`Отправка ответа: ${result.data.length} сообщений, страница: ${page}, лимит: ${limit}`);
      res.json(result);
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      console.error('Error in getUserDialogMessages:', error);
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
  },


  // Get single message from dialog in context of specific user
  async getUserDialogMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /users/:userId/dialogs/:dialogId/messages/:messageId';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { userId, dialogId, messageId } = req.params;
      log(`Получены параметры: userId=${userId}, dialogId=${dialogId}, messageId=${messageId}`);
      const fetchMeta = (entityType, entityId) => metaUtils.getEntityMeta(
        req.tenantId,
        entityType,
        entityId
      );

      // 1. Проверяем, что пользователь является участником диалога
      log(`Проверка участника: userId=${userId}, dialogId=${dialogId}`);
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId,
        userId: userId
      });

      if (!member) {
        log(`Пользователь не является участником: userId=${userId}, dialogId=${dialogId}`);
        res.status(403).json({
          error: 'Forbidden',
          message: 'User is not a member of this dialog'
        });
        return;
      }
      log(`Участник найден: userId=${userId}`);

      // 2. Получаем сообщение
      log(`Поиск сообщения: messageId=${messageId}, dialogId=${dialogId}`);
      const message = await Message.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId,
        messageId: messageId
      }).lean();

      if (!message) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
        return;
      }

      // 3. Получаем все статусы сообщения (для всех пользователей)
       
      const _allStatuses = await MessageStatus.find({
        tenantId: req.tenantId,
        messageId: messageId
      }).select('messageId userId userType tenantId status createdAt').lean();

      // 4. Фильтруем статусы для текущего пользователя
      // const myStatuses = _allStatuses.filter(s => s.userId === userId);

      // 4.5. Формируем матрицу статусов по userType и status (исключая статусы отправителя сообщения)
      const statusMessageMatrix = await buildStatusMessageMatrix(req.tenantId, messageId, message.senderId);

      // 5. Формируем reactionSet
      const reactionSet = await buildReactionSet(req.tenantId, messageId, userId);

      // 7. Получаем метаданные сообщения
      const messageMeta = await fetchMeta('message', message.messageId);

      // 7.4. Получаем информацию о топике, если topicId указан
      let topic = null;
      const messageTopicId = (message as any).topicId;
      if (messageTopicId) {
        try {
          topic = await topicUtils.getTopicWithMeta(req.tenantId, dialogId, messageTopicId);
        } catch (error) {
          console.error('Error getting topic with meta:', error);
          topic = { topicId: messageTopicId, meta: {} };
        }
      }

      // 7.5. Загружаем информацию о пользователе из контекста
      const contextUserInfo = await getContextUserInfo(req.tenantId, userId, fetchMeta);

      // 8. Формируем ответ с контекстом пользователя
      const contextData: any = {
        userId: userId,
        isMine: message.senderId === userId
        // statuses: null, // Статусы только для данного пользователя
        // statuses: myStatuses, // Закомментировано: всегда возвращаем null
        // myReaction: userReaction // Удалено: используйте reactionSet для получения информации о реакциях
      };

      // Добавляем userInfo если пользователь найден
      if (contextUserInfo) {
        contextData.userInfo = contextUserInfo;
      }

      const senderInfo = await getSenderInfo(req.tenantId, message.senderId, undefined);

      const enrichedMessage = {
        ...message,
        meta: messageMeta,
        topic: topic, // Добавляем topic в ответ
        // Контекстные данные для конкретного пользователя
        context: contextData,
        // Матрица статусов (количество пар userType-status, исключая статусы отправителя)
        statusMessageMatrix: statusMessageMatrix,
        reactionSet: reactionSet,
        senderInfo: senderInfo || null
      };

      const response = {
        data: sanitizeResponse(enrichedMessage)
      };

      // Валидация структуры ответа (только в development)
      if (process.env.NODE_ENV !== 'production') {
        const validation = validateGetUserDialogMessageResponse(response as any);
        if (!validation.valid) {
          console.warn('Response validation warning:', validation.error);
        }
      }

      log(`Отправка ответа: messageId=${messageId}`);
      res.json(response);
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      console.error('Error in getUserDialogMessage:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },


  /**
   * Получение постраничного списка всех статусов сообщения из истории
   * 
   * ВАЖНО: MessageStatus хранит полную историю изменений статусов.
   * Каждое изменение статуса создает новую запись в истории.
   * 
   * Возвращает все записи статусов для сообщения, отсортированные по времени создания
   * (новые первыми). Один пользователь может иметь несколько записей.
   * 
   * @param {Object} req - Express request object
   * @param {Object} req.params - Параметры пути
   * @param {string} req.params.userId - ID пользователя
   * @param {string} req.params.dialogId - ID диалога
   * @param {string} req.params.messageId - ID сообщения
   * @param {Object} req.query - Query параметры
   * @param {number} req.query.page - Номер страницы (по умолчанию 1)
   * @param {number} req.query.limit - Количество записей на странице (по умолчанию 50)
   * @param {Object} res - Express response object
   */
  async getMessageStatuses(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /users/:userId/dialogs/:dialogId/messages/:messageId/statuses';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { userId, dialogId, messageId } = req.params;
      const page = parseInt(String(req.query.page || '1'), 10) || 1;
      const limit = parseInt(String(req.query.limit || '50'), 10) || 50;
      const skip = (page - 1) * limit;
      log(`Получены параметры: userId=${userId}, dialogId=${dialogId}, messageId=${messageId}, page=${page}, limit=${limit}`);

      // Нормализуем dialogId (в нижний регистр, как в модели)
      const normalizedDialogId = dialogId.toLowerCase().trim();

      // 1. Проверяем, что пользователь является участником диалога
      log(`Проверка участника: userId=${userId}, dialogId=${normalizedDialogId}`);
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: normalizedDialogId,
        userId: userId
      });

      if (!member) {
        log(`Пользователь не является участником: userId=${userId}, dialogId=${normalizedDialogId}`);
        res.status(403).json({
          error: 'Forbidden',
          message: 'User is not a member of this dialog'
        });
        return;
      }
      log(`Участник найден: userId=${userId}`);

      // 2. Проверяем, что сообщение существует
      log(`Поиск сообщения: messageId=${messageId}, dialogId=${normalizedDialogId}`);
      const message = await Message.findOne({
        tenantId: req.tenantId,
        dialogId: normalizedDialogId,
        messageId: messageId
      }).lean();

      if (!message) {
        log(`Сообщение не найдено: messageId=${messageId}`);
        res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
        return;
      }
      log(`Сообщение найдено: messageId=${message.messageId}`);

      // 3. Получаем общее количество записей в истории статусов
      log(`Подсчет общего количества статусов: messageId=${messageId}`);
      const total = await MessageStatus.countDocuments({
        tenantId: req.tenantId,
        messageId: messageId
      });
      log(`Всего статусов: ${total}`);

      // 4. Получаем записи истории статусов с пагинацией
      // Сортируем по времени создания в порядке убывания (новые первыми)
      log(`Получение статусов: skip=${skip}, limit=${limit}`);
      const statuses = await MessageStatus.find({
        tenantId: req.tenantId,
        messageId: messageId
      })
        .select('messageId userId userType tenantId status createdAt')
        .sort({ createdAt: -1 }) // Новые записи первыми
        .skip(skip)
        .limit(limit)
        .lean();
      log(`Найдено статусов: ${statuses.length}`);

      const pages = Math.ceil(total / limit);

      log(`Отправка ответа: ${statuses.length} статусов, страница: ${page}, лимит: ${limit}`);
      res.json({
        data: statuses,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      console.error('Error in getMessageStatuses:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Middleware для проверки членства пользователя в диалоге
  async checkDialogMembership(req: AuthenticatedRequest, res: Response, next: any): Promise<void> {
    const routePath = 'middleware checkDialogMembership';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    };
    log('>>>>> start');
    try {
      const { userId, dialogId } = req.params;

      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId,
        userId: userId
      });

      if (!member) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'User is not a member of this dialog'
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  /**
   * Создание новой записи в истории статусов сообщения
   * 
   * ВАЖНО: Каждое изменение статуса создает новую запись в истории (не обновляет существующую).
   * MessageStatus хранит полную историю всех изменений статусов для каждого пользователя.
   * 
   * При создании записи:
   * 1. Автоматически заполняется поле userType на основе типа пользователя
   * 2. Получается последний статус пользователя для определения oldStatus
   * 3. Автоматически обновляются счетчики непрочитанных сообщений (через pre-save hook)
   * 4. Генерируется событие изменения статуса для других участников диалога
   * 
   * @param {Object} req - Express request object
   * @param {Object} req.params - Параметры пути
   * @param {string} req.params.userId - ID пользователя
   * @param {string} req.params.dialogId - ID диалога
   * @param {string} req.params.messageId - ID сообщения
   * @param {string} req.params.status - Новый статус: произвольная строка [a-zA-Z0-9_-], 1–64 символа (например unread, delivered, read, error2)
   * @param {Object} res - Express response object
   */
  async updateMessageStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'post /users/:userId/dialogs/:dialogId/messages/:messageId/status/:status';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { userId, dialogId, messageId, status } = req.params;
      log(`Получены параметры: userId=${userId}, dialogId=${dialogId}, messageId=${messageId}, status=${status}`);

      const result = await setMessageStatus({
        tenantId: req.tenantId!,
        userId,
        dialogId,
        messageId,
        status
      });

      log(`Отправка успешного ответа: messageId=${messageId}, userId=${userId}, status=${status}`);
      res.json({
        data: result.status,
        message: 'Message status updated successfully'
      });
    } catch (error: any) {
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
  },

  /**
   * Отметить все сообщения диалога прочитанными для пользователя (markAllRead).
   * POST /api/users/:userId/dialogs/:dialogId/markAllRead
   */
  async markAllRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'post /users/:userId/dialogs/:dialogId/markAllRead';
    const log = (...args: any[]) => console.log(`[${routePath}]`, ...args);
    log('>>>>> start');

    try {
      const { userId, dialogId } = req.params;
      const result = await markDialogAllRead({
        tenantId: req.tenantId!,
        userId,
        dialogId,
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api'
      });

      if (result.timedOut) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'Mark all read timed out (2 minutes). Counters were updated; some message statuses may still be processing.'
        });
        return;
      }

      res.json({
        data: result.data,
        message: 'All messages marked as read'
      });
    } catch (error: any) {
      log('Error:', error?.message);
      if (isAppServiceError(error)) {
        res.status(appServiceErrorToHttpStatus(error)).json(appServiceErrorToHttpBody(error));
        return;
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error?.message ?? 'Unknown error'
      });
    } finally {
      log('>>>>> end');
    }
  },

  /**
   * Получение топиков диалога в контексте пользователя
   * Возвращает топики с мета-тегами и количеством непрочитанных сообщений для пользователя
   */
  async getUserDialogTopics(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /users/:userId/dialogs/:dialogId/topics';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { userId, dialogId } = req.params;
      const page = parseInt(String(req.query.page || '1')) || 1;
      const limit = parseInt(String(req.query.limit || '20')) || 20;
      const skip = (page - 1) * limit;
      log(`Получены параметры: userId=${userId}, dialogId=${dialogId}, page=${page}, limit=${limit}`);

      // Проверка существования диалога
      log(`Поиск диалога: dialogId=${dialogId}, tenantId=${req.tenantId}`);
      const dialog = await Dialog.findOne({
        dialogId,
        tenantId: req.tenantId
      });

      if (!dialog) {
        log(`Диалог не найден: dialogId=${dialogId}`);
        res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
        return;
      }
      log(`Диалог найден: dialogId=${dialog.dialogId}`);

      // Проверка, что пользователь является участником диалога
      log(`Проверка участника: userId=${userId}, dialogId=${dialogId}`);
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId,
        userId
      });

      if (!member) {
        log(`Пользователь не является участником: userId=${userId}, dialogId=${dialogId}`);
        res.status(403).json({
          error: 'Forbidden',
          message: 'User is not a member of this dialog'
        });
        return;
      }
      log(`Участник найден: userId=${userId}`);

      // Получаем список топиков с пагинацией
      log(`Получение списка топиков: dialogId=${dialogId}, skip=${skip}, limit=${limit}`);
      const topics = await Topic.find({
        tenantId: req.tenantId,
        dialogId
      })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean();
      log(`Найдено топиков: ${topics.length}`);

      // Получаем общее количество топиков для пагинации
      const total = await Topic.countDocuments({
        tenantId: req.tenantId,
        dialogId
      });
      log(`Всего топиков: ${total}`);

      // Получаем unreadCount для каждого топика из UserTopicStats
      const topicIds = topics.map(t => t.topicId);
      log(`Получение статистики для ${topicIds.length} топиков: userId=${userId}`);
      const topicStats = await UserTopicStats.find({
        tenantId: req.tenantId,
        userId,
        dialogId,
        topicId: { $in: topicIds }
      }).lean();

      // Создаем Map для быстрого доступа к unreadCount
      const unreadCountMap = new Map<string, number>();
      topicStats.forEach(stat => {
        unreadCountMap.set(stat.topicId, stat.unreadCount || 0);
      });

      // Обогащаем топики мета-тегами и unreadCount
      log(`Обогащение топиков мета-тегами: ${topics.length} топиков`);
      const topicsWithContext = await Promise.all(
        topics.map(async (topic) => {
          const meta = await metaUtils.getEntityMeta(req.tenantId, 'topic', topic.topicId);
          const unreadCount = unreadCountMap.get(topic.topicId) || 0;

          return {
            ...topic,
            meta: meta || {},
            unreadCount
          };
        })
      );
      log(`Мета-теги получены для всех топиков`);

      log(`Отправка ответа: ${topicsWithContext.length} топиков, страница: ${page}, лимит: ${limit}`);
      res.json({
        data: sanitizeResponse(topicsWithContext),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  }
};

export default userDialogController;
