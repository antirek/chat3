import mongoose from 'mongoose';

const dialogParticipantSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  dialogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dialog',
    required: true
  },
  userId: {
    type: String,  // Может быть ObjectId или произвольный идентификатор
    required: true,
    trim: true
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
  },
  isActive: {
    type: Boolean,
    default: true
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

// Compound unique index - one user can be in a dialog only once
dialogParticipantSchema.index(
  { tenantId: 1, dialogId: 1, userId: 1 }, 
  { unique: true }
);

// Query optimization indexes
dialogParticipantSchema.index({ dialogId: 1, isActive: 1 });
dialogParticipantSchema.index({ userId: 1, isActive: 1 });
dialogParticipantSchema.index({ tenantId: 1, dialogId: 1 });
dialogParticipantSchema.index({ tenantId: 1, userId: 1 });

// Virtual to check if participant has left
dialogParticipantSchema.virtual('hasLeft').get(function() {
  return !!this.leftAt;
});

// Virtual to populate user info
dialogParticipantSchema.virtual('userInfo', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Method to mark as left
dialogParticipantSchema.methods.markAsLeft = async function() {
  this.leftAt = new Date();
  this.isActive = false;
  await this.save();
};

// Enable virtuals in JSON/Object
dialogParticipantSchema.set('toJSON', { virtuals: true });
dialogParticipantSchema.set('toObject', { virtuals: true });

const DialogParticipant = mongoose.model('DialogParticipant', dialogParticipantSchema);

export default DialogParticipant;

