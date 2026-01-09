import { Event } from '@chat3/models';
import * as rabbitmqUtils from './rabbitmqUtils.js';
const EVENT_PAYLOAD_VERSION = 2;
function uniqueList(values = []) {
    return Array.from(new Set((values || []).filter(Boolean)));
}
export function buildEventContext({ eventType, dialogId = null, entityId = null, messageId = null, includedSections = [], updatedFields = [] }) {
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
export function buildDialogSection({ dialogId, tenantId = null, createdBy = null, createdAt = null, meta = {} }) {
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
export function buildMemberSection({ userId, meta = {}, state = {} }) {
    if (!userId) {
        return null;
    }
    return {
        userId,
        meta: meta || {},
        state: {
            unreadCount: state.unreadCount ?? null,
            lastSeenAt: state.lastSeenAt ?? null,
            lastMessageAt: state.lastMessageAt ?? null
        }
    };
}
export function buildTopicSection({ topicId, dialogId = null, createdAt = null, meta = {} }) {
    if (!topicId) {
        return null;
    }
    // Убеждаемся, что meta всегда является объектом (не null, не undefined)
    const metaObject = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
    return {
        topicId,
        dialogId,
        createdAt,
        meta: metaObject
    };
}
export function buildMessageSection({ messageId, dialogId = null, senderId = null, type = null, content = null, meta = {}, quotedMessage = null, statusUpdate = null, reactionUpdate = null, statusMessageMatrix = null, topicId = null, topic = null }) {
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
        topicId: topicId ?? null,
        topic: topic ?? null
    };
    // Добавляем quotedMessage только если он передан
    if (quotedMessage !== null && quotedMessage !== undefined) {
        result.quotedMessage = quotedMessage;
    }
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
export function buildTypingSection({ userId, expiresInMs = null, timestamp = null, userInfo = null }) {
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
export function buildActorSection({ actorId, actorType = 'user', info = null }) {
    if (!actorId) {
        return null;
    }
    return {
        actorId,
        actorType,
        info: info || null
    };
}
export function buildUserSection({ userId, type = null, meta = {}, stats = {} }) {
    if (!userId) {
        return null;
    }
    // Убеждаемся, что meta всегда является объектом
    const metaObject = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
    const userSection = {
        userId,
        type,
        meta: metaObject
    };
    // Добавляем stats только если они переданы
    if (stats && (stats.dialogCount !== undefined || stats.unreadDialogsCount !== undefined || stats.totalUnreadCount !== undefined || stats.totalMessagesCount !== undefined)) {
        userSection.stats = {
            dialogCount: stats.dialogCount ?? 0,
            unreadDialogsCount: stats.unreadDialogsCount ?? 0,
            totalUnreadCount: stats.totalUnreadCount ?? 0,
            totalMessagesCount: stats.totalMessagesCount ?? 0
        };
    }
    return userSection;
}
export function composeEventData({ context, dialog = null, member = null, message = null, user = null, typing = null, actor = null, topic = null, extra = {} }) {
    if (!context) {
        throw new Error('Event context is required');
    }
    const payload = {
        context
    };
    if (dialog) {
        payload.dialog = dialog;
        // Убеждаемся, что meta всегда присутствует в dialog
        const dialogObj = dialog;
        if (!dialogObj.meta || typeof dialogObj.meta !== 'object' || Array.isArray(dialogObj.meta)) {
            dialogObj.meta = {};
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
    if (user) {
        payload.user = user;
    }
    if (actor) {
        payload.actor = actor;
    }
    if (topic) {
        payload.topic = topic;
    }
    return {
        ...payload,
        ...extra
    };
}
/**
 * Создает событие в системе
 */
export async function createEvent({ tenantId, eventType, entityType, entityId, actorId, actorType = 'user', data = {} }) {
    try {
        // Глубокое копирование данных для гарантии сохранения всех полей
        const dataCopy = JSON.parse(JSON.stringify(data));
        // Убеждаемся, что meta присутствует в dialog секции
        const dialogObj = dataCopy.dialog;
        if (dialogObj && (!dialogObj.meta || typeof dialogObj.meta !== 'object' || Array.isArray(dialogObj.meta))) {
            dialogObj.meta = {};
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
        const eventObject = event.toObject();
        rabbitmqUtils.publishEvent(eventObject).catch(err => {
            console.error(`❌ Failed to publish event ${event.eventType} to RabbitMQ:`, err instanceof Error ? err.message : String(err));
            console.error('Error stack:', err instanceof Error ? err.stack : String(err));
        });
        return event;
    }
    catch (error) {
        console.error('Error creating event:', error);
        // Не бросаем ошибку, чтобы не ломать основной функционал
        return null;
    }
}
/**
 * Получает события для конкретной сущности
 */
export async function getEntityEvents(tenantId, entityType, entityId, options = {}) {
    const { limit = 50, sort = { createdAt: -1 }, eventType = null } = options;
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
 */
export async function getEventsByType(tenantId, eventType, options = {}) {
    const { limit = 50, skip = 0, sort = { createdAt: -1 } } = options;
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
 */
export async function getUserEvents(tenantId, actorId, options = {}) {
    const { limit = 50, skip = 0, sort = { createdAt: -1 }, eventType = null } = options;
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
 */
export async function getAllEvents(tenantId, filters = {}, options = {}) {
    const { page = 1, limit = 50, sort = { createdAt: -1 } } = options;
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
 */
export async function getEventStats(tenantId, options = {}) {
    const { startDate = null, endDate = null } = options;
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
    buildTopicSection,
    buildMessageSection,
    buildTypingSection,
    buildActorSection,
    composeEventData
};
//# sourceMappingURL=eventUtils.js.map