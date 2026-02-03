import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

export interface IPackStats extends mongoose.Document {
  tenantId: string;
  packId: string;
  messageCount: number;
  uniqueMemberCount: number;
  sumMemberCount: number;
  uniqueTopicCount: number;
  sumTopicCount: number;
  lastUpdatedAt: number;
  createdAt: number;
}

const packStatsSchema = new mongoose.Schema<IPackStats>({
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
  messageCount: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    description: 'Количество сообщений во всех диалогах пака'
  },
  uniqueMemberCount: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    description: 'Уникальные участники по всем диалогам пака'
  },
  sumMemberCount: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    description: 'Суммарное количество участников (с повторениями) по диалогам'
  },
  uniqueTopicCount: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    description: 'Количество уникальных топиков по всем диалогам пака'
  },
  sumTopicCount: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    description: 'Суммарное количество топиков (с повторениями)'
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

packStatsSchema.pre('save', function(next) {
  const now = generateTimestamp();
  if (this.isNew) {
    this.createdAt = now;
  }
  this.lastUpdatedAt = now;
  next();
});

packStatsSchema.index({ tenantId: 1, packId: 1 }, { unique: true });
packStatsSchema.index({ packId: 1 });
packStatsSchema.index({ tenantId: 1, messageCount: -1 });

packStatsSchema.set('toJSON', { virtuals: true });
packStatsSchema.set('toObject', { virtuals: true });

const PackStats = mongoose.model<IPackStats>('PackStats', packStatsSchema);

export default PackStats;
