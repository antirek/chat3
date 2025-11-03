import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
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
// Compound index for getDialogMessages() - получение сообщений конкретного диалога с сортировкой
messageSchema.index({ tenantId: 1, dialogId: 1, createdAt: -1 });

// Index for getAll() - глобальный поиск сообщений по tenant с сортировкой
messageSchema.index({ tenantId: 1, createdAt: -1 });

// Index for filtering by sender
messageSchema.index({ senderId: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;

