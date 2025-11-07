import mongoose from 'mongoose';
import { generateTimestamp } from '../utils/timestampUtils.js';

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    description: 'Уникальный идентификатор пользователя'
  },
  tenantId: {
    type: String,
    required: true,
    match: /^tnt_[a-z0-9]+$/,
    description: 'ID тенанта'
  },
  name: {
    type: String,
    trim: true,
    description: 'Имя пользователя'
  },
  lastActiveAt: {
    type: Number,
    description: 'Timestamp последней активности в миллисекундах с микросекундами'
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp в миллисекундах с точностью до микросекунд'
  },
  updatedAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp в миллисекундах с точностью до микросекунд'
  }
}, {
  timestamps: false // Отключаем автоматические timestamps
});

// Индекс для быстрого поиска по userId + tenantId (должна быть уникальная пара)
userSchema.index({ userId: 1, tenantId: 1 }, { unique: true });

// Индекс для поиска по tenantId
userSchema.index({ tenantId: 1 });

// Hook для обновления updatedAt при сохранении
userSchema.pre('save', function(next) {
  this.updatedAt = generateTimestamp();
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

const User = mongoose.model('User', userSchema);

export default User;

