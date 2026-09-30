import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

export interface IMessageCountClaim extends mongoose.Document {
  tenantId: string;
  eventId: string;
  eventType: string;
  claimedAt: number;
}

const messageCountClaimSchema = new mongoose.Schema<IMessageCountClaim>({
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  eventId: {
    type: String,
    required: true,
    match: /^evt_[a-z0-9]{32}$/
  },
  eventType: {
    type: String,
    required: true
  },
  claimedAt: {
    type: Number,
    default: generateTimestamp,
    index: true
  }
}, {
  timestamps: false
});

messageCountClaimSchema.index({ tenantId: 1, eventId: 1 }, { unique: true });

export default mongoose.model<IMessageCountClaim>(
  'MessageCountClaim',
  messageCountClaimSchema
);
