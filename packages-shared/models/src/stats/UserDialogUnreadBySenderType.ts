import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

export interface IUserDialogUnreadBySenderType extends mongoose.Document {
  tenantId: string;
  userId: string;
  dialogId: string;
  fromType: string;
  countUnread: number;
  lastUpdatedAt: number;
  createdAt: number;
}

const schema = new mongoose.Schema<IUserDialogUnreadBySenderType>({
  tenantId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  dialogId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^dlg_[a-z0-9]{20}$/
  },
  fromType: { type: String, required: true, trim: true },
  countUnread: { type: Number, required: true, default: 0, min: 0 },
  lastUpdatedAt: { type: Number, default: generateTimestamp },
  createdAt: { type: Number, default: generateTimestamp }
}, { timestamps: false });

schema.pre('save', function(next) {
  const now = generateTimestamp();
  if (this.isNew) this.createdAt = now;
  this.lastUpdatedAt = now;
  next();
});

schema.index({ tenantId: 1, userId: 1, dialogId: 1, fromType: 1 }, { unique: true });
schema.index({ tenantId: 1, dialogId: 1 });
schema.index({ tenantId: 1, userId: 1 });

schema.set('toJSON', { virtuals: true });
schema.set('toObject', { virtuals: true });

const UserDialogUnreadBySenderType = mongoose.model<IUserDialogUnreadBySenderType>(
  'UserDialogUnreadBySenderType',
  schema
);

export default UserDialogUnreadBySenderType;
