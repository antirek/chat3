import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

// TypeScript интерфейс для документа UserDialogStats
export interface IUserDialogStats extends mongoose.Document {
  tenantId: string;
  userId: string;
  dialogId: string;
  unreadCount: number;
  lastUpdatedAt: number;
  createdAt: number;
}

const userDialogStatsSchema = new mongoose.Schema<IUserDialogStats>({
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
  unreadCount: {
    type: Number,
    default: 0,
    min: 0,
    required: true,
    description: 'Количество непрочитанных сообщений в диалоге для пользователя'
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
userDialogStatsSchema.pre('save', function(next) {
  const now = generateTimestamp();
  if (this.isNew) {
    this.createdAt = now;
  }
  this.lastUpdatedAt = now;
  next();
});

// Индексы для производительности
userDialogStatsSchema.index({ tenantId: 1, userId: 1, dialogId: 1 }, { unique: true });
userDialogStatsSchema.index({ tenantId: 1, userId: 1, unreadCount: 1 });
userDialogStatsSchema.index({ tenantId: 1, dialogId: 1 });
userDialogStatsSchema.index({ tenantId: 1, unreadCount: 1 });

// Включить виртуальные поля в JSON/Object
userDialogStatsSchema.set('toJSON', { virtuals: true });
userDialogStatsSchema.set('toObject', { virtuals: true });

const UserDialogStats = mongoose.model<IUserDialogStats>('UserDialogStats', userDialogStatsSchema);

export default UserDialogStats;
