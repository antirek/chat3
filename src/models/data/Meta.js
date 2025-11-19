import mongoose from 'mongoose';
import { generateTimestamp } from '../../utils/timestampUtils.js';

const metaSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true,
    match: /^tnt_[a-z0-9]+$/
  },
  entityType: {
    type: String,
    enum: ['user', 'dialog', 'message', 'tenant', 'system', 'dialogMember'],
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
  scope: {
    type: String,
    trim: true,
    maxlength: 100,
    default: null,
    description: 'Дополнительный контекст (например, userId) для персонализации'
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
  },
  updatedAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp обновления (микросекунды)'
  }
}, {
  timestamps: false // Отключаем автоматические timestamps
});

// Pre-save hook для обновления updatedAt с микросекундами
metaSchema.pre('save', function(next) {
  this.updatedAt = generateTimestamp();
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

// Compound indexes for uniqueness and queries
// Unique index: ensures one meta entry per tenant/entity/key/scope combination
metaSchema.index({ tenantId: 1, entityType: 1, entityId: 1, key: 1, scope: 1 }, { unique: true });
metaSchema.index({ entityType: 1, entityId: 1, scope: 1 });
metaSchema.index({ key: 1, scope: 1 });
// Unique index for participant records (ensures one participant entry per user per dialog)
metaSchema.index(
  { tenantId: 1, entityType: 1, entityId: 1, key: 1, scope: 1, 'value.userId': 1 },
  {
    unique: true,
    partialFilterExpression: { key: 'participant' }
  }
);

const Meta = mongoose.model('Meta', metaSchema);

export default Meta;

