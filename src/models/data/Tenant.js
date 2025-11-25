import mongoose from 'mongoose';
import { generateTimestamp } from '../../utils/timestampUtils.js';

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
    maxlength: 20,
    default: generateTenantId
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
tenantSchema.pre('save', function(next) {
  this.updatedAt = generateTimestamp();
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

// Indexes
// tenantId index is created automatically by unique: true

const Tenant = mongoose.model('Tenant', tenantSchema);

export default Tenant;

