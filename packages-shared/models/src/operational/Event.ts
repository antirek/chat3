import mongoose from 'mongoose';
import crypto from 'crypto';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

// TypeScript типы для Event
export type EventType = 
  | 'dialog.create'
  | 'dialog.update'
  | 'dialog.delete'
  | 'message.create'
  | 'message.update'
  | 'dialog.member.add'
  | 'dialog.member.remove'
  | 'dialog.member.update'
  | 'message.status.update'
  | 'message.reaction.update'
  | 'dialog.typing'
  | 'dialog.topic.create'
  | 'dialog.topic.update'
  | 'user.add'
  | 'user.update'
  | 'user.remove';

export type EntityType = 
  | 'dialog'
  | 'message'
  | 'dialogMember'
  | 'messageStatus'
  | 'messageReaction'
  | 'topic'
  | 'tenant'
  | 'user';

export type ActorType = 'user' | 'system' | 'bot' | 'api';

// TypeScript интерфейс для документа Event
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
  description?: string; // Виртуальное поле
}

function generateEventId(): string {
  return 'evt_' + crypto.randomBytes(16).toString('hex');
}

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
    index: true,
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'dialog.create',
      'dialog.update',
      'dialog.delete',
      'message.create',
      'message.update',
      'dialog.member.add',
      'dialog.member.remove',
      'dialog.member.update',
      'message.status.update',
      'message.reaction.update',
      'dialog.typing',
      'dialog.topic.create',
      'dialog.topic.update',
      'user.add',
      'user.update',
      'user.remove'
    ],
    index: true
  },
  entityType: {
    type: String,
    required: true,
    enum: ['dialog', 'message', 'dialogMember', 'messageStatus', 'messageReaction', 'topic', 'tenant', 'user'],
    index: true
  },
  entityId: {
    type: String,
    required: true,
    index: true,
    description: 'ID сущности с префиксом (dlg_*, msg_*, tnt_*, или составной для dialogMember)'
  },
  actorId: {
    type: String,
    description: 'ID пользователя, который инициировал событие'
  },
  actorType: {
    type: String,
    enum: ['user', 'system', 'bot', 'api'],
    default: 'user'
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    description: 'Дополнительные данные события (что изменилось, старые/новые значения и т.д.)'
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    index: true,
    description: 'Timestamp создания события (микросекунды)'
  }
}, {
  timestamps: false // Отключаем автоматические timestamps
});

// Pre-save hook для установки createdAt с микросекундами
eventSchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

// Составные индексы для частых запросов
eventSchema.index({ tenantId: 1, eventType: 1, createdAt: -1 });
eventSchema.index({ tenantId: 1, entityType: 1, entityId: 1, createdAt: -1 });
eventSchema.index({ tenantId: 1, actorId: 1, createdAt: -1 });

// Виртуальное поле для читаемого описания события
eventSchema.virtual('description').get(function() {
  const typeDescriptions: Record<EventType, string> = {
    'dialog.create': 'Создан диалог',
    'dialog.update': 'Обновлен диалог',
    'dialog.delete': 'Удален диалог',
    'message.create': 'Создано сообщение',
    'message.update': 'Обновлено сообщение',
    'dialog.member.add': 'Добавлен участник диалога',
    'dialog.member.remove': 'Удален участник диалога',
    'dialog.member.update': 'Обновлен участник диалога',
    'message.status.update': 'Обновлен статус сообщения',
    'message.reaction.update': 'Обновлена реакция на сообщение',
    'dialog.typing': 'Пользователь печатает в диалоге',
    'dialog.topic.create': 'Создан топик диалога',
    'dialog.topic.update': 'Обновлен топик диалога',
    'user.add': 'Добавлен пользователь',
    'user.update': 'Обновлен пользователь',
    'user.remove': 'Удален пользователь'
  };
  
  return typeDescriptions[this.eventType] || this.eventType;
});

// Включить виртуальные поля в JSON/Object
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

const Event = mongoose.model<IEvent>('Event', eventSchema);

export default Event;
