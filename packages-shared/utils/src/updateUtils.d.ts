import mongoose from 'mongoose';
interface EventData {
    dialog?: {
        dialogId: string;
        [key: string]: unknown;
    };
    member?: {
        userId: string;
        [key: string]: unknown;
    };
    message?: {
        messageId: string;
        [key: string]: unknown;
    };
    typing?: {
        userId?: string;
        expiresInMs?: number;
        timestamp?: number;
        userInfo?: unknown;
        [key: string]: unknown;
    };
    context?: {
        eventType?: string;
        dialogId?: string;
        entityId?: string;
        messageId?: string;
        includedSections?: string[];
        updatedFields?: string[];
        [key: string]: unknown;
    };
    user?: {
        userId: string;
        [key: string]: unknown;
    };
    userId?: string;
    newStatus?: string;
    oldStatus?: string;
    reaction?: string;
    oldReaction?: string;
    reactionSet?: unknown;
    [key: string]: unknown;
}
/**
 * Формирует DialogUpdate для всех участников диалога
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export declare function createDialogUpdate(tenantId: string, dialogId: string, eventId: string | mongoose.Types.ObjectId, eventType: string, eventData?: EventData): Promise<void>;
/**
 * Формирует DialogMemberUpdate для конкретного участника диалога
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export declare function createDialogMemberUpdate(tenantId: string, dialogId: string, userId: string, eventId: string | mongoose.Types.ObjectId, eventType: string, eventData?: EventData): Promise<void>;
/**
 * Формирует MessageUpdate для всех участников диалога
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export declare function createMessageUpdate(tenantId: string, dialogId: string, messageId: string, eventId: string | mongoose.Types.ObjectId, eventType: string, eventData?: EventData): Promise<void>;
/**
 * Формирует TypingUpdate для всех участников диалога (кроме инициатора)
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export declare function createTypingUpdate(tenantId: string, dialogId: string, typingUserId: string, eventId: string | mongoose.Types.ObjectId, eventType: string, eventData?: EventData): Promise<void>;
/**
 * Создает UserStatsUpdate - update со статистикой пользователя (dialogCount, unreadDialogsCount)
 */
export declare function createUserStatsUpdate(tenantId: string, userId: string, sourceEventId: string | mongoose.Types.ObjectId, sourceEventType: string, updatedFields?: string[]): Promise<void>;
/**
 * Создает UserUpdate для события user.*
 */
export declare function createUserUpdate(tenantId: string, userId: string, eventId: string | mongoose.Types.ObjectId, eventType: string, eventData: EventData): Promise<void>;
/**
 * Определяет тип update из типа события
 */
export declare function getUpdateTypeFromEventType(eventType: string): string | null;
/**
 * Определяет, нужно ли создавать update для события
 */
export declare function shouldCreateUpdate(eventType: string): {
    dialog: boolean;
    dialogMember: boolean;
    message: boolean;
    typing: boolean;
    user: boolean;
};
export {};
//# sourceMappingURL=updateUtils.d.ts.map