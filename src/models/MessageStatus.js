import mongoose from 'mongoose';
import { generateTimestamp } from '../utils/timestampUtils.js';

const messageStatusSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^msg_[a-z0-9]{20}$/,
    index: true,
    description: 'ID сообщения в формате msg_XXXXXXXXXXXXXXXXXXXX'
  },
  userId: {
    type: String,
    required: true,
    description: 'ID пользователя (строка, не ObjectId)'
  },
  tenantId: {
    type: String,
    required: true,
    index: true,
    match: /^tnt_[a-z0-9]+$/
  },
  status: {
    type: String,
    default: 'sent',
    required: true
  },  
  createdAt: {
    type: Number,
    default: generateTimestamp,
    required: true,
    description: 'Timestamp создания (микросекунды)'
  },
  updatedAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp обновления (микросекунды)'
  }
}, {
  timestamps: false // Отключаем автоматические timestamps
});

// Pre-save hook для обновления updatedAt с микросекундами
messageStatusSchema.pre('save', function(next) {
  this.updatedAt = generateTimestamp();
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

// Индексы для производительности
messageStatusSchema.index({ messageId: 1, userId: 1 }, { unique: true });
messageStatusSchema.index({ tenantId: 1, userId: 1, status: 1 });
messageStatusSchema.index({ messageId: 1, status: 1 });
messageStatusSchema.index({ userId: 1, status: 1 });
messageStatusSchema.index({ tenantId: 1, status: 1 });

// Middleware для обновления счетчиков при изменении статуса
messageStatusSchema.pre('save', async function(next) {
  if (this.isModified('status')) {
    try {
      const { updateCountersOnStatusChange } = await import('../utils/unreadCountUtils.js');
      
      // Получаем старый статус из базы данных
      const oldDoc = await this.constructor.findById(this._id);
      const oldStatus = oldDoc ? oldDoc.status : 'unread';
      
      // Обновляем счетчики
      await updateCountersOnStatusChange(
        this.tenantId,
        this.messageId,
        this.userId,
        oldStatus,
        this.status
      );
    } catch (error) {
      console.error('Error updating counters in pre-save:', error);
      // Не прерываем сохранение из-за ошибки счетчиков
    }
  }
  next();
});

// Включить виртуальные поля в JSON/Object
messageStatusSchema.set('toJSON', { virtuals: true });
messageStatusSchema.set('toObject', { virtuals: true });

const MessageStatus = mongoose.model('MessageStatus', messageStatusSchema);

export default MessageStatus;
