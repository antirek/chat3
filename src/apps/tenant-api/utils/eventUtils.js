import { Event } from '../../../models/index.js';
import * as rabbitmqUtils from '../../../utils/rabbitmqUtils.js';

const EVENT_PAYLOAD_VERSION = 2;

function uniqueList(values = []) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

export function buildEventContext({
  eventType,
  dialogId = null,
  entityId = null,
  messageId = null,
  includedSections = [],
  updatedFields = []
}) {
  return {
    version: EVENT_PAYLOAD_VERSION,
    eventType,
    dialogId: dialogId ?? null,
    entityId: entityId ?? null,
    messageId: messageId ?? null,
    includedSections: uniqueList(includedSections),
    updatedFields: uniqueList(updatedFields)
  };
}

export function buildDialogSection({
  dialogId,
  tenantId = null,
  createdBy = null,
  createdAt = null,
  meta = {}
} = {}) {
  if (!dialogId) {
    return null;
  }

  // Убеждаемся, что meta всегда является объектом (не null, не undefined)
  const metaObject = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};

  return {
    dialogId,
    tenantId,
    createdBy,
    createdAt,
    meta: metaObject
  };
}

export function buildMemberSection({
  userId,
  meta = {},
  state = {}
} = {}) {
  if (!userId) {
    return null;
  }

  return {
    userId,
    meta: meta || {},
    state: {
      unreadCount: state.unreadCount ?? null,
      lastSeenAt: state.lastSeenAt ?? null,
      lastMessageAt: state.lastMessageAt ?? null,
      isActive: state.isActive ?? null
    }
  };
}

export function buildMessageSection({
  messageId,
  dialogId = null,
  senderId = null,
  type = null,
  content = null,
  meta = {},
  statuses = [],
  reactionCounts = {},
  quotedMessage = null,
  attachments = null,
  statusUpdate = null,
  reactionUpdate = null,
  statusMessageMatrix = null
} = {}) {
  if (!messageId) {
    return null;
  }

  const result = {
    messageId,
    dialogId,
    senderId,
    type,
    content,
    meta: meta || {},
    statuses: statuses || [],
    reactionCounts: reactionCounts || {},
    quotedMessage: quotedMessage || null,
    attachments: attachments || null
  };

  // Добавляем statusUpdate только если он передан
  if (statusUpdate !== null && statusUpdate !== undefined) {
    result.statusUpdate = statusUpdate;
  }

  // Добавляем reactionUpdate только если он передан (не null и не undefined)
  if (reactionUpdate !== null && reactionUpdate !== undefined) {
    result.reactionUpdate = reactionUpdate;
  }

  // Добавляем statusMessageMatrix только если он передан
  if (statusMessageMatrix !== null && statusMessageMatrix !== undefined) {
    result.statusMessageMatrix = statusMessageMatrix;
  }

  return result;
}

export function buildTypingSection({
  userId,
  expiresInMs = null,
  timestamp = null,
  userInfo = null
} = {}) {
  if (!userId) {
    return null;
  }

  return {
    userId,
    expiresInMs,
    timestamp,
    userInfo: userInfo || null
  };
}

export function buildActorSection({
  actorId,
  actorType = 'user',
  info = null
} = {}) {
  if (!actorId) {
    return null;
  }

  return {
    actorId,
    actorType,
    info: info || null
  };
}

export function composeEventData({
  context,
  dialog = null,
  member = null,
  message = null,
  typing = null,
  actor = null,
  extra = {}
} = {}) {
  if (!context) {
    throw new Error('Event context is required');
  }

  const payload = {
    context
  };

  if (dialog) {
    payload.dialog = dialog;
    // Убеждаемся, что meta всегда присутствует в dialog
    if (!payload.dialog.meta || typeof payload.dialog.meta !== 'object' || Array.isArray(payload.dialog.meta)) {
      payload.dialog.meta = {};
    }
  }

  if (member) {
    payload.member = member;
  }

  if (message) {
    payload.message = message;
  }

  if (typing) {
    payload.typing = typing;
  }

  if (actor) {
    payload.actor = actor;
  }

  return {
    ...payload,
    ...extra
  };
}

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
 * @returns {Promise<Event>} Созданное событие
 */
export async function createEvent({
  tenantId,
  eventType,
  entityType,
  entityId,
  actorId,
  actorType = 'user',
  data = {}
}) {
  try {
    // Глубокое копирование данных для гарантии сохранения всех полей
    const dataCopy = JSON.parse(JSON.stringify(data));
    
    // Убеждаемся, что meta присутствует в dialog секции
    if (dataCopy.dialog && (!dataCopy.dialog.meta || typeof dataCopy.dialog.meta !== 'object' || Array.isArray(dataCopy.dialog.meta))) {
      dataCopy.dialog.meta = {};
    }
    
    const event = await Event.create({
      tenantId,
      eventType,
      entityType,
      entityId,
      actorId,
      actorType,
      data: dataCopy
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

export default {
  createEvent,
  getEntityEvents,
  getEventsByType,
  getUserEvents,
  getAllEvents,
  deleteOldEvents,
  getEventStats,
  buildEventContext,
  buildDialogSection,
  buildMemberSection,
  buildMessageSection,
  buildTypingSection,
  buildActorSection,
  composeEventData
};

