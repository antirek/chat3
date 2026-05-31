import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import type { EventType } from './Event.js';

export type UpdateType = 'update.message' | 'update.dialog' | 'update.user';

export const UPDATE_TYPE_MESSAGE: UpdateType = 'update.message';
export const UPDATE_TYPE_DIALOG: UpdateType = 'update.dialog';
export const UPDATE_TYPE_USER: UpdateType = 'update.user';

export const UPDATE_TYPE_ENUM: UpdateType[] = [
  UPDATE_TYPE_MESSAGE,
  UPDATE_TYPE_DIALOG,
  UPDATE_TYPE_USER
];

// TypeScript интерфейс для документа Update
export interface IUpdate extends mongoose.Document {
  tenantId: string;
  userId: string;
  entityId: string;
  eventId: string;
  sourceEventType: EventType | string;
  updateType: UpdateType;
  data: unknown;
  published: boolean;
  publishedAt?: number;
  createdAt: number;
}

const updateSchema = new mongoose.Schema<IUpdate>({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    description: 'ID пользователя-получателя update',
    index: true
  },
  entityId: {
    type: String,
    required: true,
    description: 'ID сущности (dlg_* для dialog, msg_* для message, userId для user)',
    index: true
  },
  eventId: {
    type: String,
    required: true,
    description: 'ID исходного события (строка evt_...)',
    index: true
  },
  sourceEventType: {
    type: String,
    required: true,
    description: 'Тип доменного Event (Event.eventType для eventId)'
  },
  updateType: {
    type: String,
    required: true,
    enum: UPDATE_TYPE_ENUM,
    description: 'Тип Update (update.message | update.dialog | update.user)'
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    description: 'Payload для клиента (sections + context v4)'
  },
  published: {
    type: Boolean,
    default: false,
    description: 'Отправлен ли update в RabbitMQ',
    index: true
  },
  publishedAt: {
    type: Number,
    description: 'Timestamp публикации в RabbitMQ (микросекунды)'
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    index: true,
    description: 'Timestamp создания (микросекунды)'
  }
}, {
  timestamps: false
});

updateSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
updateSchema.index({ tenantId: 1, userId: 1, updateType: 1, createdAt: -1 });
updateSchema.index({ tenantId: 1, eventId: 1 });
updateSchema.index({ tenantId: 1, published: 1, createdAt: -1 });
updateSchema.index(
  { tenantId: 1, eventId: 1, userId: 1, updateType: 1, entityId: 1 },
  { unique: true }
);

const Update = mongoose.model<IUpdate>('Update', updateSchema);

export default Update;
