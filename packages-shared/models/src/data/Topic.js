import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
// Function to generate topicId
function generateTopicId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'topic_';
    for (let i = 0; i < 20; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
const topicSchema = new mongoose.Schema({
    topicId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: /^topic_[a-z0-9]{20}$/,
        default: generateTopicId
    },
    dialogId: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: /^dlg_[a-z0-9]{20}$/,
        description: 'ID диалога (строка в формате dlg_XXXXXXXXXXXXXXXXXXXX)'
    },
    tenantId: {
        type: String,
        required: true
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
topicSchema.pre('save', function (next) {
    if (this.isNew) {
        this.createdAt = generateTimestamp();
    }
    next();
});
// Indexes
topicSchema.index({ tenantId: 1, dialogId: 1 }); // для получения всех топиков диалога
topicSchema.index({ tenantId: 1, dialogId: 1, topicId: 1 }, { unique: true }); // уникальность в рамках диалога
// Индекс на topicId создается автоматически через unique: true в схеме поля
// Включить виртуальные поля в JSON/Object
topicSchema.set('toJSON', { virtuals: true });
topicSchema.set('toObject', { virtuals: true });
const Topic = mongoose.model('Topic', topicSchema);
export default Topic;
//# sourceMappingURL=Topic.js.map