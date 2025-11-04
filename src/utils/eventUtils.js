import { Event } from '../models/index.js';
import * as rabbitmqUtils from './rabbitmqUtils.js';

/**
 * Создает событие в системе
 * @param {Object} params - Параметры события
 * @param {ObjectId} params.tenantId - ID тенанта
 * @param {string} params.eventType - Тип события (dialog.create, message.add и т.д.)
 * @param {string} params.entityType - Тип сущности (dialog, message, dialogMember, messageStatus)
 * @param {ObjectId} params.entityId - ID сущности
 * @param {string} params.actorId - ID пользователя, который инициировал событие
 * @param {string} params.actorType - Тип актора (user, system, bot, api)
 * @param {Object} params.data - Дополнительные данные события
 * @param {Object} params.metadata - Метаданные (IP, User-Agent и т.д.)
 * @returns {Promise<Event>} Созданное событие
 */
export async function createEvent({
  tenantId,
  eventType,
  entityType,
  entityId,
  actorId,
  actorType = 'user',
  data = {},
  metadata = {}
}) {
  try {
    const event = await Event.create({
      tenantId,
      eventType,
      entityType,
      entityId,
      actorId,
      actorType,
      data,
      metadata
    });

    // Отправляем событие в RabbitMQ (асинхронно, не ждем результата)
    // Если RabbitMQ недоступен, событие все равно сохранится в MongoDB
    // Update Worker подпишется на события и создаст updates
    rabbitmqUtils.publishEvent(event.toObject()).catch(err => {
      console.error('Failed to publish event to RabbitMQ:', err.message);
    });

    return event;
  } catch (error) {
    console.error('Error creating event:', error);
    // Не бросаем ошибку, чтобы не ломать основной функционал
    return null;
  }
}

/**
 * Получает события для конкретной сущности
 * @param {ObjectId} tenantId - ID тенанта
 * @param {string} entityType - Тип сущности
 * @param {ObjectId} entityId - ID сущности
 * @param {Object} options - Дополнительные параметры (limit, sort)
 * @returns {Promise<Array>} Массив событий
 */
export async function getEntityEvents(tenantId, entityType, entityId, options = {}) {
  const {
    limit = 50,
    sort = { createdAt: -1 },
    eventType = null
  } = options;

  const query = {
    tenantId,
    entityType,
    entityId
  };

  if (eventType) {
    query.eventType = eventType;
  }

  return await Event.find(query)
    .sort(sort)
    .limit(limit)
    .lean();
}

/**
 * Получает события определенного типа
 * @param {ObjectId} tenantId - ID тенанта
 * @param {string} eventType - Тип события
 * @param {Object} options - Дополнительные параметры (limit, skip, sort)
 * @returns {Promise<Array>} Массив событий
 */
export async function getEventsByType(tenantId, eventType, options = {}) {
  const {
    limit = 50,
    skip = 0,
    sort = { createdAt: -1 }
  } = options;

  return await Event.find({
    tenantId,
    eventType
  })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
}

/**
 * Получает события пользователя
 * @param {ObjectId} tenantId - ID тенанта
 * @param {string} actorId - ID пользователя
 * @param {Object} options - Дополнительные параметры
 * @returns {Promise<Array>} Массив событий
 */
export async function getUserEvents(tenantId, actorId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    sort = { createdAt: -1 },
    eventType = null
  } = options;

  const query = {
    tenantId,
    actorId
  };

  if (eventType) {
    query.eventType = eventType;
  }

  return await Event.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
}

/**
 * Получает все события с фильтрацией и пагинацией
 * @param {ObjectId} tenantId - ID тенанта
 * @param {Object} filters - Фильтры
 * @param {Object} options - Параметры пагинации и сортировки
 * @returns {Promise<Object>} Объект с событиями и пагинацией
 */
export async function getAllEvents(tenantId, filters = {}, options = {}) {
  const {
    page = 1,
    limit = 50,
    sort = { createdAt: -1 }
  } = options;

  const skip = (page - 1) * limit;

  const query = {
    tenantId,
    ...filters
  };

  const [events, total] = await Promise.all([
    Event.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Event.countDocuments(query)
  ]);

  return {
    events,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Удаляет старые события (для очистки истории)
 * @param {ObjectId} tenantId - ID тенанта
 * @param {Date} beforeDate - Удалить события до этой даты
 * @returns {Promise<number>} Количество удаленных событий
 */
export async function deleteOldEvents(tenantId, beforeDate) {
  const result = await Event.deleteMany({
    tenantId,
    createdAt: { $lt: beforeDate }
  });

  return result.deletedCount;
}

/**
 * Получает статистику по событиям
 * @param {ObjectId} tenantId - ID тенанта
 * @param {Object} options - Дополнительные параметры
 * @returns {Promise<Array>} Статистика по типам событий
 */
export async function getEventStats(tenantId, options = {}) {
  const {
    startDate = null,
    endDate = null
  } = options;

  const matchStage = { tenantId };

  if (startDate) {
    matchStage.createdAt = { $gte: startDate };
  }

  if (endDate) {
    if (!matchStage.createdAt) {
      matchStage.createdAt = {};
    }
    matchStage.createdAt.$lte = endDate;
  }

  return await Event.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 },
        lastEvent: { $max: '$createdAt' }
      }
    },
    {
      $project: {
        eventType: '$_id',
        count: 1,
        lastEvent: 1,
        _id: 0
      }
    },
    { $sort: { count: -1 } }
  ]);
}

/**
 * Извлекает метаданные из request для события
 * @param {Object} req - Express request объект
 * @returns {Object} Метаданные
 */
export function extractMetadataFromRequest(req) {
  return {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    apiKeyId: req.apiKey?._id,
    source: 'api'
  };
}

export default {
  createEvent,
  getEntityEvents,
  getEventsByType,
  getUserEvents,
  getAllEvents,
  deleteOldEvents,
  getEventStats,
  extractMetadataFromRequest
};

