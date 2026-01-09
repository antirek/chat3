import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

const messageReactionStatsSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true,
    description: 'ID тенанта'
  },
  messageId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^msg_[a-z0-9]{20}$/,
    description: 'ID сообщения (строка в формате msg_XXXXXXXXXXXXXXXXXXXX)'
  },
  reaction: {
    type: String,
    required: true,
    description: 'Тип реакции (👍, ❤️, 😂, etc.)'
  },
  count: {
    type: Number,
    default: 0,
    min: 0,
    required: true,
    description: 'Количество реакций этого типа'
  },
  lastUpdatedAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp последнего обновления (микросекунды)'
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp создания (микросекунды)'
  }
}, {
  timestamps: false // Отключаем автоматические timestamps
});

// Pre-save hook для установки timestamps
messageReactionStatsSchema.pre('save', function(next) {
  const now = generateTimestamp();
  if (this.isNew) {
    this.createdAt = now;
  }
  this.lastUpdatedAt = now;
  next();
});

// Индексы для производительности
messageReactionStatsSchema.index({ tenantId: 1, messageId: 1, reaction: 1 }, { unique: true });
messageReactionStatsSchema.index({ tenantId: 1, messageId: 1 }); // Для выборки всех реакций сообщения
messageReactionStatsSchema.index({ tenantId: 1, reaction: 1, count: 1 }); // Для поиска популярных реакций

// Включить виртуальные поля в JSON/Object
messageReactionStatsSchema.set('toJSON', { virtuals: true });
messageReactionStatsSchema.set('toObject', { virtuals: true });

const MessageReactionStats = mongoose.model('MessageReactionStats', messageReactionStatsSchema);

export default MessageReactionStats;

