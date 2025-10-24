import { Meta } from '../models/index.js';

/**
 * Утилиты для работы с метаданными
 */

// Получить все метаданные для сущности в виде объекта {key: value}
export async function getEntityMeta(tenantId, entityType, entityId) {
  try {
    const metaRecords = await Meta.find({
      tenantId,
      entityType,
      entityId
    }).lean();

    // Преобразуем в объект { key: value }
    const metaObject = {};
    metaRecords.forEach(record => {
      metaObject[record.key] = record.value;
    });

    return metaObject;
  } catch (error) {
    throw new Error(`Failed to get entity meta: ${error.message}`);
  }
}

// Получить все метаданные для сущности в виде массива с полной информацией
export async function getEntityMetaFull(tenantId, entityType, entityId) {
  try {
    const metaRecords = await Meta.find({
      tenantId,
      entityType,
      entityId
    })
      .select('-__v')
      .lean();

    return metaRecords;
  } catch (error) {
    throw new Error(`Failed to get entity meta full: ${error.message}`);
  }
}

// Установить или обновить метаданные
export async function setEntityMeta(tenantId, entityType, entityId, key, value, dataType = 'string', options = {}) {
  try {
    const meta = await Meta.findOneAndUpdate(
      {
        tenantId,
        entityType,
        entityId,
        key
      },
      {
        value,
        dataType,
        createdBy: options.createdBy,
        updatedAt: new Date()
      },
      {
        upsert: true,
        new: true
      }
    );

    return meta;
  } catch (error) {
    throw new Error(`Failed to set entity meta: ${error.message}`);
  }
}

// Удалить метаданные
export async function deleteEntityMeta(tenantId, entityType, entityId, key) {
  try {
    const result = await Meta.deleteOne({
      tenantId,
      entityType,
      entityId,
      key
    });

    return result.deletedCount > 0;
  } catch (error) {
    throw new Error(`Failed to delete entity meta: ${error.message}`);
  }
}

// Получить конкретное значение метаданных
export async function getEntityMetaValue(tenantId, entityType, entityId, key, defaultValue = null) {
  try {
    const meta = await Meta.findOne({
      tenantId,
      entityType,
      entityId,
      key
    }).lean();

    return meta ? meta.value : defaultValue;
  } catch (error) {
    throw new Error(`Failed to get entity meta value: ${error.message}`);
  }
}

// Построить MongoDB query для фильтрации по метаданным
export async function buildMetaQuery(tenantId, entityType, metaFilters) {
  try {
    if (!metaFilters || Object.keys(metaFilters).length === 0) {
      return null;
    }

    // Находим все entityId, которые соответствуют мета-фильтрам
    const metaQuery = {
      tenantId,
      entityType
    };

    // Добавляем условия для каждого мета-фильтра
    for (const [key, value] of Object.entries(metaFilters)) {
      metaQuery.key = key;
      metaQuery.value = value;
    }

    const metaRecords = await Meta.find(metaQuery).select('entityId').lean();
    
    if (metaRecords.length === 0) {
      // Если нет записей, соответствующих мета-фильтрам, возвращаем условие, которое никогда не выполнится
      return { _id: { $in: [] } };
    }

    const entityIds = metaRecords.map(record => record.entityId);
    return { _id: { $in: entityIds } };
  } catch (error) {
    throw new Error(`Failed to build meta query: ${error.message}`);
  }
}

