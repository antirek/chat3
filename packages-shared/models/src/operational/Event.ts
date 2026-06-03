import mongoose from 'mongoose';
import * as crypto from 'crypto';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

// TypeScript типы для Event (доменные события, без *.update)
export type EventType =
  | 'dialog.create'
  | 'dialog.changed'
  | 'dialog.delete'
  | 'message.create'
  | 'message.changed'
  | 'dialog.member.add'
  | 'dialog.member.remove'
  | 'dialog.member.changed'
  | 'message.status.changed'
  | 'message.reaction.changed'
  | 'dialog.typing'
  | 'dialog.topic.create'
  | 'dialog.topic.changed'
  | 'dialog.messages.bulk_read'
  | 'user.add'
  | 'user.changed'
  | 'user.remove'
  | 'pack.create'
  | 'pack.changed'
  | 'pack.delete'
  | 'pack.dialog.add'
  | 'pack.dialog.remove';

export type EntityType =
  | 'dialog'
  | 'message'
  | 'dialogMember'
  | 'messageStatus'
  | 'messageReaction'
  | 'topic'
  | 'tenant'
  | 'user'
  | 'pack'
  | 'packStats'
  | 'userPackStats';

export type ActorType = 'user' | 'system' | 'bot' | 'api';

export interface IEvent extends mongoose.Document {
  eventId: string;
  tenantId: string;
  eventType: EventType;
  entityType: EntityType;
  entityId: string;
  actorId?: string;
  actorType: ActorType;
  data?: unknown;
  createdAt: number;
  description?: string;
}

function generateEventId(): string {
  return 'evt_' + crypto.randomBytes(16).toString('hex');
}

const EVENT_TYPE_ENUM: EventType[] = [
  'dialog.create',
  'dialog.changed',
  'dialog.delete',
  'message.create',
  'message.changed',
  'dialog.member.add',
  'dialog.member.remove',
  'dialog.member.changed',
  'message.status.changed',
  'message.reaction.changed',
  'dialog.typing',
  'dialog.topic.create',
  'dialog.topic.changed',
  'dialog.messages.bulk_read',
  'user.add',
  'user.changed',
  'user.remove',
  'pack.create',
  'pack.changed',
  'pack.delete',
  'pack.dialog.add',
  'pack.dialog.remove'
];

const eventSchema = new mongoose.Schema<IEvent>({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: /^evt_[a-z0-9]{32}$/,
    default: generateEventId
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    enum: EVENT_TYPE_ENUM,
    index: true
  },
  entityType: {
    type: String,
    required: true,
    enum: ['dialog', 'message', 'dialogMember', 'messageStatus', 'messageReaction', 'topic', 'tenant', 'user', 'pack', 'packStats', 'userPackStats'],
    index: true
  },
  entityId: {
    type: String,
    required: true,
    index: true
  },
  actorId: {
    type: String
  },
  actorType: {
    type: String,
    enum: ['user', 'system', 'bot', 'api'],
    default: 'user'
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    index: true
  }
}, {
  timestamps: false
});

eventSchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

eventSchema.index({ tenantId: 1, eventType: 1, createdAt: -1 });
eventSchema.index({ tenantId: 1, entityType: 1, entityId: 1, createdAt: -1 });
eventSchema.index({ tenantId: 1, actorId: 1, createdAt: -1 });

eventSchema.virtual('description').get(function() {
  const typeDescriptions: Record<EventType, string> = {
    'dialog.create': 'Создан диалог',
    'dialog.changed': 'Обновлен диалог',
    'dialog.delete': 'Удален диалог',
    'message.create': 'Создано сообщение',
    'message.changed': 'Обновлено сообщение',
    'dialog.member.add': 'Добавлен участник диалога',
    'dialog.member.remove': 'Удален участник диалога',
    'dialog.member.changed': 'Обновлен участник диалога',
    'message.status.changed': 'Изменен статус сообщения',
    'message.reaction.changed': 'Изменена реакция на сообщение',
    'dialog.typing': 'Пользователь печатает в диалоге',
    'dialog.topic.create': 'Создан топик диалога',
    'dialog.topic.changed': 'Обновлен топик диалога',
    'dialog.messages.bulk_read': 'Массовое прочтение сообщений диалога',
    'user.add': 'Добавлен пользователь',
    'user.changed': 'Обновлен пользователь',
    'user.remove': 'Удален пользователь',
    'pack.create': 'Создан пак',
    'pack.changed': 'Обновлен пак (meta)',
    'pack.delete': 'Удален пак',
    'pack.dialog.add': 'Диалог добавлен в пак',
    'pack.dialog.remove': 'Диалог удален из пака'
  };

  return typeDescriptions[this.eventType as EventType] || this.eventType;
});

eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

const Event = mongoose.model<IEvent>('Event', eventSchema);

export default Event;
