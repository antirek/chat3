import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

// Для обратной совместимости: статус — произвольная строка
export type MessageStatusType = string;

// TypeScript интерфейс для документа MessageStatusStats
// status — произвольная строка (например sent, unread, delivered, read, error2)
export interface IMessageStatusStats extends mongoose.Document {
  tenantId: string;
  messageId: string;
  status: string;
  count: number;
  lastUpdatedAt: number;
  createdAt: number;
}

const messageStatusStatsSchema = new mongoose.Schema<IMessageStatusStats>({
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
    trim: true,
    lowercase: true,
    match: /^[a-z0-9_-]{1,64}$/,
    description: 'Статус сообщения: произвольная строка (формат [a-z0-9_-], 1–64 символа)'
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

const MessageStatusStats = mongoose.model<IMessageStatusStats>('MessageStatusStats', messageStatusStatsSchema);

export default MessageStatusStats;
