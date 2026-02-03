import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

function generatePackId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'pck_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface IPack extends mongoose.Document {
  packId: string;
  tenantId: string;
  createdAt: number;
}

const packSchema = new mongoose.Schema<IPack>({
  packId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^pck_[a-z0-9]{20}$/,
    default: generatePackId
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp в миллисекундах'
  }
}, {
  timestamps: false
});

packSchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

packSchema.index({ tenantId: 1, packId: 1 }, { unique: true });
packSchema.index({ tenantId: 1, createdAt: -1 });

packSchema.set('toJSON', { virtuals: true });
packSchema.set('toObject', { virtuals: true });

const Pack = mongoose.model<IPack>('Pack', packSchema);

export default Pack;
