import mongoose from 'mongoose';
import crypto from 'crypto';
import { generateTimestamp } from '../utils/timestampUtils.js';

const apiKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  permissions: [{
    type: String,
    enum: ['read', 'write', 'delete']
  }],
  expiresAt: {
    type: Number,
    description: 'Timestamp истечения (микросекунды)'
  },
  lastUsedAt: {
    type: Number,
    description: 'Timestamp последнего использования (микросекунды)'
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
apiKeySchema.pre('save', function(next) {
  this.updatedAt = generateTimestamp();
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

// Generate API key
apiKeySchema.statics.generateKey = function() {
  return 'chat3_' + crypto.randomBytes(32).toString('hex');
};

// Method to check if key is valid
apiKeySchema.methods.isValid = function() {
  if (!this.isActive) return false;
  if (this.expiresAt && this.expiresAt < generateTimestamp()) return false;
  return true;
};

// Update last used timestamp
apiKeySchema.methods.updateLastUsed = async function() {
  this.lastUsedAt = generateTimestamp();
  await this.save();
};

// Indexes
apiKeySchema.index({ isActive: 1 });
apiKeySchema.index({ expiresAt: 1 });

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

export default ApiKey;

