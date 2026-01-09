/**
 * Получение информации об отправителе сообщения
 */
export function getSenderInfo(tenantId: any, senderId: any, cache?: Map<any, any>, _options?: {}): Promise<any>;
/**
 * Объединение meta записей в объект {key: value}
 */
export function mergeMetaRecords(records?: any[]): {};
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
 * @param {string} tenantId - ID тенанта
 * @param {string} messageId - ID сообщения
 * @param {string} senderId - ID отправителя сообщения, статусы которого нужно исключить
 * @returns {Promise<Array>} Массив объектов { userType, status, count }
 */
export function buildStatusMessageMatrix(tenantId: string, _messageId: any, senderId: string): Promise<any[]>;
/**
 * Формирование reactionSet для сообщения
 */
export function buildReactionSet(tenantId: any, _messageId: any, currentUserId: any): Promise<any[]>;
/**
 * Получение информации о пользователе для контекста
 */
export function getContextUserInfo(tenantId: any, userId: any, fetchMeta: any): Promise<{
    userId: string;
    createdAt: number;
    meta: any;
    name?: undefined;
} | {
    userId: any;
    name: any;
    createdAt: any;
    meta: any;
}>;
/**
 * Вычисляет статистику пользователя (dialogCount и unreadDialogsCount)
 * Используется в update-worker для создания UserUpdate
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @returns {Promise<{dialogCount: number, unreadDialogsCount: number}>}
 */
export function getUserStats(tenantId: string, userId: string): Promise<{
    dialogCount: number;
    unreadDialogsCount: number;
}>;
//# sourceMappingURL=userDialogUtils.d.ts.map