import mongoose from 'mongoose';
import { generateTimestamp } from '../../utils/timestampUtils.js';
import { 
  updateStatusCount, 
  updateUnreadCount,
  finalizeCounterUpdateContext 
} from '../../apps/tenant-api/utils/counterUtils.js';
import { Event, Message } from '../index.js';

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
const messageStatusSchema = new mongoose.Schema({
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
  status: {
    type: String,
    default: 'sent',
    required: true,
    enum: ['sent', 'unread', 'delivered', 'read'],
    description: 'Статус сообщения: sent (отправлено), unread (не прочитано, по умолчанию для новых сообщений), delivered (доставлено), read (прочитано)'
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

// Pre-save hook для установки createdAt при создании
messageStatusSchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAt = generateTimestamp();
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

/**
 * Middleware для обновления счетчиков при создании нового статуса
 * 
 * Для истории статусов всегда создаем новую запись, поэтому:
 * 1. Получаем последний статус для этого пользователя и сообщения
 * 2. Используем его как oldStatus для обновления счетчиков
 * 3. Если предыдущего статуса нет, считаем oldStatus = 'unread'
 * 
 * Это позволяет корректно обновлять счетчики непрочитанных сообщений
 * при каждом изменении статуса в истории.
 */
messageStatusSchema.post('save', async function(doc) {
  if (doc.isNew) {
    try {
      // Получаем последний статус для этого пользователя и сообщения (до текущего)
      const lastStatus = await this.constructor.findOne({
        messageId: doc.messageId,
        userId: doc.userId,
        tenantId: doc.tenantId,
        _id: { $ne: doc._id }
      })
        .sort({ createdAt: -1 })
        .lean();
      
      const oldStatus = lastStatus?.status || 'unread';
      
      // Получаем eventId из созданного события message.status.update
      const messageEvent = await Event.findOne({
        tenantId: doc.tenantId,
        eventType: 'message.status.update',
        entityId: doc.messageId,
        'data.context.messageId': doc.messageId
      }).sort({ createdAt: -1 });
      
      const sourceEventId = messageEvent?._id || null;
      const sourceEventType = 'message.status.update';
      
      // КРИТИЧНО: Используем try-finally для гарантированной финализации контекстов
      try {
        // Обновляем счетчик статусов
        await updateStatusCount(
          doc.tenantId,
          doc.messageId,
          doc.status,
          1, // delta
          sourceEventType,
          sourceEventId,
          doc.userId,
          'user'
        );
        
        // Обновляем unreadCount если статус изменился на 'read'
        if (oldStatus !== 'read' && doc.status === 'read') {
          // Получаем dialogId из сообщения
          const message = await Message.findOne({ messageId: doc.messageId }).lean();
          
          if (message && message.dialogId) {
            await updateUnreadCount(
              doc.tenantId,
              doc.userId,
              message.dialogId,
              -1, // delta (уменьшаем при прочтении)
              sourceEventType,
              sourceEventId,
              doc.messageId,
              doc.userId,
              'user'
            );
          }
        }
      } finally {
        // Финализируем контекст для пользователя
        if (sourceEventId) {
          try {
            await finalizeCounterUpdateContext(doc.tenantId, doc.userId, sourceEventId);
          } catch (error) {
            console.error(`Failed to finalize context for ${doc.userId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error updating counters in post-save:', error);
      // Не прерываем сохранение из-за ошибки счетчиков
    }
  }
});

// Включить виртуальные поля в JSON/Object
messageStatusSchema.set('toJSON', { virtuals: true });
messageStatusSchema.set('toObject', { virtuals: true });

const MessageStatus = mongoose.model('MessageStatus', messageStatusSchema);

export default MessageStatus;
