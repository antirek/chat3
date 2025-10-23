import mongoose from 'mongoose';

const messageStatusSchema = new mongoose.Schema({
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true
  },
  userId: {
    type: String,
    required: true,
    description: 'ID пользователя (строка, не ObjectId)'
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  status: {
    type: String,
    enum: ['unread', 'delivered', 'read'],
    default: 'unread',
    required: true
  },
  readAt: {
    type: Date,
    description: 'Время прочтения сообщения'
  },
  deliveredAt: {
    type: Date,
    description: 'Время доставки сообщения'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Индексы для производительности
messageStatusSchema.index({ messageId: 1, userId: 1 }, { unique: true });
messageStatusSchema.index({ tenantId: 1, userId: 1, status: 1 });
messageStatusSchema.index({ messageId: 1, status: 1 });
messageStatusSchema.index({ userId: 1, status: 1 });
messageStatusSchema.index({ tenantId: 1, status: 1 });

// Включить виртуальные поля в JSON/Object
messageStatusSchema.set('toJSON', { virtuals: true });
messageStatusSchema.set('toObject', { virtuals: true });

const MessageStatus = mongoose.model('MessageStatus', messageStatusSchema);

export default MessageStatus;
