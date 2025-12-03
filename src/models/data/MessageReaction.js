import mongoose from 'mongoose';
import { generateTimestamp } from '../../utils/timestampUtils.js';

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
  },
  updatedAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp обновления (микросекунды)'
  }
}, {
  timestamps: false // Отключаем автоматические timestamps
});

// Pre-save hook для обновления updatedAt с микросекундами
messageReactionSchema.pre('save', function(next) {
  this.updatedAt = generateTimestamp();
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

const MessageReaction = mongoose.model('MessageReaction', messageReactionSchema);

export default MessageReaction;

