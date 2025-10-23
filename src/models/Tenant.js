import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  domain: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  type: {
    type: String,
    enum: ['system', 'client'],
    default: 'client',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
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

// Indexes
// domain index is created automatically by unique: true
tenantSchema.index({ isActive: 1 });
tenantSchema.index({ type: 1 });

const Tenant = mongoose.model('Tenant', tenantSchema);

export default Tenant;

