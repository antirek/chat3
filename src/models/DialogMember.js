import mongoose from 'mongoose';

const dialogMemberSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    description: 'ID пользователя (строка)'
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  dialogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dialog',
    required: true,
    description: 'ID диалога'
  },
  unreadCount: {
    type: Number,
    default: 0,
    min: 0,
    required: true,
    description: 'Количество непрочитанных сообщений в диалоге'
  },
  lastSeenAt: {
    type: Date,
    default: Date.now,
    required: true,
    description: 'Время последнего просмотра диалога пользователем'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
    description: 'Время последнего сообщения в диалоге'
  },
  isActive: {
    type: Boolean,
    default: true,
    description: 'Активен ли участник в диалоге'
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
dialogMemberSchema.index({ userId: 1, tenantId: 1, dialogId: 1 }, { unique: true });
dialogMemberSchema.index({ dialogId: 1, tenantId: 1 });
dialogMemberSchema.index({ userId: 1, tenantId: 1 });
dialogMemberSchema.index({ tenantId: 1, unreadCount: 1 });
dialogMemberSchema.index({ lastSeenAt: 1 });
dialogMemberSchema.index({ lastMessageAt: 1 });

// Включить виртуальные поля в JSON/Object
dialogMemberSchema.set('toJSON', { virtuals: true });
dialogMemberSchema.set('toObject', { virtuals: true });

const DialogMember = mongoose.model('DialogMember', dialogMemberSchema);

export default DialogMember;
