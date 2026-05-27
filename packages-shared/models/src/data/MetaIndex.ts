import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { META_ENTITY_TYPES, type MetaEntityType } from './metaEntityTypes.js';

export interface IMetaIndex extends mongoose.Document {
  tenantId: string;
  entityType: MetaEntityType;
  indexId: string;
  value: string;
  entityId: string;
  createdAt: number;
}

const metaIndexSchema = new mongoose.Schema<IMetaIndex>({
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  entityType: {
    type: String,
    enum: META_ENTITY_TYPES,
    required: true
  },
  indexId: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true
  },
  entityId: {
    type: String,
    required: true
  },
  createdAt: {
    type: Number,
    default: generateTimestamp
  }
}, {
  timestamps: false
});

metaIndexSchema.pre('save', function (next) {
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

metaIndexSchema.index({ tenantId: 1, entityType: 1, indexId: 1, value: 1 }, { unique: true });
metaIndexSchema.index({ tenantId: 1, entityType: 1, entityId: 1 });

const MetaIndex = mongoose.model<IMetaIndex>('MetaIndex', metaIndexSchema);

export default MetaIndex;
