import mongoose from 'mongoose';
import { generateTimestamp } from '../../utils/timestampUtils.js';

const updateSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    description: 'ID пользователя-получателя update',
    index: true
  },
  dialogId: {
    type: String,
    required: false, // Опционально для UserUpdate (события user.*)
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        // Валидация применяется только если значение не null/undefined
        return !v || /^dlg_[a-z0-9]{20}$/.test(v);
      },
      message: 'dialogId must be in format dlg_XXXXXXXXXXXXXXXXXXXX or null'
    },
    description: 'ID диалога (строка в формате dlg_XXXXXXXXXXXXXXXXXXXX). Опционально для событий user.*',
    index: true
  },
  entityId: {
    type: String,
    required: true,
    description: 'ID сущности (dlg_* для dialog, msg_* для message)',
    index: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    description: 'ID исходного события',
    index: true
  },
  eventType: {
    type: String,
    required: true,
    description: 'Тип исходного события'
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    description: 'Полные данные объекта (Dialog или Message) для пользователя'
  },
  published: {
    type: Boolean,
    default: false,
    description: 'Отправлен ли update в RabbitMQ',
    index: true
  },
  publishedAt: {
    type: Number,
    description: 'Timestamp публикации в RabbitMQ (микросекунды)'
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    index: true,
    description: 'Timestamp создания (микросекунды)'
  }
}, {
  timestamps: false // Отключаем автоматические timestamps, используем только createdAt
});

// Составные индексы для частых запросов
updateSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
updateSchema.index({ tenantId: 1, userId: 1, eventType: 1, createdAt: -1 });
updateSchema.index({ tenantId: 1, dialogId: 1, createdAt: -1 });
updateSchema.index({ tenantId: 1, eventId: 1 });
updateSchema.index({ tenantId: 1, published: 1, createdAt: -1 });

const Update = mongoose.model('Update', updateSchema);

export default Update;




