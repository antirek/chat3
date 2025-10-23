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
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: {
      type: Date
    }
  }],
  avatar: {
    type: String
  },
  description: {
    type: String
  },
  lastMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: {
    type: Date
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
dialogSchema.index({ 'participants.userId': 1 });
dialogSchema.index({ lastMessageAt: -1 });

// Virtual для участников из DialogParticipant
dialogSchema.virtual('dialogParticipants', {
  ref: 'DialogParticipant',
  localField: '_id',
  foreignField: 'dialogId'
});

// Включить виртуальные поля в JSON/Object
dialogSchema.set('toJSON', { virtuals: true });
dialogSchema.set('toObject', { virtuals: true });

const Dialog = mongoose.model('Dialog', dialogSchema);

export default Dialog;

