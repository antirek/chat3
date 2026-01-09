import mongoose from 'mongoose';
/**
 * MessageStatus - История изменений статусов сообщений
 *
 * ВАЖНО: MessageStatus хранит полную историю всех изменений статусов для каждого пользователя.
 * Каждое изменение статуса создает новую запись в истории (не обновляет существующую).
 *
 * Особенности:
 * - Один пользователь может иметь несколько записей статусов для одного сообщения
 * - Каждая запись представляет одно изменение статуса в определенный момент времени
 * - Поле userType заполняется автоматически при создании записи на основе типа пользователя
 * - При создании новой записи автоматически обновляются счетчики непрочитанных сообщений
 *
 * Пример истории для пользователя marta и сообщения msg_123:
 * - Запись 1: { status: 'unread', createdAt: 1000, userType: 'user' }
 * - Запись 2: { status: 'delivered', createdAt: 2000, userType: 'user' }
 * - Запись 3: { status: 'read', createdAt: 3000, userType: 'user' }
 *
 * Индексы:
 * - { messageId, userId, createdAt: -1 } - для получения последнего статуса пользователя
 * - { tenantId, messageId, userId, createdAt: -1 } - составной индекс для быстрого поиска
 * - Другие индексы для фильтрации и агрегации
 */
export interface IMessageStatus extends mongoose.Document {
    messageId: string;
    userId: string;
    userType?: string | null;
    tenantId: string;
    dialogId: string;
    status: 'sent' | 'unread' | 'delivered' | 'read';
    createdAt: number;
    _sourceEventId?: string | null;
}
declare const MessageStatus: mongoose.Model<IMessageStatus, {}, {}, {}, mongoose.Document<unknown, {}, IMessageStatus, {}, {}> & IMessageStatus & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default MessageStatus;
//# sourceMappingURL=MessageStatus.d.ts.map