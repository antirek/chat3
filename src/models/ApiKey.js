import mongoose from 'mongoose';
import crypto from 'crypto';

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
    type: Date
  },
  lastUsedAt: {
    type: Date
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

// Generate API key
apiKeySchema.statics.generateKey = function() {
  return 'chat3_' + crypto.randomBytes(32).toString('hex');
};

// Method to check if key is valid
apiKeySchema.methods.isValid = function() {
  if (!this.isActive) return false;
  if (this.expiresAt && this.expiresAt < new Date()) return false;
  return true;
};

// Update last used timestamp
apiKeySchema.methods.updateLastUsed = async function() {
  this.lastUsedAt = new Date();
  await this.save();
};

// Indexes
apiKeySchema.index({ isActive: 1 });
apiKeySchema.index({ expiresAt: 1 });

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

export default ApiKey;

