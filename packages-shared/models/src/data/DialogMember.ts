import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

// TypeScript интерфейс для документа DialogMember
export interface IDialogMember extends mongoose.Document {
  userId: string;
  tenantId: string;
  dialogId: string;
  createdAt: number;
}

const dialogMemberSchema = new mongoose.Schema<IDialogMember>({
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

// Включить виртуальные поля в JSON/Object
dialogMemberSchema.set('toJSON', { virtuals: true });
dialogMemberSchema.set('toObject', { virtuals: true });

const DialogMember = mongoose.model<IDialogMember>('DialogMember', dialogMemberSchema);

export default DialogMember;
