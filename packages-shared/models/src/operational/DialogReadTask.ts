import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

// TypeScript типы для DialogReadTask
export type DialogReadTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

// TypeScript интерфейс для документа DialogReadTask
export interface IDialogReadTask extends mongoose.Document {
  tenantId: string;
  dialogId: string;
  userId: string;
  readUntil: number;
  status: DialogReadTaskStatus;
  processedCount: number;
  requestCount: number;
  lastProcessedAt: number | null;
  lastProcessedMessageId: mongoose.Types.ObjectId | null;
  source: string;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

const dialogReadTaskSchema = new mongoose.Schema<IDialogReadTask>({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  dialogId: {
    type: String,
    required: true,
    index: true,
    match: /^dlg_[a-z0-9]{20}$/
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  readUntil: {
    type: Number,
    required: true,
    description: 'Timestamp (microseconds) до которого нужно отметить сообщения как прочитанные'
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  processedCount: {
    type: Number,
    default: 0
  },
  requestCount: {
    type: Number,
    default: 1
  },
  lastProcessedAt: {
    type: Number,
    default: null
  },
  lastProcessedMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  source: {
    type: String,
    default: 'api'
  },
  error: {
    type: String,
    default: null
  },
  createdAt: {
    type: Number,
    default: generateTimestamp
  },
  startedAt: {
    type: Number,
    default: null
  },
  finishedAt: {
    type: Number,
    default: null
  }
}, {
  timestamps: false
});

dialogReadTaskSchema.index({ tenantId: 1, dialogId: 1, userId: 1, status: 1 });

// Pre-save hook для установки createdAt при создании
dialogReadTaskSchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

const DialogReadTask = mongoose.model<IDialogReadTask>('DialogReadTask', dialogReadTaskSchema);

export default DialogReadTask;
