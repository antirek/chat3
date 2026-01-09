import type { EventType, EntityType, ActorType, IEvent } from '@chat3/models';
interface BuildEventContextParams {
    eventType: EventType;
    dialogId?: string | null;
    entityId?: string | null;
    messageId?: string | null;
    includedSections?: string[];
    updatedFields?: string[];
}
export declare function buildEventContext({ eventType, dialogId, entityId, messageId, includedSections, updatedFields }: BuildEventContextParams): {
    version: number;
    eventType: EventType;
    dialogId: string | null;
    entityId: string | null;
    messageId: string | null;
    includedSections: string[];
    updatedFields: string[];
};
interface BuildDialogSectionParams {
    dialogId: string;
    tenantId?: string | null;
    createdBy?: string | null;
    createdAt?: number | null;
    meta?: Record<string, unknown>;
}
export declare function buildDialogSection({ dialogId, tenantId, createdBy, createdAt, meta }: BuildDialogSectionParams): {
    dialogId: string;
    tenantId: string | null;
    createdBy: string | null;
    createdAt: number | null;
    meta: Record<string, unknown>;
} | null;
interface BuildMemberSectionParams {
    userId: string;
    meta?: Record<string, unknown>;
    state?: {
        unreadCount?: number | null;
        lastSeenAt?: number | null;
        lastMessageAt?: number | null;
    };
}
export declare function buildMemberSection({ userId, meta, state }: BuildMemberSectionParams): {
    userId: string;
    meta: Record<string, unknown>;
    state: {
        unreadCount: number | null;
        lastSeenAt: number | null;
        lastMessageAt: number | null;
    };
} | null;
interface BuildTopicSectionParams {
    topicId: string;
    dialogId?: string | null;
    createdAt?: number | null;
    meta?: Record<string, unknown>;
}
export declare function buildTopicSection({ topicId, dialogId, createdAt, meta }: BuildTopicSectionParams): {
    topicId: string;
    dialogId: string | null;
    createdAt: number | null;
    meta: Record<string, unknown>;
} | null;
interface BuildMessageSectionParams {
    messageId: string;
    dialogId?: string | null;
    senderId?: string | null;
    type?: string | null;
    content?: string | null;
    meta?: Record<string, unknown>;
    quotedMessage?: unknown | null;
    statusUpdate?: unknown | null;
    reactionUpdate?: unknown | null;
    statusMessageMatrix?: unknown | null;
    topicId?: string | null;
    topic?: unknown | null;
}
export declare function buildMessageSection({ messageId, dialogId, senderId, type, content, meta, quotedMessage, statusUpdate, reactionUpdate, statusMessageMatrix, topicId, topic }: BuildMessageSectionParams): Record<string, unknown> | null;
interface BuildTypingSectionParams {
    userId: string;
    expiresInMs?: number | null;
    timestamp?: number | null;
    userInfo?: unknown | null;
}
export declare function buildTypingSection({ userId, expiresInMs, timestamp, userInfo }: BuildTypingSectionParams): {
    userId: string;
    expiresInMs: number | null;
    timestamp: number | null;
    userInfo: unknown | null;
} | null;
interface BuildActorSectionParams {
    actorId: string;
    actorType?: ActorType;
    info?: unknown | null;
}
export declare function buildActorSection({ actorId, actorType, info }: BuildActorSectionParams): {
    actorId: string;
    actorType: ActorType;
    info: unknown | null;
} | null;
interface BuildUserSectionParams {
    userId: string;
    type?: string | null;
    meta?: Record<string, unknown>;
    stats?: {
        dialogCount?: number;
        unreadDialogsCount?: number;
        totalUnreadCount?: number;
        totalMessagesCount?: number;
    };
}
export declare function buildUserSection({ userId, type, meta, stats }: BuildUserSectionParams): {
    userId: string;
    type: string | null;
    meta: Record<string, unknown>;
    stats?: {
        dialogCount: number;
        unreadDialogsCount: number;
        totalUnreadCount: number;
        totalMessagesCount: number;
    };
} | null;
interface ComposeEventDataParams {
    context: ReturnType<typeof buildEventContext>;
    dialog?: ReturnType<typeof buildDialogSection> | null;
    member?: ReturnType<typeof buildMemberSection> | null;
    message?: ReturnType<typeof buildMessageSection> | null;
    user?: ReturnType<typeof buildUserSection> | null;
    typing?: ReturnType<typeof buildTypingSection> | null;
    actor?: ReturnType<typeof buildActorSection> | null;
    topic?: ReturnType<typeof buildTopicSection> | null;
    extra?: Record<string, unknown>;
}
export declare function composeEventData({ context, dialog, member, message, user, typing, actor, topic, extra }: ComposeEventDataParams): Record<string, unknown>;
interface CreateEventParams {
    tenantId: string;
    eventType: EventType;
    entityType: EntityType;
    entityId: string;
    actorId?: string;
    actorType?: ActorType;
    data?: Record<string, unknown>;
}
/**
 * Создает событие в системе
 */
export declare function createEvent({ tenantId, eventType, entityType, entityId, actorId, actorType, data }: CreateEventParams): Promise<IEvent | null>;
interface GetEntityEventsOptions {
    limit?: number;
    sort?: Record<string, 1 | -1>;
    eventType?: EventType | null;
}
/**
 * Получает события для конкретной сущности
 */
export declare function getEntityEvents(tenantId: string, entityType: EntityType, entityId: string, options?: GetEntityEventsOptions): Promise<unknown[]>;
interface GetEventsByTypeOptions {
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;
}
/**
 * Получает события определенного типа
 */
export declare function getEventsByType(tenantId: string, eventType: EventType, options?: GetEventsByTypeOptions): Promise<unknown[]>;
interface GetUserEventsOptions {
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;
    eventType?: EventType | null;
}
/**
 * Получает события пользователя
 */
export declare function getUserEvents(tenantId: string, actorId: string, options?: GetUserEventsOptions): Promise<unknown[]>;
interface GetAllEventsOptions {
    page?: number;
    limit?: number;
    sort?: Record<string, 1 | -1>;
}
/**
 * Получает все события с фильтрацией и пагинацией
 */
export declare function getAllEvents(tenantId: string, filters?: Record<string, unknown>, options?: GetAllEventsOptions): Promise<{
    events: unknown[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}>;
/**
 * Удаляет старые события (для очистки истории)
 */
export declare function deleteOldEvents(tenantId: string, beforeDate: number): Promise<number>;
interface GetEventStatsOptions {
    startDate?: number | null;
    endDate?: number | null;
}
/**
 * Получает статистику по событиям
 */
export declare function getEventStats(tenantId: string, options?: GetEventStatsOptions): Promise<unknown[]>;
declare const _default: {
    createEvent: typeof createEvent;
    getEntityEvents: typeof getEntityEvents;
    getEventsByType: typeof getEventsByType;
    getUserEvents: typeof getUserEvents;
    getAllEvents: typeof getAllEvents;
    deleteOldEvents: typeof deleteOldEvents;
    getEventStats: typeof getEventStats;
    buildEventContext: typeof buildEventContext;
    buildDialogSection: typeof buildDialogSection;
    buildMemberSection: typeof buildMemberSection;
    buildTopicSection: typeof buildTopicSection;
    buildMessageSection: typeof buildMessageSection;
    buildTypingSection: typeof buildTypingSection;
    buildActorSection: typeof buildActorSection;
    composeEventData: typeof composeEventData;
};
export default _default;
//# sourceMappingURL=eventUtils.d.ts.map