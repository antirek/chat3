/**
 * Завершить контекст и создать user.stats.update
 * КРИТИЧНО: Гарантированная очистка контекста
 */
export function finalizeCounterUpdateContext(tenantId: any, userId: any, sourceEventId: any): Promise<void>;
/**
 * Обновление unreadCount
 * КРИТИЧНО: Используем атомарные операции для предотвращения race conditions
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @param {string} dialogId - ID диалога
 * @param {number} delta - Изменение счетчика (+1 или -1)
 * @param {string} sourceOperation - Тип операции
 * @param {string} sourceEventId - ID события
 * @param {string} sourceEntityId - ID сущности
 * @param {string} actorId - ID актора
 * @param {string} actorType - Тип актора
 * @param {string|null} topicId - ID топика (опционально). Если указан, обновляет UserTopicStats, иначе UserDialogStats
 * @param {Object} session - MongoDB session для транзакций (опционально)
 */
export function updateUnreadCount(tenantId: string, userId: string, dialogId: string, delta: number, sourceOperation: string, sourceEventId: string, sourceEntityId: string, actorId: string, actorType: string, topicId?: string | null, session?: any): Promise<{
    oldValue: number;
    newValue: number;
}>;
/**
 * Обновление reactionCount
 * КРИТИЧНО: Используем атомарные операции
 */
export function updateReactionCount(tenantId: any, messageId: any, reaction: any, delta: any, sourceOperation: any, actorId: any, actorType: any): Promise<{
    oldValue: number;
    newValue: number;
}>;
/**
 * Обновление statusCount
 * КРИТИЧНО: Используем атомарные операции
 */
export function updateStatusCount(tenantId: any, messageId: any, status: any, delta: any, sourceOperation: any, actorId: any, actorType: any): Promise<{
    oldValue: number;
    newValue: number;
}>;
/**
 * Получение всех реакций сообщения
 */
export function getMessageReactionCounts(tenantId: any, messageId: any): Promise<{
    reaction: string;
    count: number;
}[]>;
/**
 * Получение всех статусов сообщения
 */
export function getMessageStatusCounts(tenantId: any, messageId: any): Promise<{
    status: import("@chat3/models").MessageStatusType;
    count: number;
}[]>;
/**
 * Обновление dialogCount
 * КРИТИЧНО: Используем атомарные операции
 */
export function updateUserStatsDialogCount(tenantId: any, userId: any, delta: any, sourceOperation: any, sourceEventId: any, actorId: any, actorType: any): Promise<{
    oldValue: number;
    newValue: number;
}>;
/**
 * Обновление totalMessagesCount
 * КРИТИЧНО: Используем атомарные операции
 */
export function updateUserStatsTotalMessagesCount(tenantId: any, userId: any, delta: any, sourceOperation: any, sourceEventId: any, sourceEntityId: any, actorId: any, actorType: any): Promise<{
    oldValue: number;
    newValue: number;
}>;
/**
 * Пересчет всех счетчиков пользователя
 */
export function recalculateUserStats(tenantId: any, userId: any): Promise<{
    dialogCount: number;
    unreadDialogsCount: any;
    totalUnreadCount: any;
    totalMessagesCount: number;
}>;
/**
 * Получение истории изменений счетчика
 */
export function getCounterHistory(tenantId: any, options?: {}): Promise<(import("mongoose").FlattenMaps<import("@chat3/models").ICounterHistory> & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
})[]>;
/**
 * Обновление unreadCount для топика
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @param {string} dialogId - ID диалога
 * @param {string} topicId - ID топика
 * @param {number} delta - Изменение счетчика (+1 или -1)
 * @param {string} sourceOperation - Тип операции
 * @param {string} sourceEventId - ID события
 * @param {string} sourceEntityId - ID сущности
 * @param {string} actorId - ID актора
 * @param {string} actorType - Тип актора
 * @param {Object} session - MongoDB session для транзакций (опционально)
 * @returns {Promise<Object>} { oldValue, newValue }
 */
export function updateTopicUnreadCount(tenantId: string, userId: string, dialogId: string, topicId: string, delta: number, sourceOperation: string, sourceEventId: string, sourceEntityId: string, actorId: string, actorType: string, session?: any): Promise<any>;
/**
 * Получение unreadCount для топика
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @param {string} dialogId - ID диалога
 * @param {string} topicId - ID топика
 * @returns {Promise<number>} unreadCount
 */
export function getTopicUnreadCount(tenantId: string, userId: string, dialogId: string, topicId: string): Promise<number>;
/**
 * Получение общего unreadCount для диалога
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @param {string} dialogId - ID диалога
 * @returns {Promise<number>} unreadCount
 */
export function getDialogUnreadCount(tenantId: string, userId: string, dialogId: string): Promise<number>;
/**
 * Обновление счетчиков диалога (DialogStats)
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {Object} updates - Обновления { topicCount?: delta, memberCount?: delta, messageCount?: delta }
 * @param {Object} session - MongoDB session для транзакций (опционально)
 * @returns {Promise<Object>} Обновленная статистика
 */
export function updateDialogStats(tenantId: string, dialogId: string, updates?: any, session?: any): Promise<any>;
/**
 * Обновление topicCount в DialogStats
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {number} delta - Изменение счетчика (+1 или -1)
 * @param {Object} session - MongoDB session для транзакций (опционально)
 */
export function updateDialogTopicCount(tenantId: string, dialogId: string, delta: number, session?: any): Promise<any>;
/**
 * Обновление memberCount в DialogStats
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {number} delta - Изменение счетчика (+1 или -1)
 * @param {Object} session - MongoDB session для транзакций (опционально)
 */
export function updateDialogMemberCount(tenantId: string, dialogId: string, delta: number, session?: any): Promise<any>;
/**
 * Обновление messageCount в DialogStats
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {number} delta - Изменение счетчика (+1 или -1)
 * @param {Object} session - MongoDB session для транзакций (опционально)
 */
export function updateDialogMessageCount(tenantId: string, dialogId: string, delta: number, session?: any): Promise<any>;
/**
 * Пересчет общего unreadCount для диалога
 * Суммирует все unreadCount из UserTopicStats для данного диалога
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @param {string} dialogId - ID диалога
 * @returns {Promise<number>} Пересчитанный unreadCount
 */
export function recalculateDialogUnreadCount(tenantId: string, userId: string, dialogId: string): Promise<number>;
/**
 * Пересчет всех счетчиков диалога (DialogStats)
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @returns {Promise<Object>} Пересчитанная статистика
 */
export function recalculateDialogStats(tenantId: string, dialogId: string): Promise<any>;
//# sourceMappingURL=counterUtils.d.ts.map