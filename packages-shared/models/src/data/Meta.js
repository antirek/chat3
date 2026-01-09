import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

const metaSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  entityType: {
    type: String,
    enum: ['user', 'dialog', 'message', 'tenant', 'system', 'dialogMember', 'topic'],
    required: true
  },
  entityId: {
    type: String,
    required: true,
    description: 'ID сущности (строка)'
  },
  key: {
    type: String,
    required: true,
    trim: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  dataType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    required: true
  },
  createdBy: {
    type: String,
    description: 'ID создателя (строка)'
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp создания (микросекунды)'
  }
}, {
  timestamps: false // Отключаем автоматические timestamps
});

// Pre-save hook для установки createdAt при создании
metaSchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

// Compound indexes for uniqueness and queries
// Unique index: ensures one meta entry per tenant/entity/key combination
metaSchema.index({ tenantId: 1, entityType: 1, entityId: 1, key: 1 }, { unique: true });
metaSchema.index({ entityType: 1, entityId: 1 });
metaSchema.index({ key: 1 });
// Unique index for participant records (ensures one participant entry per user per dialog)
metaSchema.index(
  { tenantId: 1, entityType: 1, entityId: 1, key: 1, 'value.userId': 1 },
  {
    unique: true,
    partialFilterExpression: { key: 'participant' }
  }
);
// Index for filtering topics by meta tags (topic.meta.{param},eq,{value})
metaSchema.index({ tenantId: 1, entityType: 1, key: 1, value: 1 });

const Meta = mongoose.model('Meta', metaSchema);

export default Meta;

