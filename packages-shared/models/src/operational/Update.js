import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

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
  entityId: {
    type: String,
    required: true,
    description: 'ID сущности (dlg_* для dialog, msg_* для message)',
    index: true
  },
  eventId: {
    type: String,
    required: true,
    description: 'ID исходного события (строка evt_...)',
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
updateSchema.index({ tenantId: 1, eventId: 1 });
updateSchema.index({ tenantId: 1, published: 1, createdAt: -1 });

const Update = mongoose.model('Update', updateSchema);

export default Update;




