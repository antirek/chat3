import mongoose from 'mongoose';

// Function to generate dialogId
function generateDialogId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const dialogSchema = new mongoose.Schema({
  dialogId: {
    type: String,
    required: true, // Обязательное поле
    unique: true,
    trim: true,
    lowercase: true,
    match: /^dlg_[a-z0-9]{20}$/,
    index: true,
    default: generateDialogId
  },
  tenantId: {
    type: String,
    required: true,
    index: true,
    match: /^tnt_[a-z0-9]+$/
  },
  name: {
    type: String,
    trim: true
  },
  createdBy: {
    type: String,
    required: true,
    description: 'ID создателя диалога (строка)'
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
dialogSchema.index({ tenantId: 1 });
dialogSchema.index({ dialogId: 1 }, { unique: true });

// Включить виртуальные поля в JSON/Object
dialogSchema.set('toJSON', { virtuals: true });
dialogSchema.set('toObject', { virtuals: true });

const Dialog = mongoose.model('Dialog', dialogSchema);

export default Dialog;

