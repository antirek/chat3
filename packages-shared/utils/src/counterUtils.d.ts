import mongoose from 'mongoose';
/**
 * Завершить контекст и создать user.stats.update
 * КРИТИЧНО: Гарантированная очистка контекста
 */
export declare function finalizeCounterUpdateContext(tenantId: string, userId: string, sourceEventId: string | null): Promise<void>;
interface UpdateResult {
    oldValue: number;
    newValue: number;
}
/**
 * Обновление unreadCount
 * КРИТИЧНО: Используем атомарные операции для предотвращения race conditions
 */
export declare function updateUnreadCount(tenantId: string, userId: string, dialogId: string, delta: number, sourceOperation: string, sourceEventId: string | null, sourceEntityId: string, actorId: string, actorType: string, topicId?: string | null, session?: mongoose.ClientSession | null): Promise<UpdateResult>;
/**
 * Обновление reactionCount
 * КРИТИЧНО: Используем атомарные операции
 */
export declare function updateReactionCount(tenantId: string, messageId: string, reaction: string, delta: number, sourceOperation: string, actorId: string, actorType: string): Promise<UpdateResult>;
/**
 * Обновление statusCount
 * КРИТИЧНО: Используем атомарные операции
 */
export declare function updateStatusCount(tenantId: string, messageId: string, status: string, delta: number, sourceOperation: string, actorId: string, actorType: string): Promise<UpdateResult>;
/**
 * Получение всех реакций сообщения
 */
export declare function getMessageReactionCounts(tenantId: string, messageId: string): Promise<Array<{
    reaction: string;
    count: number;
}>>;
/**
 * Получение всех статусов сообщения
 */
export declare function getMessageStatusCounts(tenantId: string, messageId: string): Promise<Array<{
    status: string;
    count: number;
}>>;
/**
 * Обновление dialogCount
 * КРИТИЧНО: Используем атомарные операции
 */
export declare function updateUserStatsDialogCount(tenantId: string, userId: string, delta: number, sourceOperation: string, sourceEventId: string | null, actorId: string, actorType: string): Promise<UpdateResult>;
/**
 * Обновление totalMessagesCount
 * КРИТИЧНО: Используем атомарные операции
 */
export declare function updateUserStatsTotalMessagesCount(tenantId: string, userId: string, delta: number, sourceOperation: string, sourceEventId: string | null, sourceEntityId: string, actorId: string, actorType: string): Promise<UpdateResult>;
/**
 * Пересчет всех счетчиков пользователя
 */
export declare function recalculateUserStats(tenantId: string, userId: string): Promise<{
    dialogCount: number;
    unreadDialogsCount: number;
    totalUnreadCount: number;
    totalMessagesCount: number;
}>;
interface GetCounterHistoryOptions {
    counterType?: string;
    entityType?: string;
    entityId?: string;
    startDate?: number;
    endDate?: number;
    limit?: number;
    skip?: number;
}
/**
 * Получение истории изменений счетчика
 */
export declare function getCounterHistory(tenantId: string, options?: GetCounterHistoryOptions): Promise<unknown[]>;
/**
 * Обновление unreadCount для топика
 */
export declare function updateTopicUnreadCount(tenantId: string, userId: string, dialogId: string, topicId: string, delta: number, sourceOperation: string, sourceEventId: string, sourceEntityId: string, actorId: string, actorType: string, session?: mongoose.ClientSession | null): Promise<UpdateResult>;
/**
 * Получение unreadCount для топика
 */
export declare function getTopicUnreadCount(tenantId: string, userId: string, dialogId: string, topicId: string): Promise<number>;
/**
 * Получение общего unreadCount для диалога
 */
export declare function getDialogUnreadCount(tenantId: string, userId: string, dialogId: string): Promise<number>;
interface DialogStatsUpdates {
    topicCount?: number;
    memberCount?: number;
    messageCount?: number;
}
/**
 * Обновление счетчиков диалога (DialogStats)
 */
export declare function updateDialogStats(tenantId: string, dialogId: string, updates?: DialogStatsUpdates, session?: mongoose.ClientSession | null): Promise<unknown>;
/**
 * Обновление topicCount в DialogStats
 */
export declare function updateDialogTopicCount(tenantId: string, dialogId: string, delta: number, session?: mongoose.ClientSession | null): Promise<unknown>;
/**
 * Обновление memberCount в DialogStats
 */
export declare function updateDialogMemberCount(tenantId: string, dialogId: string, delta: number, session?: mongoose.ClientSession | null): Promise<unknown>;
/**
 * Обновление messageCount в DialogStats
 */
export declare function updateDialogMessageCount(tenantId: string, dialogId: string, delta: number, session?: mongoose.ClientSession | null): Promise<unknown>;
/**
 * Пересчет общего unreadCount для диалога
 * Суммирует все unreadCount из UserTopicStats для данного диалога
 */
export declare function recalculateDialogUnreadCount(tenantId: string, userId: string, dialogId: string): Promise<number>;
/**
 * Пересчет всех счетчиков диалога (DialogStats)
 */
export declare function recalculateDialogStats(tenantId: string, dialogId: string): Promise<{
    topicCount: number;
    memberCount: number;
    messageCount: number;
}>;
export {};
//# sourceMappingURL=counterUtils.d.ts.map