export function buildEventContext({ eventType, dialogId, entityId, messageId, includedSections, updatedFields }: {
    eventType: any;
    dialogId?: any;
    entityId?: any;
    messageId?: any;
    includedSections?: any[];
    updatedFields?: any[];
}): {
    version: number;
    eventType: any;
    dialogId: any;
    entityId: any;
    messageId: any;
    includedSections: any[];
    updatedFields: any[];
};
export function buildDialogSection({ dialogId, tenantId, createdBy, createdAt, meta }?: {
    tenantId?: any;
    createdBy?: any;
    createdAt?: any;
    meta?: {};
}): {
    dialogId: any;
    tenantId: any;
    createdBy: any;
    createdAt: any;
    meta: object;
};
export function buildMemberSection({ userId, meta, state }?: {
    meta?: {};
    state?: {};
}): {
    userId: any;
    meta: {};
    state: {
        unreadCount: any;
        lastSeenAt: any;
        lastMessageAt: any;
    };
};
export function buildTopicSection({ topicId, dialogId, createdAt, meta }?: {
    dialogId?: any;
    createdAt?: any;
    meta?: {};
}): {
    topicId: any;
    dialogId: any;
    createdAt: any;
    meta: object;
};
export function buildMessageSection({ messageId, dialogId, senderId, type, content, meta, quotedMessage, statusUpdate, reactionUpdate, statusMessageMatrix, topicId, topic }?: {
    dialogId?: any;
    senderId?: any;
    type?: any;
    content?: any;
    meta?: {};
    quotedMessage?: any;
    statusUpdate?: any;
    reactionUpdate?: any;
    statusMessageMatrix?: any;
    topicId?: any;
    topic?: any;
}): {
    messageId: any;
    dialogId: any;
    senderId: any;
    type: any;
    content: any;
    meta: {};
    topicId: any;
    topic: any;
};
export function buildTypingSection({ userId, expiresInMs, timestamp, userInfo }?: {
    expiresInMs?: any;
    timestamp?: any;
    userInfo?: any;
}): {
    userId: any;
    expiresInMs: any;
    timestamp: any;
    userInfo: any;
};
export function buildActorSection({ actorId, actorType, info }?: {
    actorType?: string;
    info?: any;
}): {
    actorId: any;
    actorType: string;
    info: any;
};
export function buildUserSection({ userId, type, meta, stats }?: {
    type?: any;
    meta?: {};
    stats?: {};
}): {
    userId: any;
    type: any;
    meta: object;
};
export function composeEventData({ context, dialog, member, message, user, typing, actor, topic, extra }?: {
    dialog?: any;
    member?: any;
    message?: any;
    user?: any;
    typing?: any;
    actor?: any;
    topic?: any;
    extra?: {};
}): {
    context: any;
};
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
export function createEvent({ tenantId, eventType, entityType, entityId, actorId, actorType, data }: {
    tenantId: ObjectId;
    eventType: string;
    entityType: string;
    entityId: ObjectId;
    actorId: string;
    actorType: string;
    data: any;
}): Promise<Event>;
/**
 * Получает события для конкретной сущности
 * @param {ObjectId} tenantId - ID тенанта
 * @param {string} entityType - Тип сущности
 * @param {ObjectId} entityId - ID сущности
 * @param {Object} options - Дополнительные параметры (limit, sort)
 * @returns {Promise<Array>} Массив событий
 */
export function getEntityEvents(tenantId: ObjectId, entityType: string, entityId: ObjectId, options?: any): Promise<any[]>;
/**
 * Получает события определенного типа
 * @param {ObjectId} tenantId - ID тенанта
 * @param {string} eventType - Тип события
 * @param {Object} options - Дополнительные параметры (limit, skip, sort)
 * @returns {Promise<Array>} Массив событий
 */
export function getEventsByType(tenantId: ObjectId, eventType: string, options?: any): Promise<any[]>;
/**
 * Получает события пользователя
 * @param {ObjectId} tenantId - ID тенанта
 * @param {string} actorId - ID пользователя
 * @param {Object} options - Дополнительные параметры
 * @returns {Promise<Array>} Массив событий
 */
export function getUserEvents(tenantId: ObjectId, actorId: string, options?: any): Promise<any[]>;
/**
 * Получает все события с фильтрацией и пагинацией
 * @param {ObjectId} tenantId - ID тенанта
 * @param {Object} filters - Фильтры
 * @param {Object} options - Параметры пагинации и сортировки
 * @returns {Promise<Object>} Объект с событиями и пагинацией
 */
export function getAllEvents(tenantId: ObjectId, filters?: any, options?: any): Promise<any>;
/**
 * Удаляет старые события (для очистки истории)
 * @param {ObjectId} tenantId - ID тенанта
 * @param {Date} beforeDate - Удалить события до этой даты
 * @returns {Promise<number>} Количество удаленных событий
 */
export function deleteOldEvents(tenantId: ObjectId, beforeDate: Date): Promise<number>;
/**
 * Получает статистику по событиям
 * @param {ObjectId} tenantId - ID тенанта
 * @param {Object} options - Дополнительные параметры
 * @returns {Promise<Array>} Статистика по типам событий
 */
export function getEventStats(tenantId: ObjectId, options?: any): Promise<any[]>;
declare namespace _default {
    export { createEvent };
    export { getEntityEvents };
    export { getEventsByType };
    export { getUserEvents };
    export { getAllEvents };
    export { deleteOldEvents };
    export { getEventStats };
    export { buildEventContext };
    export { buildDialogSection };
    export { buildMemberSection };
    export { buildTopicSection };
    export { buildMessageSection };
    export { buildTypingSection };
    export { buildActorSection };
    export { composeEventData };
}
export default _default;
//# sourceMappingURL=eventUtils.d.ts.map