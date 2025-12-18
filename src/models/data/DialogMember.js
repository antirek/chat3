import mongoose from 'mongoose';
import { generateTimestamp } from '../../utils/timestampUtils.js';

const dialogMemberSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    description: 'ID пользователя (строка)'
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  dialogId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^dlg_[a-z0-9]{20}$/,
    description: 'ID диалога (строка в формате dlg_XXXXXXXXXXXXXXXXXXXX)'
  },
  unreadCount: {
    type: Number,
    default: 0,
    min: 0,
    required: true,
    description: 'Количество непрочитанных сообщений в диалоге'
  },
  lastSeenAt: {
    type: Number,
    default: generateTimestamp,
    required: true,
    description: 'Timestamp последнего просмотра диалога (микросекунды)'
  },
  lastMessageAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp последнего сообщения в диалоге (микросекунды)'
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp создания (микросекунды)'
  }
}, {
  timestamps: false // Отключаем автоматические timestamps
});

// Pre-save hook для установки createdAt при создании
dialogMemberSchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
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
