import mongoose from 'mongoose';

const dialogSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  name: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
dialogSchema.index({ tenantId: 1 });

// Включить виртуальные поля в JSON/Object
dialogSchema.set('toJSON', { virtuals: true });
dialogSchema.set('toObject', { virtuals: true });

const Dialog = mongoose.model('Dialog', dialogSchema);

export default Dialog;

