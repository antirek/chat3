import mongoose from 'mongoose';
import crypto from 'crypto';
import { generateTimestamp } from '../utils/timestampUtils.js';

const eventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: /^evt_[a-z0-9]{32}$/,
    default: function() {
      return 'evt_' + crypto.randomBytes(16).toString('hex');
    }
  },
  tenantId: {
    type: String,
    required: true,
    index: true,
    match: /^tnt_[a-z0-9]+$/
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
      'message.delete',
      'dialog.member.add',
      'dialog.member.remove',
      'dialog.member.update',
      'message.status.create',
      'message.status.update',
      'message.reaction.add',
      'message.reaction.update',
      'message.reaction.remove',
      'tenant.create',
      'tenant.update',
      'tenant.delete'
    ],
    index: true
  },
  entityType: {
    type: String,
    required: true,
    enum: ['dialog', 'message', 'dialogMember', 'messageStatus', 'messageReaction', 'tenant'],
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
  timestamps: { createdAt: true, updatedAt: false }
});

// Составные индексы для частых запросов
eventSchema.index({ tenantId: 1, eventType: 1, createdAt: -1 });
eventSchema.index({ tenantId: 1, entityType: 1, entityId: 1, createdAt: -1 });
eventSchema.index({ tenantId: 1, actorId: 1, createdAt: -1 });

// Виртуальное поле для читаемого описания события
eventSchema.virtual('description').get(function() {
  const typeDescriptions = {
    'dialog.create': 'Создан диалог',
    'dialog.update': 'Обновлен диалог',
    'dialog.delete': 'Удален диалог',
    'message.create': 'Создано сообщение',
    'message.update': 'Обновлено сообщение',
    'message.delete': 'Удалено сообщение',
    'dialog.member.add': 'Добавлен участник диалога',
    'dialog.member.remove': 'Удален участник диалога',
    'dialog.member.update': 'Обновлен участник диалога',
    'message.status.create': 'Создан статус сообщения',
    'message.status.update': 'Обновлен статус сообщения',
    'message.reaction.add': 'Добавлена реакция на сообщение',
    'message.reaction.update': 'Обновлена реакция на сообщение',
    'message.reaction.remove': 'Удалена реакция на сообщение',
    'tenant.create': 'Создан tenant',
    'tenant.update': 'Обновлен tenant',
    'tenant.delete': 'Удален tenant'
  };
  
  return typeDescriptions[this.eventType] || this.eventType;
});

// Включить виртуальные поля в JSON/Object
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

const Event = mongoose.model('Event', eventSchema);

export default Event;

