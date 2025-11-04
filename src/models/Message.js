import mongoose from 'mongoose';

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
    required: false, // Генерируется автоматически
    unique: true,
    trim: true,
    lowercase: true,
    match: /^msg_[a-z0-9]{20}$/,
    index: true,
    default: generateMessageId
  },
  tenantId: {
    type: String,
    required: true,
    index: true,
    match: /^tnt_[a-z0-9]+$/
  },
  dialogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dialog',
    required: true
  },
  senderId: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'text'
  },
  reactionCounts: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    description: 'Агрегированные счетчики реакций: { "👍": 5, "❤️": 3 }'
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

// Indexes
messageSchema.index({ messageId: 1 }, { unique: true });

// Compound index for getDialogMessages() - получение сообщений конкретного диалога с сортировкой
messageSchema.index({ tenantId: 1, dialogId: 1, createdAt: -1 });

// Index for getAll() - глобальный поиск сообщений по tenant с сортировкой
messageSchema.index({ tenantId: 1, createdAt: -1 });

// Index for filtering by sender
messageSchema.index({ senderId: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;

