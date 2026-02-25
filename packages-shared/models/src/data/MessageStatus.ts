import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { 
  updateStatusCount, 
  updateUnreadCount,
  finalizeCounterUpdateContext 
} from '@chat3/utils/counterUtils.js';
import { Message } from '../index.js';
import UserDialogUnreadBySenderType from '../stats/UserDialogUnreadBySenderType.js';
import { getUserType } from '@chat3/utils/userTypeUtils.js';
import { normalizeSenderType } from '@chat3/utils';

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
  // Проверяем, что это новый документ (используем флаг, так как isNew может быть false после сохранения)
  if ((doc as any).__wasNew !== undefined ? (doc as any).__wasNew : doc.isNew) {
    try {
      // Используем oldStatus, полученный в pre-save hook
      // Если по какой-то причине oldStatus не был установлен, получаем его заново
      let oldStatus = (doc as any)._oldStatus;
      
      if (oldStatus === undefined) {
        // Fallback: получаем последний статус (исключая текущий документ)
        const MessageStatusModel = mongoose.model<IMessageStatus>('MessageStatus') as mongoose.Model<IMessageStatus>;
        const lastStatus = await MessageStatusModel.findOne({
          messageId: doc.messageId,
          userId: doc.userId,
          tenantId: doc.tenantId,
          _id: { $ne: doc._id }
        })
          .sort({ createdAt: -1 })
          .lean();
        
        oldStatus = lastStatus?.status || 'unread';
      }
      
      console.log(`📊 MessageStatus post-save: messageId=${doc.messageId}, userId=${doc.userId}, oldStatus=${oldStatus}, newStatus=${doc.status}`);
      
      // КРИТИЧНО: Получаем sourceEventId из временного поля _sourceEventId
      // Это поле передается при создании MessageStatus и не сохраняется в БД
      const sourceEventId = doc._sourceEventId || null;
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
          doc.userId,
          'user'
        );
        console.log(`✅ MessageStatusStats updated: ${doc.tenantId}/${doc.messageId}/${doc.status} (+1)`);
        
        // Обновляем unreadCount если статус изменился на 'read'
        if (oldStatus !== 'read' && doc.status === 'read') {
          // КРИТИЧНО: Используем dialogId из документа (не нужно искать Message)
          if (doc.dialogId) {
            // Получаем topicId и senderId из сообщения
            const message = await Message.findOne({
              messageId: doc.messageId,
              tenantId: doc.tenantId
            }).select('topicId senderId').lean();
            
            const topicId = message?.topicId || null;
            
            console.log(`📉 Decreasing unreadCount: tenantId=${doc.tenantId}, userId=${doc.userId}, dialogId=${doc.dialogId}, messageId=${doc.messageId}`);
            
            await updateUnreadCount(
              doc.tenantId,
              doc.userId,
              doc.dialogId,
              -1, // delta (уменьшаем при прочтении)
              sourceEventType,
              sourceEventId,
              doc.messageId,
              doc.userId,
              'user',
              topicId // topicId для обновления счетчиков топика
            );
            
            // Декремент UserDialogUnreadBySenderType по типу отправителя (user/contact/bot)
            // Если senderId нет (системное сообщение) — декрементируем 'user', чтобы сумма по типам совпадала с UserDialogStats
            const fromType = message?.senderId
              ? normalizeSenderType(await getUserType(doc.tenantId, message.senderId))
              : 'user';
            const now = generateTimestamp();
            const row = await UserDialogUnreadBySenderType.findOne({
              tenantId: doc.tenantId,
              userId: doc.userId,
              dialogId: doc.dialogId,
              fromType
            })
              .select('countUnread')
              .lean();
            const newCount = Math.max(0, (row?.countUnread ?? 0) - 1);
            await UserDialogUnreadBySenderType.updateOne(
              {
                tenantId: doc.tenantId,
                userId: doc.userId,
                dialogId: doc.dialogId,
                fromType
              },
              { $set: { countUnread: newCount, lastUpdatedAt: now } }
            );
            
            console.log(`✅ unreadCount decreased for: tenantId=${doc.tenantId}, userId=${doc.userId}, dialogId=${doc.dialogId}`);
          } else {
            console.warn(`⚠️ dialogId is missing for messageId=${doc.messageId}, cannot update unreadCount`);
          }
        } else {
          console.log(`⏭️ Skipping unreadCount update: oldStatus=${oldStatus}, newStatus=${doc.status}`);
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
      console.error('❌ Error updating counters in post-save:', error);
      // Не прерываем сохранение из-за ошибки счетчиков
    }
  }
});

/**
 * Middleware для обновления счетчиков при удалении статуса
 * 
 * ВАЖНО: MessageStatus - это история, обычно статусы не удаляются.
 * Но если статус удаляется, нужно обновить MessageStatusStats.
 */
messageStatusSchema.post('deleteOne', async function(doc) {
  try {
    // Уменьшаем счетчик статуса
    await updateStatusCount(
      doc.tenantId,
      doc.messageId,
      doc.status,
      -1, // delta
      'message.status.update',
      doc.userId,
      'user'
    );
    console.log(`✅ MessageStatusStats updated: ${doc.tenantId}/${doc.messageId}/${doc.status} (-1)`);
    
    // Если удаляемый статус был 'read', нужно обновить unreadCount
    if (doc.status === 'read' && doc.dialogId) {
      // Получаем topicId из сообщения для обновления счетчиков топика
      const message = await Message.findOne({
        messageId: doc.messageId,
        tenantId: doc.tenantId
      }).select('topicId').lean();
      
      const topicId = message?.topicId || null;
      
      // Увеличиваем unreadCount (так как статус 'read' удален)
      await updateUnreadCount(
        doc.tenantId,
        doc.userId,
        doc.dialogId,
        1, // delta (увеличиваем при удалении статуса 'read')
        'message.status.update',
        null, // sourceEventId
        doc.messageId,
        doc.userId,
        'user',
        topicId
      );
      console.log(`✅ UserDialogStats.unreadCount updated: ${doc.tenantId}/${doc.userId}/${doc.dialogId} (+1)`);
    }
  } catch (error) {
    console.error('❌ Error updating counters in post-remove:', error);
    throw error; // Пробрасываем ошибку, чтобы увидеть её в логах
  }
});

// Включить виртуальные поля в JSON/Object
messageStatusSchema.set('toJSON', { virtuals: true });
messageStatusSchema.set('toObject', { virtuals: true });

const MessageStatus = mongoose.model<IMessageStatus>('MessageStatus', messageStatusSchema);

export default MessageStatus;
