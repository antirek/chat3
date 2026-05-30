import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import type { EventType, EntityType, ActorType } from './Event.js';

export interface IOutboxEvent extends mongoose.Document {
  eventId: string;
  tenantId: string;
  eventType: EventType;
  entityType: EntityType;
  entityId: string;
  actorId?: string;
  actorType: ActorType;
  data?: unknown;
  published: boolean;
  publishedAt?: number | null;
  publishAttempts: number;
  lastError?: string | null;
  createdAt: number;
}

const outboxEventSchema = new mongoose.Schema<IOutboxEvent>({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: /^evt_[a-z0-9]{32}$/
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    index: true
  },
  entityType: {
    type: String,
    required: true
  },
  entityId: {
    type: String,
    required: true
  },
  actorId: String,
  actorType: {
    type: String,
    enum: ['user', 'system', 'bot', 'api'],
    default: 'user'
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  published: {
    type: Boolean,
    default: false,
    index: true
  },
  publishedAt: {
    type: Number,
    default: null
  },
  publishAttempts: {
    type: Number,
    default: 0
  },
  lastError: {
    type: String,
    default: null
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    index: true
  }
}, {
  timestamps: false
});

outboxEventSchema.index({ published: 1, createdAt: 1 });

export default mongoose.model<IOutboxEvent>('OutboxEvent', outboxEventSchema);
