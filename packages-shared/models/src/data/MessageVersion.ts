import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

/**
 * MessageVersion — архив предыдущего content сообщения.
 * Создаётся только при успешной правке (не при create).
 * Актуальный текст всегда в Message.content; здесь — снимок до правки.
 */
export interface IMessageVersion extends mongoose.Document {
  messageId: string;
  tenantId: string;
  versionIndex: number;
  content: string;
  editedBy: string | null;
  createdAt: number;
}

const messageVersionSchema = new mongoose.Schema<IMessageVersion>({
  messageId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^msg_[a-z0-9]{20}$/,
    description: 'ID сообщения'
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  versionIndex: {
    type: Number,
    required: true,
    min: 1,
    description: 'Монотонный индекс версии (1 = первая архивная)'
  },
  content: {
    type: String,
    required: true,
    default: '',
    description: 'Снимок content до правки'
  },
  editedBy: {
    type: String,
    required: false,
    default: null,
    description: 'Кто выполнил правку, после которой этот content ушёл в архив'
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Момент снимка (успешной правки)'
  }
}, {
  timestamps: false
});

messageVersionSchema.index(
  { tenantId: 1, messageId: 1, versionIndex: -1 },
  { unique: true }
);
messageVersionSchema.index({ tenantId: 1, messageId: 1, createdAt: -1 });

messageVersionSchema.set('toJSON', { virtuals: true });
messageVersionSchema.set('toObject', { virtuals: true });

const MessageVersion = mongoose.model<IMessageVersion>('MessageVersion', messageVersionSchema);

export default MessageVersion;
