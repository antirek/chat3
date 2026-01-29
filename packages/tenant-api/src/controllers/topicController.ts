import { Topic, Dialog } from '@chat3/models';
import * as topicUtils from '@chat3/utils/topicUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/apiAuth.js';

export const topicController = {
  /**
   * Получение списка топиков диалога
   */
  async getDialogTopics(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /dialogs/:dialogId/topics';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { dialogId } = req.params;
      const page = parseInt(String(req.query.page)) || 1;
      const limit = parseInt(String(req.query.limit)) || 10;
      log(`Получены параметры: dialogId=${dialogId}, page=${page}, limit=${limit}`);

      // Проверка существования диалога
      log(`Поиск диалога: dialogId=${dialogId}, tenantId=${req.tenantId}`);
      const dialog = await Dialog.findOne({
        dialogId,
        tenantId: req.tenantId!
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

      // Проверка прав доступа - пользователь должен быть участником диалога
      // Для API ключей проверка не требуется (они имеют доступ ко всем диалогам)
      // Но можно добавить проверку через req.apiKey если нужно

      // Получаем список топиков
      log(`Получение списка топиков: dialogId=${dialogId}, page=${page}, limit=${limit}`);
      const topics = await topicUtils.getDialogTopics(req.tenantId!, dialogId, {
        page,
        limit,
        sort: { createdAt: 1 }
      });
      log(`Найдено топиков: ${topics.length}`);

      // Обогащаем топики мета-тегами
      log(`Обогащение топиков мета-тегами: ${topics.length} топиков`);
      const topicsWithMeta = await Promise.all(
        topics.map(async (topic: any) => {
          const meta = await metaUtils.getEntityMeta(req.tenantId!, 'topic', topic.topicId);
          return {
            ...topic,
            meta: meta || {}
          };
        })
      );
      log(`Мета-теги получены для всех топиков`);

      const total = await Topic.countDocuments({
        tenantId: req.tenantId!,
        dialogId
      });
      log(`Всего топиков: ${total}, страница: ${page}, лимит: ${limit}`);

      log(`Отправка ответа: ${topicsWithMeta.length} топиков`);
      res.json({
        data: sanitizeResponse(topicsWithMeta),
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
  },

  /**
   * Создание нового топика
   */
  async createTopic(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'post /dialogs/:dialogId/topics';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { dialogId } = req.params;
      const { meta: metaPayload } = req.body as { meta?: any };
      log(`Получены параметры: dialogId=${dialogId}, meta=${metaPayload ? 'есть' : 'нет'}`);

      // Проверка существования диалога
      log(`Поиск диалога: dialogId=${dialogId}, tenantId=${req.tenantId}`);
      const dialog = await Dialog.findOne({
        dialogId,
        tenantId: req.tenantId!
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

      // Определяем actorId для событий
      const actorId = req.apiKey?.name || 'system';
      log(`ActorId для событий: ${actorId}`);

      // Создаем топик
      log(`Создание топика: dialogId=${dialogId}`);
      const topic = await topicUtils.createTopic(req.tenantId!, dialogId, {
        meta: metaPayload,
        createdBy: actorId
      }) as any;
      log(`Топик создан: topicId=${topic.topicId}`);

      // DialogStats.topicCount обновляется в update-worker при обработке события dialog.topic.create
      // (не инкрементируем здесь, иначе будет двойной +1)

      // Получаем метаданные диалога для события
      const dialogMeta = await metaUtils.getEntityMeta(req.tenantId!, 'dialog', dialogId);
      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });

      // Получаем метаданные топика
      const topicMeta = await metaUtils.getEntityMeta(req.tenantId!, 'topic', topic.topicId);
      const topicSection = eventUtils.buildTopicSection({
        topicId: topic.topicId,
        dialogId: topic.dialogId,
        createdAt: topic.createdAt,
        meta: topicMeta || {}
      });

      // Создаем событие dialog.topic.create
      const eventContext = eventUtils.buildEventContext({
        eventType: 'dialog.topic.create',
        dialogId: dialogId,
        entityId: topic.topicId,
        includedSections: ['dialog', 'topic'],
        updatedFields: ['topic']
      });

      log(`Создание события dialog.topic.create: topicId=${topic.topicId}`);
      await eventUtils.createEvent({
        tenantId: req.tenantId!,
        eventType: 'dialog.topic.create',
        entityType: 'topic',
        entityId: topic.topicId,
        actorId: actorId,
        actorType: 'user',
        data: eventUtils.composeEventData({
          context: eventContext,
          dialog: dialogSection,
          topic: topicSection
        })
      });

      // Возвращаем созданный топик с мета-тегами
      const meta = topicMeta || {};

      log(`Отправка успешного ответа: topicId=${topic.topicId}, dialogId=${dialogId}`);
      res.status(201).json({
        data: sanitizeResponse({
          ...(topic as any).toObject(),
          meta
        }),
        message: 'Topic created successfully'
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      if (error.name === 'ValidationError') {
        res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          details: error.errors
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

  /**
   * Получение топика по ID
   */
  async getTopic(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /dialogs/:dialogId/topics/:topicId';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { dialogId, topicId } = req.params;
      log(`Получены параметры: dialogId=${dialogId}, topicId=${topicId}`);

      log(`Поиск топика: dialogId=${dialogId}, topicId=${topicId}`);
      const topic = await topicUtils.getTopicById(req.tenantId!, dialogId, topicId) as any;

      if (!topic) {
        log(`Топик не найден: topicId=${topicId}, dialogId=${dialogId}`);
        res.status(404).json({
          error: 'ERROR_NO_TOPIC',
          message: 'Topic not found'
        });
        return;
      }
      log(`Топик найден: topicId=${topic.topicId}`);

      // Получаем метаданные топика
      log(`Получение метаданных топика: topicId=${topicId}`);
      const meta = await metaUtils.getEntityMeta(req.tenantId!, 'topic', topicId);
      log(`Метаданные получены: keys=${Object.keys(meta).length}`);

      log(`Отправка ответа: topicId=${topicId}`);
      res.json({
        data: sanitizeResponse({
          ...topic,
          meta: meta || {}
        })
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
  },

  /**
   * Обновление топика (мета-теги)
   */
  async updateTopic(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'patch /dialogs/:dialogId/topics/:topicId';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { dialogId, topicId } = req.params;
      const { meta: metaPayload } = req.body as { meta?: any };
      log(`Получены параметры: dialogId=${dialogId}, topicId=${topicId}, meta=${metaPayload ? 'есть' : 'нет'}`);

      // Определяем actorId для событий
      const actorId = req.apiKey?.name || 'system';
      log(`ActorId для событий: ${actorId}`);

      // Обновляем топик
      log(`Обновление топика: dialogId=${dialogId}, topicId=${topicId}`);
      const topic = await topicUtils.updateTopic(req.tenantId!, dialogId, topicId, {
        meta: metaPayload,
        createdBy: actorId
      }) as any;

      if (!topic) {
        log(`Топик не найден: topicId=${topicId}, dialogId=${dialogId}`);
        res.status(404).json({
          error: 'ERROR_NO_TOPIC',
          message: 'Topic not found'
        });
        return;
      }
      log(`Топик найден и обновлен: topicId=${topic.topicId}`);

      // Получаем метаданные диалога для события
      log(`Получение диалога для события: dialogId=${dialogId}`);
      const dialog = await Dialog.findOne({
        dialogId,
        tenantId: req.tenantId!
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

      const dialogMeta = await metaUtils.getEntityMeta(req.tenantId!, 'dialog', dialogId);
      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });

      // Получаем обновленные метаданные топика
      const topicMeta = await metaUtils.getEntityMeta(req.tenantId!, 'topic', topicId);
      const topicSection = eventUtils.buildTopicSection({
        topicId: topic.topicId,
        dialogId: topic.dialogId,
        createdAt: topic.createdAt,
        meta: topicMeta || {}
      });

      // Создаем событие dialog.topic.update
      const eventContext = eventUtils.buildEventContext({
        eventType: 'dialog.topic.update',
        dialogId: dialogId,
        entityId: topicId,
        includedSections: ['dialog', 'topic'],
        updatedFields: ['topic']
      });

      log(`Создание события dialog.topic.update: topicId=${topicId}`);
      await eventUtils.createEvent({
        tenantId: req.tenantId!,
        eventType: 'dialog.topic.update',
        entityType: 'topic',
        entityId: topicId,
        actorId: actorId,
        actorType: 'user',
        data: eventUtils.composeEventData({
          context: eventContext,
          dialog: dialogSection,
          topic: topicSection
        })
      });

      // Возвращаем обновленный топик с мета-тегами
      log(`Отправка успешного ответа: topicId=${topicId}, dialogId=${dialogId}`);
      res.json({
        data: sanitizeResponse({
          ...topic,
          meta: topicMeta || {}
        }),
        message: 'Topic updated successfully'
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
