import mongoose from 'mongoose';
import { generateTimestamp } from '../../utils/timestampUtils.js';

const messageStatusStatsSchema = new mongoose.Schema({
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
  status: {
    type: String,
    required: true,
    enum: ['sent', 'unread', 'delivered', 'read'],
    description: 'Тип статуса'
  },
  count: {
    type: Number,
    default: 0,
    min: 0,
    required: true,
    description: 'Количество записей этого статуса в истории'
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
messageStatusStatsSchema.pre('save', function(next) {
  const now = generateTimestamp();
  if (this.isNew) {
    this.createdAt = now;
  }
  this.lastUpdatedAt = now;
  next();
});

// Индексы для производительности
messageStatusStatsSchema.index({ tenantId: 1, messageId: 1, status: 1 }, { unique: true });
messageStatusStatsSchema.index({ tenantId: 1, messageId: 1 }); // Для выборки всех статусов сообщения
messageStatusStatsSchema.index({ tenantId: 1, status: 1, count: 1 }); // Для поиска по статусам

// Включить виртуальные поля в JSON/Object
messageStatusStatsSchema.set('toJSON', { virtuals: true });
messageStatusStatsSchema.set('toObject', { virtuals: true });

const MessageStatusStats = mongoose.model('MessageStatusStats', messageStatusStatsSchema);

export default MessageStatusStats;

