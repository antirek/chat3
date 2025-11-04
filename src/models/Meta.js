import mongoose from 'mongoose';

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
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for uniqueness and queries
// Non-unique index for general queries
metaSchema.index({ tenantId: 1, entityType: 1, entityId: 1, key: 1 });
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

const Meta = mongoose.model('Meta', metaSchema);

export default Meta;

