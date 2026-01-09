import { Topic, Meta } from '@chat3/models';
import * as metaUtils from './metaUtils.js';
/**
 * Утилиты для работы с топиками
 */
/**
 * Генерирует ID топика
 * @returns topicId в формате topic_xxxxxxxxxxxxx
 */
export function generateTopicId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'topic_';
    for (let i = 0; i < 20; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
/**
 * Получение списка топиков диалога
 * @param tenantId - ID тенанта
 * @param dialogId - ID диалога
 * @param options - Опции (page, limit, sort)
 * @returns Массив топиков
 */
export async function getDialogTopics(tenantId, dialogId, options = {}) {
    try {
        const page = options.page || 1;
        const limit = options.limit || 10;
        const skip = (page - 1) * limit;
        const sort = options.sort || { createdAt: 1 }; // По умолчанию сортировка по createdAt ASC
        const topics = await Topic.find({
            tenantId,
            dialogId
        })
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();
        return topics;
    }
    catch (error) {
        throw new Error(`Failed to get dialog topics: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Создание нового топика
 * @param tenantId - ID тенанта
 * @param dialogId - ID диалога
 * @param options - Опции (meta - объект с мета-тегами)
 * @returns Созданный топик
 */
export async function createTopic(tenantId, dialogId, options = {}) {
    try {
        // Создаем топик
        const topic = await Topic.create({
            tenantId,
            dialogId,
            topicId: generateTopicId()
        });
        // Создаем мета-теги, если они переданы
        if (options.meta && typeof options.meta === 'object') {
            for (const [key, value] of Object.entries(options.meta)) {
                const metaOptions = {
                    createdBy: options.createdBy
                };
                const valueObj = value;
                if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'value')) {
                    // Если value - объект с dataType/value свойствами
                    await metaUtils.setEntityMeta(tenantId, 'topic', topic.topicId, key, valueObj?.value, valueObj?.dataType || 'string', metaOptions);
                }
                else {
                    // Если value - простое значение
                    await metaUtils.setEntityMeta(tenantId, 'topic', topic.topicId, key, value, typeof value === 'number' ? 'number' :
                        typeof value === 'boolean' ? 'boolean' :
                            Array.isArray(value) ? 'array' : 'string', metaOptions);
                }
            }
        }
        return topic;
    }
    catch (error) {
        throw new Error(`Failed to create topic: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Получение топика по ID
 * @param tenantId - ID тенанта
 * @param dialogId - ID диалога
 * @param topicId - ID топика
 * @returns Топик или null, если не найден
 */
export async function getTopicById(tenantId, dialogId, topicId) {
    try {
        const topic = await Topic.findOne({
            tenantId,
            dialogId,
            topicId
        }).lean();
        return topic;
    }
    catch (error) {
        throw new Error(`Failed to get topic by ID: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Обновление топика (мета-теги)
 * @param tenantId - ID тенанта
 * @param dialogId - ID диалога
 * @param topicId - ID топика
 * @param updates - Обновления (meta - объект с мета-тегами)
 * @returns Обновленный топик или null, если не найден
 */
export async function updateTopic(tenantId, dialogId, topicId, updates = {}) {
    try {
        // Проверяем существование топика
        const topic = await getTopicById(tenantId, dialogId, topicId);
        if (!topic) {
            return null;
        }
        // Обновляем мета-теги, если они переданы
        if (updates.meta && typeof updates.meta === 'object') {
            for (const [key, value] of Object.entries(updates.meta)) {
                const metaOptions = {
                    createdBy: updates.createdBy
                };
                const valueObj = value;
                if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'value')) {
                    // Если value - объект с dataType/value свойствами
                    await metaUtils.setEntityMeta(tenantId, 'topic', topicId, key, valueObj?.value, valueObj?.dataType || 'string', metaOptions);
                }
                else {
                    // Если value - простое значение
                    await metaUtils.setEntityMeta(tenantId, 'topic', topicId, key, value, typeof value === 'number' ? 'number' :
                        typeof value === 'boolean' ? 'boolean' :
                            Array.isArray(value) ? 'array' : 'string', metaOptions);
                }
            }
        }
        // Возвращаем обновленный топик
        return await getTopicById(tenantId, dialogId, topicId);
    }
    catch (error) {
        throw new Error(`Failed to update topic: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Получение топика с мета-тегами (для одного топика)
 * @param tenantId - ID тенанта
 * @param dialogId - ID диалога
 * @param topicId - ID топика
 * @returns Объект { topicId, meta: {...} } или null
 */
export async function getTopicWithMeta(tenantId, dialogId, topicId) {
    try {
        if (!topicId) {
            return null;
        }
        const topic = await getTopicById(tenantId, dialogId, topicId);
        if (!topic) {
            return null;
        }
        const topicObj = topic;
        const meta = await metaUtils.getEntityMeta(tenantId, 'topic', topicId);
        return {
            topicId: topicObj.topicId,
            meta: meta || {}
        };
    }
    catch (error) {
        // Обработка ошибок: возвращаем null вместо падения
        console.error(`Error getting topic with meta: ${error instanceof Error ? error.message : String(error)}`, { tenantId, dialogId, topicId });
        return null;
    }
}
/**
 * Получение нескольких топиков с мета-тегами (оптимизация N+1)
 * @param tenantId - ID тенанта
 * @param dialogId - ID диалога
 * @param topicIds - Массив уникальных topicId (может быть пустым)
 * @returns Map<topicId, { topicId, meta: {...} }>
 */
export async function getTopicsWithMetaBatch(tenantId, dialogId, topicIds) {
    try {
        if (!topicIds || topicIds.length === 0) {
            return new Map();
        }
        // Исключаем null и дубликаты
        const uniqueTopicIds = [...new Set(topicIds.filter(id => id !== null && id !== undefined))];
        if (uniqueTopicIds.length === 0) {
            return new Map();
        }
        // Загружаем все топики одним запросом
        const topics = await Topic.find({
            tenantId,
            dialogId,
            topicId: { $in: uniqueTopicIds }
        }).lean();
        // Загружаем все мета-теги одним запросом
        const metaRecords = await Meta.find({
            tenantId,
            entityType: 'topic',
            entityId: { $in: uniqueTopicIds }
        }).lean();
        // Собираем map мета-тегов по entityId
        const metaMap = new Map();
        metaRecords.forEach(record => {
            const entityId = String(record.entityId);
            if (!metaMap.has(entityId)) {
                metaMap.set(entityId, {});
            }
            const metaObj = metaMap.get(entityId);
            metaObj[record.key] = record.value;
        });
        // Собираем map топиков с мета-тегами
        const result = new Map();
        topics.forEach(topic => {
            const topicObj = topic;
            result.set(topicObj.topicId, {
                topicId: topicObj.topicId,
                meta: metaMap.get(topicObj.topicId) || {}
            });
        });
        return result;
    }
    catch (error) {
        // Обработка ошибок: возвращаем пустой Map вместо падения
        console.error(`Error getting topics with meta batch: ${error instanceof Error ? error.message : String(error)}`, { tenantId, dialogId, topicIds });
        return new Map();
    }
}
//# sourceMappingURL=topicUtils.js.map