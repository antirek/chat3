import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

export interface IPackLink extends mongoose.Document {
  packId: string;
  dialogId: string;
  tenantId: string;
  addedAt: number;
}

const packLinkSchema = new mongoose.Schema<IPackLink>({
  packId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^pck_[a-z0-9]{20}$/
  },
  dialogId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^dlg_[a-z0-9]{20}$/
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  addedAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Дата добавления диалога в пак'
  }
}, {
  timestamps: false
});

packLinkSchema.pre('save', function(next) {
  if (this.isNew) {
    this.addedAt = generateTimestamp();
  }
  next();
});

packLinkSchema.index({ packId: 1, dialogId: 1 }, { unique: true });
packLinkSchema.index({ dialogId: 1, packId: 1 });
packLinkSchema.index({ packId: 1, addedAt: -1 });

packLinkSchema.set('toJSON', { virtuals: true });
packLinkSchema.set('toObject', { virtuals: true });

const PackLink = mongoose.model<IPackLink>('PackLink', packLinkSchema);

export default PackLink;
