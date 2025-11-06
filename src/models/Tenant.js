import mongoose from 'mongoose';
import { generateTimestamp } from '../utils/timestampUtils.js';

/**
 * Генерирует уникальный tenantId в формате tnt_XXXXXXXX
 * где XXXXXXXX - 8 символов (английские буквы + цифры)
 */
function generateTenantId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'tnt_';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const tenantSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: false, // Генерируется автоматически
    unique: true,
    trim: true,
    lowercase: true,
    match: /^tnt_[a-z0-9]+$/,
    default: generateTenantId
  },
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
  timestamps: true
});

// Indexes
// tenantId, domain indexes are created automatically by unique: true
tenantSchema.index({ isActive: 1 });
tenantSchema.index({ type: 1 });

const Tenant = mongoose.model('Tenant', tenantSchema);

export default Tenant;

