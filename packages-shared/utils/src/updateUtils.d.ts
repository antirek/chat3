/**
 * Формирует DialogUpdate для всех участников диалога
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export function createDialogUpdate(tenantId: any, dialogId: any, eventId: any, eventType: any, eventData?: {}): Promise<void>;
/**
 * Формирует DialogMemberUpdate для конкретного участника диалога
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export function createDialogMemberUpdate(tenantId: any, dialogId: any, userId: any, eventId: any, eventType: any, eventData?: {}): Promise<void>;
/**
 * Формирует MessageUpdate для всех участников диалога
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export function createMessageUpdate(tenantId: any, dialogId: any, messageId: any, eventId: any, eventType: any, eventData?: {}): Promise<void>;
/**
 * Формирует TypingUpdate для всех участников диалога (кроме инициатора)
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export function createTypingUpdate(tenantId: any, dialogId: any, typingUserId: any, eventId: any, eventType: any, eventData?: {}): Promise<void>;
/**
 * Создает UserStatsUpdate - update со статистикой пользователя (dialogCount, unreadDialogsCount)
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @param {string} sourceEventId - ID исходного события (message.create, dialog.member.add, dialog.member.update)
 * @param {string} sourceEventType - Тип исходного события
 * @param {string[]} updatedFields - Поля, которые изменились (например, ['user.stats.unreadDialogsCount'])
 */
export function createUserStatsUpdate(tenantId: string, userId: string, sourceEventId: string, sourceEventType: string, updatedFields?: string[]): Promise<void>;
/**
 * Создает UserUpdate для события user.*
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @param {string} eventId - ID события
 * @param {string} eventType - Тип события
 * @param {object} eventData - Данные события (содержит context, user)
 */
export function createUserUpdate(tenantId: string, userId: string, eventId: string, eventType: string, eventData: object): Promise<void>;
/**
 * Определяет тип update из типа события
 */
export function getUpdateTypeFromEventType(eventType: any): "DialogUpdate" | "DialogMemberUpdate" | "MessageUpdate" | "TypingUpdate" | "UserUpdate" | "UserStatsUpdate";
/**
 * Определяет, нужно ли создавать update для события
 */
export function shouldCreateUpdate(eventType: any): {
    dialog: boolean;
    dialogMember: boolean;
    message: boolean;
    typing: boolean;
    user: boolean;
};
//# sourceMappingURL=updateUtils.d.ts.map