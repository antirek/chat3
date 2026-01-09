import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

// Function to generate dialogId
function generateDialogId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// TypeScript интерфейс для документа Dialog
export interface IDialog extends mongoose.Document {
  dialogId: string;
  tenantId: string;
  createdAt: number;
}

const dialogSchema = new mongoose.Schema<IDialog>({
  dialogId: {
    type: String,
    required: true, // Обязательное поле
    unique: true,
    trim: true,
    lowercase: true,
    match: /^dlg_[a-z0-9]{20}$/,
    default: generateDialogId
  },
  tenantId: {
    type: String,
    required: true, 
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
dialogSchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAt = generateTimestamp();
  }
  next();
});

// Indexes
dialogSchema.index({ tenantId: 1 });
// dialogId index is created automatically by unique: true in schema

// Включить виртуальные поля в JSON/Object
dialogSchema.set('toJSON', { virtuals: true });
dialogSchema.set('toObject', { virtuals: true });

const Dialog = mongoose.model<IDialog>('Dialog', dialogSchema);

export default Dialog;
