import mongoose from 'mongoose';
import { generateTimestamp } from '../../utils/timestampUtils.js';

// Function to generate messageId
function generateMessageId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'msg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const messageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true, // Обязательное поле
    unique: true,
    trim: true,
    lowercase: true,
    match: /^msg_[a-z0-9]{20}$/,
    default: generateMessageId
  },
  tenantId: {
    type: String,
    required: true
  },
  dialogId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^dlg_[a-z0-9]{20}$/,
    description: 'ID диалога (строка в формате dlg_XXXXXXXXXXXXXXXXXXXX)'
  },
  senderId: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: function() {
      return this.type === 'internal.text';
    },
    default: ''
  },
  type: {
    type: String,
    default: 'internal.text'
  },
  reactionCounts: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    description: 'Агрегированные счетчики реакций: { "👍": 5, "❤️": 3 }'
  },
  quotedMessage: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    description: 'Цитируемое сообщение с мета-тегами'
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp в миллисекундах с точностью до микросекунд'
  }
}, {
  timestamps: false // Отключаем автоматические timestamps
});

// Pre-save hook для установки createdAt при создании
messageSchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

// Indexes
// messageId index is created automatically by unique: true in schema

// Compound index for getDialogMessages() - получение сообщений конкретного диалога с сортировкой
messageSchema.index({ tenantId: 1, dialogId: 1, createdAt: -1 });

// Index for getAll() - глобальный поиск сообщений по tenant с сортировкой
messageSchema.index({ tenantId: 1, createdAt: -1 });

// Index for filtering by sender
messageSchema.index({ senderId: 1 });

// Включить все поля в JSON/Object
messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

const Message = mongoose.model('Message', messageSchema);

export default Message;

