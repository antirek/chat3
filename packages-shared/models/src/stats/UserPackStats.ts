import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

export interface IUserPackStats extends mongoose.Document {
  tenantId: string;
  packId: string;
  userId: string;
  unreadCount: number;
  lastUpdatedAt: number;
  createdAt: number;
}

const userPackStatsSchema = new mongoose.Schema<IUserPackStats>({
  tenantId: {
    type: String,
    required: true,
    index: true,
    description: 'ID тенанта'
  },
  packId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^pck_[a-z0-9]{20}$/,
    description: 'ID пака (pck_XXXXXXXXXXXXXX)'
  },
  userId: {
    type: String,
    required: true,
    description: 'ID пользователя'
  },
  unreadCount: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    description: 'Количество непрочитанных сообщений по паку для пользователя'
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
  timestamps: false
});

userPackStatsSchema.pre('save', function(next) {
  const now = generateTimestamp();
  if (this.isNew) {
    this.createdAt = now;
  }
  this.lastUpdatedAt = now;
  next();
});

userPackStatsSchema.index({ tenantId: 1, userId: 1, packId: 1 }, { unique: true });
userPackStatsSchema.index({ tenantId: 1, packId: 1 });
userPackStatsSchema.index({ tenantId: 1, userId: 1 });
userPackStatsSchema.index({ tenantId: 1, unreadCount: 1 });
userPackStatsSchema.index({ tenantId: 1, userId: 1, unreadCount: 1 });

userPackStatsSchema.set('toJSON', { virtuals: true });
userPackStatsSchema.set('toObject', { virtuals: true });

const UserPackStats = mongoose.model<IUserPackStats>('UserPackStats', userPackStatsSchema);

export default UserPackStats;
