import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
const userDialogActivitySchema = new mongoose.Schema({
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
    dialogId: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: /^dlg_[a-z0-9]{20}$/,
        description: 'ID диалога (строка в формате dlg_XXXXXXXXXXXXXXXXXXXX)'
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
userDialogActivitySchema.pre('save', function (next) {
    const now = generateTimestamp();
    if (this.isNew) {
        this.createdAt = now;
    }
    this.lastUpdatedAt = now;
    next();
});
// Индексы для производительности
userDialogActivitySchema.index({ tenantId: 1, userId: 1, dialogId: 1 }, { unique: true });
userDialogActivitySchema.index({ tenantId: 1, userId: 1, lastSeenAt: -1 });
userDialogActivitySchema.index({ tenantId: 1, userId: 1, lastMessageAt: -1 });
userDialogActivitySchema.index({ tenantId: 1, dialogId: 1 });
userDialogActivitySchema.index({ tenantId: 1, lastSeenAt: -1 });
userDialogActivitySchema.index({ tenantId: 1, lastMessageAt: -1 });
// Включить виртуальные поля в JSON/Object
userDialogActivitySchema.set('toJSON', { virtuals: true });
userDialogActivitySchema.set('toObject', { virtuals: true });
const UserDialogActivity = mongoose.model('UserDialogActivity', userDialogActivitySchema);
export default UserDialogActivity;
//# sourceMappingURL=UserDialogActivity.js.map