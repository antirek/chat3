import mongoose from 'mongoose';

const updateSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true,
    match: /^tnt_[a-z0-9]+$/
  },
  userId: {
    type: String,
    required: true,
    description: 'ID пользователя-получателя update',
    index: true
  },
  dialogId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^dlg_[a-z0-9]{20}$/,
    description: 'ID диалога (строка в формате dlg_XXXXXXXXXXXXXXXXXXXX)',
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
    type: Date,
    description: 'Время публикации в RabbitMQ'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Составные индексы для частых запросов
updateSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
updateSchema.index({ tenantId: 1, userId: 1, eventType: 1, createdAt: -1 });
updateSchema.index({ tenantId: 1, dialogId: 1, createdAt: -1 });
updateSchema.index({ tenantId: 1, eventId: 1 });
updateSchema.index({ tenantId: 1, published: 1, createdAt: -1 });

const Update = mongoose.model('Update', updateSchema);

export default Update;




