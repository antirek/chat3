import { Topic, Meta } from '../models/index.js';
import * as metaUtils from '../apps/tenant-api/utils/metaUtils.js';

/**
 * Утилиты для работы с топиками
 */

/**
 * Генерирует ID топика
 * @returns {string} topicId в формате topic_xxxxxxxxxxxxx
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
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {Object} options - Опции (page, limit, sort)
 * @returns {Promise<Array>} Массив топиков
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
  } catch (error) {
    throw new Error(`Failed to get dialog topics: ${error.message}`);
  }
}

/**
 * Создание нового топика
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {Object} options - Опции (meta - объект с мета-тегами)
 * @returns {Promise<Object>} Созданный топик
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

        if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'value')) {
          // Если value - объект с dataType/value свойствами
          await metaUtils.setEntityMeta(
            tenantId,
            'topic',
            topic.topicId,
            key,
            value.value,
            value.dataType || 'string',
            metaOptions
          );
        } else {
          // Если value - простое значение
          await metaUtils.setEntityMeta(
            tenantId,
            'topic',
            topic.topicId,
            key,
            value,
            typeof value === 'number' ? 'number' :
            typeof value === 'boolean' ? 'boolean' :
            Array.isArray(value) ? 'array' : 'string',
            metaOptions
          );
        }
      }
    }

    return topic;
  } catch (error) {
    throw new Error(`Failed to create topic: ${error.message}`);
  }
}

/**
 * Получение топика по ID
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {string} topicId - ID топика
 * @returns {Promise<Object|null>} Топик или null, если не найден
 */
export async function getTopicById(tenantId, dialogId, topicId) {
  try {
    const topic = await Topic.findOne({
      tenantId,
      dialogId,
      topicId
    }).lean();

    return topic;
  } catch (error) {
    throw new Error(`Failed to get topic by ID: ${error.message}`);
  }
}

/**
 * Обновление топика (мета-теги)
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {string} topicId - ID топика
 * @param {Object} updates - Обновления (meta - объект с мета-тегами)
 * @returns {Promise<Object|null>} Обновленный топик или null, если не найден
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

        if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'value')) {
          // Если value - объект с dataType/value свойствами
          await metaUtils.setEntityMeta(
            tenantId,
            'topic',
            topicId,
            key,
            value.value,
            value.dataType || 'string',
            metaOptions
          );
        } else {
          // Если value - простое значение
          await metaUtils.setEntityMeta(
            tenantId,
            'topic',
            topicId,
            key,
            value,
            typeof value === 'number' ? 'number' :
            typeof value === 'boolean' ? 'boolean' :
            Array.isArray(value) ? 'array' : 'string',
            metaOptions
          );
        }
      }
    }

    // Возвращаем обновленный топик
    return await getTopicById(tenantId, dialogId, topicId);
  } catch (error) {
    throw new Error(`Failed to update topic: ${error.message}`);
  }
}

/**
 * Получение топика с мета-тегами (для одного топика)
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {string} topicId - ID топика
 * @returns {Promise<Object|null>} Объект { topicId, meta: {...} } или null
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

    const meta = await metaUtils.getEntityMeta(tenantId, 'topic', topicId);

    return {
      topicId: topic.topicId,
      meta: meta || {}
    };
  } catch (error) {
    // Обработка ошибок: возвращаем null вместо падения
    console.error(`Error getting topic with meta: ${error.message}`, { tenantId, dialogId, topicId });
    return null;
  }
}

/**
 * Получение нескольких топиков с мета-тегами (оптимизация N+1)
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {Array<string>} topicIds - Массив уникальных topicId (может быть пустым)
 * @returns {Promise<Map>} Map<topicId, { topicId, meta: {...} }>
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
      if (!metaMap.has(record.entityId)) {
        metaMap.set(record.entityId, {});
      }
      metaMap.get(record.entityId)[record.key] = record.value;
    });

    // Собираем map топиков с мета-тегами
    const result = new Map();
    topics.forEach(topic => {
      result.set(topic.topicId, {
        topicId: topic.topicId,
        meta: metaMap.get(topic.topicId) || {}
      });
    });

    return result;
  } catch (error) {
    // Обработка ошибок: возвращаем пустой Map вместо падения
    console.error(`Error getting topics with meta batch: ${error.message}`, { tenantId, dialogId, topicIds });
    return new Map();
  }
}
