import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

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
 * - MessageStatusStats и unread пересчитывает counter-worker по событиям
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

// TypeScript интерфейс для документа MessageStatus
export interface IMessageStatus extends mongoose.Document {
  messageId: string;
  userId: string;
  userType?: string | null;
  tenantId: string;
  dialogId: string;
  status: string; // произвольный статус: [a-z0-9_-], 1–64 символа (например unread, delivered, read, error2)
  createdAt: number;
  // Временное поле для передачи sourceEventId (не сохраняется в БД)
  _sourceEventId?: string | null;
}

const messageStatusSchema = new mongoose.Schema<IMessageStatus>({
  messageId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^msg_[a-z0-9]{20}$/,
    index: true,
    description: 'ID сообщения в формате msg_XXXXXXXXXXXXXXXXXXXX'
  },
  userId: {
    type: String,
    required: true,
    description: 'ID пользователя (строка, не ObjectId)'
  },
  userType: {
    type: String,
    required: false,
    trim: true,
    description: 'Тип пользователя (user, bot, contact и т.д.). Заполняется автоматически при создании записи на основе типа пользователя из модели User. Может быть null, если тип пользователя не определен.'
  },
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  dialogId: {
    type: String,
    required: true,
    index: true,
    description: 'ID диалога, к которому относится сообщение'
  },
  status: {
    type: String,
    default: 'sent',
    required: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9_-]{1,64}$/,
    description: 'Статус сообщения: произвольная строка (например sent, unread, delivered, read, error2). Формат: [a-z0-9_-], 1–64 символа'
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    required: true,
    description: 'Timestamp создания (микросекунды)'
  }
}, {
  timestamps: false // Отключаем автоматические timestamps
});

// Временное поле для передачи sourceEventId (не сохраняется в БД)
// В Mongoose поля, не определенные в схеме, не сохраняются в БД,
// но доступны в документе и middleware до сохранения
// Мы явно не добавляем _sourceEventId в схему, чтобы оно не сохранялось

// Pre-save hook для установки createdAt при создании и получения oldStatus
messageStatusSchema.pre('save', async function(next) {
  const wasNew = this.isNew;
  // Сохраняем флаг isNew, так как после сохранения он станет false
  (this as any).__wasNew = wasNew;
  
  if (wasNew) {
    this.createdAt = generateTimestamp();
    
    // Получаем последний статус ДО сохранения нового документа
    // Это гарантирует, что мы не найдем сам создаваемый документ
    try {
      const MessageStatusModel = mongoose.model<IMessageStatus>('MessageStatus') as mongoose.Model<IMessageStatus>;
      const lastStatus = await MessageStatusModel.findOne({
        messageId: this.messageId,
        userId: this.userId,
        tenantId: this.tenantId
      })
        .sort({ createdAt: -1 })
        .lean();
      
      // Сохраняем oldStatus во временном поле для использования в post-save hook
      (this as any)._oldStatus = lastStatus?.status || 'unread';
      console.log(`📋 MessageStatus pre-save: messageId=${this.messageId}, userId=${this.userId}, oldStatus=${(this as any)._oldStatus}, newStatus=${this.status}`);
    } catch (error) {
      console.error('Error getting oldStatus in pre-save:', error);
      (this as any)._oldStatus = 'unread';
    }
  }
  next();
});

/**
 * Индексы для производительности
 * 
 * ВАЖНО: Уникальный индекс на (messageId, userId) НЕ используется,
 * так как MessageStatus хранит историю - один пользователь может иметь
 * несколько записей статусов для одного сообщения.
 */
messageStatusSchema.index({ messageId: 1, userId: 1, createdAt: -1 }); // Для получения последнего статуса пользователя
messageStatusSchema.index({ tenantId: 1, userId: 1, status: 1 }); // Для фильтрации по тенанту, пользователю и статусу
messageStatusSchema.index({ messageId: 1, status: 1 }); // Для фильтрации по сообщению и статусу
messageStatusSchema.index({ userId: 1, status: 1 }); // Для фильтрации по пользователю и статусу
messageStatusSchema.index({ tenantId: 1, status: 1 }); // Для фильтрации по тенанту и статусу
messageStatusSchema.index({ tenantId: 1, messageId: 1, userId: 1, createdAt: -1 }); // Составной индекс для быстрого поиска последнего статуса
messageStatusSchema.index({ tenantId: 1, dialogId: 1 }); // Для фильтрации по диалогу
messageStatusSchema.index({ dialogId: 1, userId: 1 }); // Для фильтрации по диалогу и пользователю

// Включить виртуальные поля в JSON/Object
messageStatusSchema.set('toJSON', { virtuals: true });
messageStatusSchema.set('toObject', { virtuals: true });

const MessageStatus = mongoose.model<IMessageStatus>('MessageStatus', messageStatusSchema);

export default MessageStatus;
