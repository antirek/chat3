import { Meta } from '../models/index.js';
import { generateTimestamp } from './timestampUtils.js';

export function normalizeScope(rawScope) {
  if (typeof rawScope !== 'string') {
    return null;
  }
  const trimmed = rawScope.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getScopeDetails(options = {}) {
  const provided = Object.prototype.hasOwnProperty.call(options, 'scope');
  const value = provided ? normalizeScope(options.scope) : null;
  return {
    provided,
    value,
    preferScoped: Boolean(provided && value)
  };
}

function applyScopeCondition(query, scopeDetails, includeFallback = true) {
  if (scopeDetails.preferScoped && includeFallback) {
    query.scope = { $in: [scopeDetails.value, null] };
  } else if (scopeDetails.preferScoped && !includeFallback) {
    query.scope = scopeDetails.value;
  } else {
    query.scope = null;
  }
}

function pickMetaByScope(records, scopeDetails) {
  const result = {};
  if (scopeDetails.preferScoped) {
    records
      .filter(record => record.scope === scopeDetails.value)
      .forEach((record) => {
        result[record.key] = record.value;
      });

    records
      .filter(record => record.scope === null || typeof record.scope === 'undefined')
      .forEach((record) => {
        if (!Object.prototype.hasOwnProperty.call(result, record.key)) {
          result[record.key] = record.value;
        }
      });
  } else {
    records
      .filter(record => record.scope === null || typeof record.scope === 'undefined')
      .forEach((record) => {
        result[record.key] = record.value;
      });
  }
  return result;
}

/**
 * Утилиты для работы с метаданными
 */

// Получить все метаданные для сущности в виде объекта {key: value}
export async function getEntityMeta(tenantId, entityType, entityId, options = {}) {
  try {
    const scopeDetails = getScopeDetails(options);
    const query = {
      tenantId,
      entityType,
      entityId
    };
    applyScopeCondition(query, scopeDetails);

    const metaRecords = await Meta.find(query).lean();

    // Преобразуем в объект { key: value }
    return pickMetaByScope(metaRecords, scopeDetails);
  } catch (error) {
    throw new Error(`Failed to get entity meta: ${error.message}`);
  }
}

// Получить все метаданные для сущности в виде массива с полной информацией
export async function getEntityMetaFull(tenantId, entityType, entityId, options = {}) {
  try {
    const scopeDetails = getScopeDetails(options);
    const query = {
      tenantId,
      entityType,
      entityId
    };

    if (scopeDetails.preferScoped) {
      applyScopeCondition(query, scopeDetails);
    } else if (scopeDetails.provided) {
      query.scope = null;
    }

    const metaRecords = await Meta.find(query)
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
    const scopeValue = normalizeScope(options.scope) ?? null;
    const meta = await Meta.findOneAndUpdate(
      {
        tenantId,
        entityType,
        entityId,
        key,
        scope: scopeValue
      },
      {
        value,
        dataType,
        createdBy: options.createdBy,
        scope: scopeValue,
        updatedAt: generateTimestamp()
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    return meta;
  } catch (error) {
    throw new Error(`Failed to set entity meta: ${error.message}`);
  }
}

// Удалить метаданные
export async function deleteEntityMeta(tenantId, entityType, entityId, key, options = {}) {
  try {
    const scopeValue = normalizeScope(options.scope) ?? null;
    const result = await Meta.deleteOne({
      tenantId,
      entityType,
      entityId,
      key,
      scope: scopeValue
    });

    return result.deletedCount > 0;
  } catch (error) {
    throw new Error(`Failed to delete entity meta: ${error.message}`);
  }
}

// Получить конкретное значение метаданных
export async function getEntityMetaValue(tenantId, entityType, entityId, key, defaultValue = null, options = {}) {
  try {
    const scopeDetails = getScopeDetails(options);
    const query = {
      tenantId,
      entityType,
      entityId,
      key
    };
    applyScopeCondition(query, scopeDetails);

    const records = await Meta.find(query).lean();

    if (scopeDetails.preferScoped) {
      const scoped = records.find(record => record.scope === scopeDetails.value);
      if (scoped) {
        return scoped.value;
      }
    }

    const fallback = records.find(record => record.scope === null || typeof record.scope === 'undefined');
    return fallback ? fallback.value : defaultValue;
  } catch (error) {
    throw new Error(`Failed to get entity meta value: ${error.message}`);
  }
}

// Построить MongoDB query для фильтрации по метаданным
export async function buildMetaQuery(tenantId, entityType, metaFilters, options = {}) {
  try {
    if (!metaFilters || Object.keys(metaFilters).length === 0) {
      return null;
    }

    console.log('buildMetaQuery called with:', { tenantId, entityType, metaFilters });

    const scopeDetails = getScopeDetails(options);

    // Для каждого мета-фильтра находим соответствующие entityId
    const allEntityIds = new Set();
    
    for (const [key, value] of Object.entries(metaFilters)) {
      console.log(`Looking for ${key}=${JSON.stringify(value)}`);
      
      // Строим запрос с учетом операторов MongoDB
      const metaQuery = {
        tenantId,
        entityType,
        key
      };
      applyScopeCondition(metaQuery, scopeDetails);
      
      // Если value - это объект с операторами MongoDB (например, { $ne: "armor" })
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Применяем оператор к полю value в коллекции Meta
        metaQuery.value = value;
        
        // Для оператора $ne нужна особая логика
        if (value.$ne !== undefined) {
          console.log(`Handling $ne operator for ${key}`);
          
          // Находим все entityId, которые НЕ имеют этого значения
          // Сначала получаем все entityId с этим ключом
          const allWithKeyQuery = {
            tenantId,
            entityType,
            key
          };
          applyScopeCondition(allWithKeyQuery, scopeDetails);
          const allWithKey = await Meta.find(allWithKeyQuery)
            .select('entityId')
            .lean();
          
          // Затем получаем entityId с конкретным значением (которые нужно исключить)
          const excludeQuery = {
            tenantId,
            entityType,
            key,
            value: value.$ne
          };
          applyScopeCondition(excludeQuery, scopeDetails);
          
          const excludeRecords = await Meta.find(excludeQuery).select('entityId').lean();
          const excludeIds = new Set(excludeRecords.map(r => r.entityId.toString()));
          
          console.log(`Found ${allWithKey.length} records with key ${key}`);
          console.log(`Found ${excludeRecords.length} records to exclude`);
          
          // Добавляем все entityId с этим ключом, кроме исключаемых
          allWithKey.forEach(record => {
            if (!excludeIds.has(record.entityId.toString())) {
              allEntityIds.add(record.entityId);
            }
          });
          
          // Также нужно добавить entityId, которые вообще не имеют этого ключа
          // Для этого нам нужно получить все entityId данного типа и исключить те, что имеют этот ключ
          if (entityType === 'message') {
            const { Message } = await import('../models/index.js');
            const allMessages = await Message.find({ tenantId }).select('messageId').lean();
            const allMessageIds = new Set(allMessages.map(m => m.messageId));
            
            const withKeyIds = new Set(allWithKey.map(r => r.entityId.toString()));
            
            // Добавляем entityId, которые не имеют этого ключа вообще
            allMessageIds.forEach(id => {
              if (!withKeyIds.has(id)) {
                allEntityIds.add(id);
              }
            });
          } else {
            // Для других типов (dialog, user и т.д.) entityId уже строки в Meta коллекции
            // Просто добавляем все entityId из Meta, которые не имеют этого ключа
            const withKeyIds = new Set(allWithKey.map(r => r.entityId.toString()));
            // Для других типов просто не добавляем пустые значения
            // Эта логика может быть расширена при необходимости
          }
          
          continue; // Пропускаем обычную обработку
        }
      } else {
        // Простое равенство
        metaQuery.value = value;
      }
      
      console.log('Meta query:', metaQuery);
      
      const metaRecords = await Meta.find(metaQuery).select('entityId').lean();
      
      console.log(`Found ${metaRecords.length} records for ${key}=${JSON.stringify(value)}`);
      
      if (metaRecords.length === 0) {
        // Если нет записей для этого фильтра, возвращаем пустой результат
        console.log(`No records found for ${key}=${JSON.stringify(value)}, returning empty result`);
        if (entityType === 'message') {
          return { messageId: { $in: [] } };
        } else if (entityType === 'dialog') {
          return { dialogId: { $in: [] } };
        } else if (entityType === 'dialogMember') {
          return { _id: { $in: [] } }; // Пустой результат для DialogMember
        } else {
          return { _id: { $in: [] } };
        }
      }
      
      // Добавляем entityId в множество
      metaRecords.forEach(record => {
        allEntityIds.add(record.entityId);
      });
    }
    
    const entityIds = Array.from(allEntityIds);
    console.log('Final entity IDs:', entityIds);
    
    // Для разных типов сущностей используем разные поля для фильтрации
    if (entityType === 'message') {
      // Для сообщений entityId это messageId (строка), а не _id
      return { messageId: { $in: entityIds } };
    } else if (entityType === 'dialog') {
      // Для диалогов entityId это dialogId (строка), а не _id
      return { dialogId: { $in: entityIds } };
    } else if (entityType === 'dialogMember') {
      // Для DialogMember entityId это составной ключ dialogId:userId
      // Нужно распарсить и использовать dialogId и userId
      const memberQueries = entityIds.map(entityId => {
        const parts = entityId.toString().split(':');
        if (parts.length !== 2) {
          return null;
        }
        const [dialogId, userId] = parts;
        return { dialogId, userId };
      }).filter(q => q !== null);
      
      if (memberQueries.length === 0) {
        return { _id: { $in: [] } }; // Пустой результат
      }
      
      // Используем $or для поиска по составному ключу
      return { $or: memberQueries };
    } else {
      // Для других типов (user, tenant, system) entityId это строка, но не используется для фильтрации
      // Возвращаем пустой результат, так как для этих типов фильтрация по meta не поддерживается
      return { _id: { $in: [] } };
    }
  } catch (error) {
    console.error('Error in buildMetaQuery:', error);
    throw new Error(`Failed to build meta query: ${error.message}`);
  }
}

