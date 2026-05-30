import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { updateReactionCount } from '@chat3/utils/counterUtils.js';

// TypeScript интерфейс для документа MessageReaction
export interface IMessageReaction extends mongoose.Document {
  tenantId: string;
  messageId: string;
  userId: string;
  reaction: string;
  createdAt: number;
}

const messageReactionSchema = new mongoose.Schema<IMessageReaction>({
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
      // Увеличиваем счетчик реакции
      await updateReactionCount(
        doc.tenantId,
        doc.messageId,
        doc.reaction,
        1, // delta
        'message.reaction.changed',
        doc.userId,
        'user'
      );
      console.log(`✅ MessageReactionStats updated: ${doc.tenantId}/${doc.messageId}/${doc.reaction} (+1)`);
    } catch (error) {
      console.error('❌ Error updating reaction counters in post-save:', error);
      throw error; // Пробрасываем ошибку, чтобы увидеть её в логах
    }
  }
});

messageReactionSchema.post('deleteOne', async function(doc) {
  try {
    // Уменьшаем счетчик реакции
    await updateReactionCount(
      doc.tenantId,
      doc.messageId,
      doc.reaction,
      -1, // delta
      'message.reaction.changed',
      doc.userId,
      'user'
    );
    console.log(`✅ MessageReactionStats updated: ${doc.tenantId}/${doc.messageId}/${doc.reaction} (-1)`);
  } catch (error) {
    console.error('❌ Error updating reaction counters in post-remove:', error);
    throw error; // Пробрасываем ошибку, чтобы увидеть её в логах
  }
});

const MessageReaction = mongoose.model<IMessageReaction>('MessageReaction', messageReactionSchema);

export default MessageReaction;
