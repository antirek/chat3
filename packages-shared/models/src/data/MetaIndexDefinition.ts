import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { META_ENTITY_TYPES, type MetaEntityType, type MetaIndexMode } from './metaEntityTypes.js';

export interface IMetaIndexDefinition extends mongoose.Document {
  tenantId: string;
  entityType: MetaEntityType;
  indexId: string;
  keys: string[];
  mode: MetaIndexMode;
  createdBy?: string;
  createdAt: number;
}

const metaIndexDefinitionSchema = new mongoose.Schema<IMetaIndexDefinition>({
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
    required: true,
    trim: true
  },
  keys: {
    type: [String],
    required: true
  },
  mode: {
    type: String,
    enum: ['unique', 'required', 'allowed'],
    required: true
  },
  createdBy: {
    type: String
  },
  createdAt: {
    type: Number,
    default: generateTimestamp
  }
}, {
  timestamps: false
});

metaIndexDefinitionSchema.pre('save', function (next) {
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

metaIndexDefinitionSchema.index({ tenantId: 1, entityType: 1 });
metaIndexDefinitionSchema.index({ tenantId: 1, entityType: 1, indexId: 1 }, { unique: true });

const MetaIndexDefinition = mongoose.model<IMetaIndexDefinition>(
  'MetaIndexDefinition',
  metaIndexDefinitionSchema
);

export default MetaIndexDefinition;
