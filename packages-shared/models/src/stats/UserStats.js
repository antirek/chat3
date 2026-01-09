import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
const userStatsSchema = new mongoose.Schema({
    tenantId: {
        type: String,
        required: true,
        index: true,
        description: 'ID тенанта'
    },
    userId: {
        type: String,
        required: true,
        description: 'ID пользователя'
    },
    dialogCount: {
        type: Number,
        default: 0,
        min: 0,
        required: true,
        description: 'Количество диалогов пользователя'
    },
    unreadDialogsCount: {
        type: Number,
        default: 0,
        min: 0,
        required: true,
        description: 'Количество непрочитанных диалогов (где unreadCount > 0)'
    },
    totalUnreadCount: {
        type: Number,
        default: 0,
        min: 0,
        required: true,
        description: 'Общее количество непрочитанных сообщений во всех диалогах'
    },
    totalMessagesCount: {
        type: Number,
        default: 0,
        min: 0,
        required: true,
        description: 'Общее количество сообщений, отправленных пользователем'
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
userStatsSchema.pre('save', function (next) {
    const now = generateTimestamp();
    if (this.isNew) {
        this.createdAt = now;
    }
    this.lastUpdatedAt = now;
    next();
});
// Индексы для производительности
userStatsSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
userStatsSchema.index({ tenantId: 1, unreadDialogsCount: 1 });
userStatsSchema.index({ tenantId: 1, totalUnreadCount: 1 });
userStatsSchema.index({ tenantId: 1, totalMessagesCount: 1 });
// Включить виртуальные поля в JSON/Object
userStatsSchema.set('toJSON', { virtuals: true });
userStatsSchema.set('toObject', { virtuals: true });
const UserStats = mongoose.model('UserStats', userStatsSchema);
export default UserStats;
//# sourceMappingURL=UserStats.js.map