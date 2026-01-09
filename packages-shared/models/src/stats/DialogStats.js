import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
const dialogStatsSchema = new mongoose.Schema({
    tenantId: {
        type: String,
        required: true,
        index: true,
        description: 'ID тенанта'
    },
    dialogId: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: /^dlg_[a-z0-9]{20}$/,
        unique: true,
        description: 'ID диалога (строка в формате dlg_XXXXXXXXXXXXXXXXXXXX)'
    },
    topicCount: {
        type: Number,
        default: 0,
        min: 0,
        required: true,
        description: 'Количество топиков в диалоге'
    },
    memberCount: {
        type: Number,
        default: 0,
        min: 0,
        required: true,
        description: 'Количество участников диалога'
    },
    messageCount: {
        type: Number,
        default: 0,
        min: 0,
        required: true,
        description: 'Количество сообщений в диалоге'
    },
    lastUpdatedAt: {
        type: Number,
        default: generateTimestamp,
        description: 'Timestamp последнего обновления (микросекунды)'
    },
    createdAt: {
        type: Number,
        default: generateTimestamp,
        description: 'Timestamp создания (микросекунды)'
    }
}, {
    timestamps: false // Отключаем автоматические timestamps
});
// Pre-save hook для установки timestamps
dialogStatsSchema.pre('save', function (next) {
    const now = generateTimestamp();
    if (this.isNew) {
        this.createdAt = now;
    }
    this.lastUpdatedAt = now;
    next();
});
// Индексы для производительности
dialogStatsSchema.index({ tenantId: 1, dialogId: 1 }, { unique: true }); // составной уникальный ключ
dialogStatsSchema.index({ tenantId: 1, topicCount: 1 }); // для быстрого поиска по количеству топиков
dialogStatsSchema.index({ tenantId: 1, memberCount: 1 }); // для быстрого поиска по количеству участников
dialogStatsSchema.index({ tenantId: 1, messageCount: 1 }); // для быстрого поиска по количеству сообщений
// Включить виртуальные поля в JSON/Object
dialogStatsSchema.set('toJSON', { virtuals: true });
dialogStatsSchema.set('toObject', { virtuals: true });
const DialogStats = mongoose.model('DialogStats', dialogStatsSchema);
export default DialogStats;
//# sourceMappingURL=DialogStats.js.map