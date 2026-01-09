import mongoose from 'mongoose';
import crypto from 'crypto';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

// TypeScript интерфейс для документа ApiKey
export interface IApiKey extends mongoose.Document {
  key: string;
  name: string;
  description?: string;
  isActive: boolean;
  permissions: string[];
  expiresAt?: number;
  lastUsedAt?: number;
  createdAt: number;
  isValid(): boolean;
  updateLastUsed(): Promise<void>;
}

// Интерфейс для статических методов
export interface IApiKeyModel extends mongoose.Model<IApiKey> {
  generateKey(): string;
}

const apiKeySchema = new mongoose.Schema<IApiKey, IApiKeyModel>({
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
  }
}, {
  timestamps: false // Отключаем автоматические timestamps
});

// Pre-save hook для установки createdAt при создании
apiKeySchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

// Generate API key
apiKeySchema.statics.generateKey = function(): string {
  return 'chat3_' + crypto.randomBytes(32).toString('hex');
};

// Method to check if key is valid
apiKeySchema.methods.isValid = function(): boolean {
  if (!this.isActive) return false;
  if (this.expiresAt && this.expiresAt < generateTimestamp()) return false;
  return true;
};

// Update last used timestamp
apiKeySchema.methods.updateLastUsed = async function(): Promise<void> {
  this.lastUsedAt = generateTimestamp();
  await this.save();
};

// Indexes
apiKeySchema.index({ isActive: 1 });
apiKeySchema.index({ expiresAt: 1 });

const ApiKey = mongoose.model<IApiKey, IApiKeyModel>('ApiKey', apiKeySchema);

export default ApiKey;
