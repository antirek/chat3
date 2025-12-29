import { Topic, Dialog, DialogMember, Event } from '../../../models/index.js';
import * as topicUtils from '../../../utils/topicUtils.js';
import * as metaUtils from '../utils/metaUtils.js';
import * as eventUtils from '../utils/eventUtils.js';
import { sanitizeResponse } from '../utils/responseUtils.js';
import { updateDialogTopicCount } from '../../../utils/counterUtils.js';

export const topicController = {
  /**
   * Получение списка топиков диалога
   */
  async getDialogTopics(req, res) {
    try {
      const { dialogId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      // Проверка существования диалога
      const dialog = await Dialog.findOne({
        dialogId,
        tenantId: req.tenantId
      });

      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      // Проверка прав доступа - пользователь должен быть участником диалога
      // Для API ключей проверка не требуется (они имеют доступ ко всем диалогам)
      // Но можно добавить проверку через req.apiKey если нужно

      // Получаем список топиков
      const topics = await topicUtils.getDialogTopics(req.tenantId, dialogId, {
        page,
        limit,
        sort: { createdAt: 1 }
      });

      // Обогащаем топики мета-тегами
      const topicsWithMeta = await Promise.all(
        topics.map(async (topic) => {
          const meta = await metaUtils.getEntityMeta(req.tenantId, 'topic', topic.topicId);
          return {
            ...topic,
            meta: meta || {}
          };
        })
      );

      const total = await Topic.countDocuments({
        tenantId: req.tenantId,
        dialogId
      });

      res.json({
        data: sanitizeResponse(topicsWithMeta),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  /**
   * Создание нового топика
   */
  async createTopic(req, res) {
    try {
      const { dialogId } = req.params;
      const { meta: metaPayload } = req.body;

      // Проверка существования диалога
      const dialog = await Dialog.findOne({
        dialogId,
        tenantId: req.tenantId
      });

      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      // Определяем actorId для событий
      const actorId = req.apiKey?.name || 'system';

      // Создаем топик
      const topic = await topicUtils.createTopic(req.tenantId, dialogId, {
        meta: metaPayload,
        createdBy: actorId
      });

      // Обновляем DialogStats.topicCount
      await updateDialogTopicCount(req.tenantId, dialogId, 1);

      // Получаем метаданные диалога для события
      const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialogId);
      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });

      // Получаем метаданные топика
      const topicMeta = await metaUtils.getEntityMeta(req.tenantId, 'topic', topic.topicId);
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

      await eventUtils.createEvent({
        tenantId: req.tenantId,
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

      res.status(201).json({
        data: sanitizeResponse({
          ...topic.toObject(),
          meta
        }),
        message: 'Topic created successfully'
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          details: error.errors
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  /**
   * Получение топика по ID
   */
  async getTopic(req, res) {
    try {
      const { dialogId, topicId } = req.params;

      const topic = await topicUtils.getTopicById(req.tenantId, dialogId, topicId);

      if (!topic) {
        return res.status(404).json({
          error: 'ERROR_NO_TOPIC',
          message: 'Topic not found'
        });
      }

      // Получаем метаданные топика
      const meta = await metaUtils.getEntityMeta(req.tenantId, 'topic', topicId);

      res.json({
        data: sanitizeResponse({
          ...topic,
          meta: meta || {}
        })
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  /**
   * Обновление топика (мета-теги)
   */
  async updateTopic(req, res) {
    try {
      const { dialogId, topicId } = req.params;
      const { meta: metaPayload } = req.body;

      // Определяем actorId для событий
      const actorId = req.apiKey?.name || 'system';

      // Обновляем топик
      const topic = await topicUtils.updateTopic(req.tenantId, dialogId, topicId, {
        meta: metaPayload,
        createdBy: actorId
      });

      if (!topic) {
        return res.status(404).json({
          error: 'ERROR_NO_TOPIC',
          message: 'Topic not found'
        });
      }

      // Получаем метаданные диалога для события
      const dialog = await Dialog.findOne({
        dialogId,
        tenantId: req.tenantId
      });

      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialogId);
      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });

      // Получаем обновленные метаданные топика
      const topicMeta = await metaUtils.getEntityMeta(req.tenantId, 'topic', topicId);
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

      await eventUtils.createEvent({
        tenantId: req.tenantId,
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
      res.json({
        data: sanitizeResponse({
          ...topic,
          meta: topicMeta || {}
        }),
        message: 'Topic updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};
