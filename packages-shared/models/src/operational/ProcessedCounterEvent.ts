import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

export interface IProcessedCounterEvent extends mongoose.Document {
  tenantId: string;
  eventId: string;
  eventType: string;
  processedAt: number;
}

const processedCounterEventSchema = new mongoose.Schema<IProcessedCounterEvent>({
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
  processedAt: {
    type: Number,
    default: generateTimestamp,
    index: true
  }
}, {
  timestamps: false
});

processedCounterEventSchema.index({ tenantId: 1, eventId: 1 }, { unique: true });

export default mongoose.model<IProcessedCounterEvent>(
  'ProcessedCounterEvent',
  processedCounterEventSchema
);
