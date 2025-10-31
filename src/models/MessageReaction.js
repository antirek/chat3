import mongoose from 'mongoose';

const messageReactionSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    description: 'ID пользователя, который поставил реакцию'
  },
  reaction: {
    type: String,
    required: true,
    description: 'Тип реакции: эмодзи (👍, ❤️, 😂) или текст (custom:text)'
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

// Составной уникальный индекс: один пользователь может иметь только одну реакцию на сообщение
messageReactionSchema.index({ tenantId: 1, messageId: 1, userId: 1 }, { unique: true });

// Индекс для подсчета реакций по типу
messageReactionSchema.index({ tenantId: 1, messageId: 1, reaction: 1 });

// Индекс для сортировки по времени
messageReactionSchema.index({ tenantId: 1, messageId: 1, createdAt: -1 });

// Индекс для получения всех реакций пользователя
messageReactionSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

const MessageReaction = mongoose.model('MessageReaction', messageReactionSchema);

export default MessageReaction;

