import mongoose from 'mongoose';
import { generateTimestamp } from '../../utils/timestampUtils.js';
import { 
  updateReactionCount,
  finalizeCounterUpdateContext 
} from '../../apps/tenant-api/utils/counterUtils.js';
import { Event } from '../index.js';

const messageReactionSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
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
    description: 'ID пользователя, который поставил реакцию'
  },
  reaction: {
    type: String,
    required: true,
    description: 'Тип реакции: эмодзи (👍, ❤️, 😂) или текст (custom:text)'
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp создания (микросекунды)'
  }
}, {
  timestamps: false // Отключаем автоматические timestamps
});

// Pre-save hook для установки createdAt при создании
messageReactionSchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

// Составной уникальный индекс: один пользователь может иметь только одну реакцию определенного типа на сообщение
// Пользователь может иметь несколько разных реакций на одно сообщение
messageReactionSchema.index({ tenantId: 1, messageId: 1, userId: 1, reaction: 1 }, { unique: true });

// Индекс для подсчета реакций по типу
messageReactionSchema.index({ tenantId: 1, messageId: 1, reaction: 1 });

// Индекс для сортировки по времени
messageReactionSchema.index({ tenantId: 1, messageId: 1, createdAt: -1 });

// Индекс для получения всех реакций пользователя
messageReactionSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

/**
 * Middleware для обновления счетчиков реакций при создании/удалении реакции
 */
messageReactionSchema.post('save', async function(doc) {
  if (doc.isNew) {
    try {
      // Получаем eventId из созданного события message.reaction.update
      const messageEvent = await Event.findOne({
        tenantId: doc.tenantId,
        eventType: 'message.reaction.update',
        entityId: doc.messageId
      }).sort({ createdAt: -1 });
      
      const sourceEventId = messageEvent?._id || null;
      const sourceEventType = 'message.reaction.update';
      
      // КРИТИЧНО: Используем try-finally для гарантированной финализации контекстов
      try {
        // Увеличиваем счетчик реакции
        await updateReactionCount(
          doc.tenantId,
          doc.messageId,
          doc.reaction,
          1, // delta
          sourceEventType,
          sourceEventId,
          doc.userId,
          'user'
        );
      } finally {
        // Финализируем контекст (хотя для реакций обычно не создается user.stats.update)
        // Но оставляем для консистентности
        if (sourceEventId) {
          try {
            await finalizeCounterUpdateContext(doc.tenantId, doc.userId, sourceEventId);
          } catch (error) {
            console.error(`Failed to finalize context for ${doc.userId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error updating reaction counters in post-save:', error);
    }
  }
});

messageReactionSchema.post('remove', async function(doc) {
  try {
    // Получаем eventId из созданного события message.reaction.update
    const messageEvent = await Event.findOne({
      tenantId: doc.tenantId,
      eventType: 'message.reaction.update',
      entityId: doc.messageId
    }).sort({ createdAt: -1 });
    
    const sourceEventId = messageEvent?._id || null;
    const sourceEventType = 'message.reaction.update';
    
    // КРИТИЧНО: Используем try-finally для гарантированной финализации контекстов
    try {
      // Уменьшаем счетчик реакции
      await updateReactionCount(
        doc.tenantId,
        doc.messageId,
        doc.reaction,
        -1, // delta
        sourceEventType,
        sourceEventId,
        doc.userId,
        'user'
      );
    } finally {
      // Финализируем контекст
      if (sourceEventId) {
        try {
          await finalizeCounterUpdateContext(doc.tenantId, doc.userId, sourceEventId);
        } catch (error) {
          console.error(`Failed to finalize context for ${doc.userId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error updating reaction counters in post-remove:', error);
  }
});

const MessageReaction = mongoose.model('MessageReaction', messageReactionSchema);

export default MessageReaction;

