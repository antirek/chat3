import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

// TypeScript интерфейс для документа UserTopicStats
export interface IUserTopicStats extends mongoose.Document {
  tenantId: string;
  userId: string;
  dialogId: string;
  topicId: string;
  unreadCount: number;
  lastUpdatedAt: number;
  createdAt: number;
}

const userTopicStatsSchema = new mongoose.Schema<IUserTopicStats>({
  tenantId: {
    type: String,
    required: true,
    index: true,
    description: 'ID тенанта'
  },
  userId: {
    type: String,
    required: true,
    description: 'ID пользователя'
  },
  dialogId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^dlg_[a-z0-9]{20}$/,
    description: 'ID диалога (строка в формате dlg_XXXXXXXXXXXXXXXXXXXX)'
  },
  topicId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^topic_[a-z0-9]{20}$/,
    description: 'ID топика (строка в формате topic_XXXXXXXXXXXXXXXXXXXX)'
  },
  unreadCount: {
    type: Number,
    default: 0,
    min: 0,
    required: true,
    description: 'Количество непрочитанных сообщений в топике для пользователя'
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
userTopicStatsSchema.pre('save', function(next) {
  const now = generateTimestamp();
  if (this.isNew) {
    this.createdAt = now;
  }
  this.lastUpdatedAt = now;
  next();
});

// Индексы для производительности
userTopicStatsSchema.index({ tenantId: 1, userId: 1, dialogId: 1, topicId: 1 }, { unique: true }); // составной уникальный ключ
userTopicStatsSchema.index({ tenantId: 1, userId: 1, dialogId: 1, unreadCount: 1 }); // для быстрого поиска
userTopicStatsSchema.index({ tenantId: 1, dialogId: 1, topicId: 1 }); // для получения всех пользователей топика

// Включить виртуальные поля в JSON/Object
userTopicStatsSchema.set('toJSON', { virtuals: true });
userTopicStatsSchema.set('toObject', { virtuals: true });

const UserTopicStats = mongoose.model<IUserTopicStats>('UserTopicStats', userTopicStatsSchema);

export default UserTopicStats;
