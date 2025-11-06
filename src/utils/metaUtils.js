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

    console.log('buildMetaQuery called with:', { tenantId, entityType, metaFilters });

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
      
      // Если value - это объект с операторами MongoDB (например, { $ne: "armor" })
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Применяем оператор к полю value в коллекции Meta
        metaQuery.value = value;
        
        // Для оператора $ne нужна особая логика
        if (value.$ne !== undefined) {
          console.log(`Handling $ne operator for ${key}`);
          
          // Находим все entityId, которые НЕ имеют этого значения
          // Сначала получаем все entityId с этим ключом
          const allWithKey = await Meta.find({
            tenantId,
            entityType,
            key
          }).select('entityId').lean();
          
          // Затем получаем entityId с конкретным значением (которые нужно исключить)
          const excludeQuery = {
            tenantId,
            entityType,
            key,
            value: value.$ne
          };
          
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
    } else {
      // Для других типов используем _id (ObjectId)
      return { _id: { $in: entityIds } };
    }
  } catch (error) {
    console.error('Error in buildMetaQuery:', error);
    throw new Error(`Failed to build meta query: ${error.message}`);
  }
}

