/**
 * Получение информации об отправителе сообщения
 */
interface SenderInfo {
    userId: string;
    createdAt: number | null;
    meta: Record<string, unknown>;
}
export declare function getSenderInfo(tenantId: string, senderId: string, cache?: Map<string, SenderInfo | null>, _options?: Record<string, unknown>): Promise<SenderInfo | null>;
interface MetaRecord {
    key: string;
    value: unknown;
}
/**
 * Объединение meta записей в объект {key: value}
 */
export declare function mergeMetaRecords(records?: MetaRecord[]): Record<string, unknown>;
interface StatusMessageMatrixItem {
    userType: string | null;
    status: string;
    count: number;
}
/**
 * Формирование матрицы статусов сообщения (исключая статусы отправителя сообщения)
 *
 * ВАЖНО: Считает суммарные значения по всем статусам в истории для каждого userType и status.
 * Это означает, что если пользователь менял статус несколько раз (например: unread → delivered → read),
 * то каждая запись в истории будет учтена в матрице.
 *
 * Пример:
 * Если пользователь marta (userType: "user") менял статус:
 * - unread (createdAt: 1000)
 * - delivered (createdAt: 2000)
 * - read (createdAt: 3000)
 *
 * То в матрице будет:
 * [
 *   { userType: "user", status: "unread", count: 1 },
 *   { userType: "user", status: "delivered", count: 1 },
 *   { userType: "user", status: "read", count: 1 }
 * ]
 *
 * Это позволяет видеть, сколько раз сообщение проходило через каждый статус.
 *
 * Исключение отправителя обеспечивает единообразие матрицы для всех участников:
 * - Отправитель видит статусы всех получателей
 * - Получатели видят статусы других получателей (но не отправителя)
 * - Матрица одинакова для всех участников диалога
 *
 * @param tenantId - ID тенанта
 * @param _messageId - ID сообщения
 * @param senderId - ID отправителя сообщения, статусы которого нужно исключить
 * @returns Массив объектов { userType, status, count }
 */
export declare function buildStatusMessageMatrix(tenantId: string, _messageId: string, senderId: string): Promise<StatusMessageMatrixItem[]>;
interface ReactionSetItem {
    reaction: string;
    count: number;
    me: boolean;
}
/**
 * Формирование reactionSet для сообщения
 */
export declare function buildReactionSet(tenantId: string, _messageId: string, currentUserId: string): Promise<ReactionSetItem[]>;
interface ContextUserInfo {
    userId: string;
    createdAt: number | null;
    meta: Record<string, unknown>;
    name?: string | null;
}
type FetchMetaFunction = (entityType: string, entityId: string) => Promise<Record<string, unknown>>;
/**
 * Получение информации о пользователе для контекста
 */
export declare function getContextUserInfo(tenantId: string, userId: string, fetchMeta: FetchMetaFunction): Promise<ContextUserInfo | null>;
interface UserStats {
    dialogCount: number;
    unreadDialogsCount: number;
}
/**
 * Вычисляет статистику пользователя (dialogCount и unreadDialogsCount)
 * Используется в update-worker для создания UserUpdate
 * @param tenantId - ID тенанта
 * @param userId - ID пользователя
 * @returns {dialogCount: number, unreadDialogsCount: number}
 */
export declare function getUserStats(tenantId: string, userId: string): Promise<UserStats>;
export {};
//# sourceMappingURL=userDialogUtils.d.ts.map