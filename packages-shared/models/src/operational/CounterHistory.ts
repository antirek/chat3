import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

// TypeScript типы для CounterHistory
export type CounterType = 
  | 'userDialogStats.unreadCount'
  | 'messageReactionStats.count'
  | 'messageStatusStats.count'
  | 'userStats.dialogCount'
  | 'userStats.unreadDialogsCount'
  | 'userStats.totalUnreadCount'
  | 'userStats.totalMessagesCount';

export type CounterEntityType = 
  | 'dialogMember'
  | 'message'
  | 'user'
  | 'userDialogStats'
  | 'messageReactionStats'
  | 'messageStatusStats';

export type CounterOperation = 'increment' | 'decrement' | 'set' | 'reset' | 'computed';

export type CounterActorType = 'user' | 'bot' | 'api' | 'system';

// TypeScript интерфейс для документа CounterHistory
export interface ICounterHistory extends mongoose.Document {
  tenantId: string;
  counterType: CounterType;
  entityType: CounterEntityType;
  entityId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  delta?: number;
  operation: CounterOperation;
  sourceOperation: string;
  sourceEntityId?: string;
  actorId?: string;
  actorType: CounterActorType;
  createdAt: number;
}

const counterHistorySchema = new mongoose.Schema<ICounterHistory>({
  tenantId: {
    type: String,
    required: true,
    index: true,
    description: 'ID тенанта'
  },
  counterType: {
    type: String,
    required: true,
    enum: [
      'userDialogStats.unreadCount',
      'messageReactionStats.count',
      'messageStatusStats.count',
      'userStats.dialogCount',
      'userStats.unreadDialogsCount',
      'userStats.totalUnreadCount',
      'userStats.totalMessagesCount'
    ],
    index: true,
    description: 'Тип счетчика'
  },
  entityType: {
    type: String,
    required: true,
    enum: ['dialogMember', 'message', 'user', 'userDialogStats', 'messageReactionStats', 'messageStatusStats'],
    index: true,
    description: 'Тип сущности'
  },
  entityId: {
    type: String,
    required: true,
    index: true,
    description: 'ID сущности (dialogId:userId для dialogMember, messageId для message, userId для user)'
  },
  field: {
    type: String,
    required: true,
    description: 'Поле счетчика: unreadCount, reactionCounts, dialogCount, etc.'
  },
  oldValue: {
    type: mongoose.Schema.Types.Mixed,
    description: 'Старое значение (может быть число, объект, null)'
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
    description: 'Новое значение'
  },
  delta: {
    type: Number,
    description: 'Изменение (для числовых счетчиков)'
  },
  operation: {
    type: String,
    required: true,
    enum: ['increment', 'decrement', 'set', 'reset', 'computed'],
    description: 'Операция: increment, decrement, set, reset, computed'
  },
  sourceOperation: {
    type: String,
    required: true,
    description: 'Исходная операция: message.create, message.status.update, dialog.member.add, etc.'
  },
  sourceEntityId: {
    type: String,
    description: 'ID сущности, которая вызвала изменение (messageId, dialogId, etc.)'
  },
  actorId: {
    type: String,
    description: 'ID пользователя, который выполнил операцию'
  },
  actorType: {
    type: String,
    enum: ['user', 'bot', 'api', 'system'],
    default: 'user',
    description: 'Тип актора'
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp изменения (микросекунды)'
  }
}, {
  timestamps: false // Отключаем автоматические timestamps
});

// Pre-save hook для установки createdAt
counterHistorySchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

// Индексы для производительности
counterHistorySchema.index({ tenantId: 1, counterType: 1, entityId: 1, createdAt: -1 });
counterHistorySchema.index({ tenantId: 1, entityType: 1, entityId: 1, createdAt: -1 });
counterHistorySchema.index({ tenantId: 1, sourceOperation: 1, createdAt: -1 });
counterHistorySchema.index({ tenantId: 1, actorId: 1, createdAt: -1 });

// TTL индекс для автоматического удаления старых записей (90 дней)
// MongoDB автоматически удалит записи старше 90 дней
counterHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Включить виртуальные поля в JSON/Object
counterHistorySchema.set('toJSON', { virtuals: true });
counterHistorySchema.set('toObject', { virtuals: true });

const CounterHistory = mongoose.model<ICounterHistory>('CounterHistory', counterHistorySchema);

export default CounterHistory;
