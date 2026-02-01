import { Meta, Message } from '@chat3/models';
import type { EntityType } from '@chat3/models';
/**
 * Утилиты для работы с метаданными
 */

interface GetEntityMetaOptions {
  [key: string]: unknown;
}

// Получить все метаданные для сущности в виде объекта {key: value}
export async function getEntityMeta(
  tenantId: string, 
  entityType: EntityType, 
  entityId: string, 
  _options: GetEntityMetaOptions = {}
): Promise<Record<string, unknown>> {
  try {
    const query = {
      tenantId,
      entityType,
      entityId
    };

    const metaRecords = await Meta.find(query).lean();

    // Преобразуем в объект { key: value }
    const result: Record<string, unknown> = {};
    metaRecords.forEach((record) => {
      result[record.key] = record.value;
    });
    return result;
  } catch (error) {
    throw new Error(`Failed to get entity meta: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Получить все метаданные для сущности в виде массива с полной информацией
 
export async function getEntityMetaFull(
  tenantId: string, 
  entityType: EntityType, 
  entityId: string, 
  _options: GetEntityMetaOptions = {}
): Promise<unknown[]> {
  try {
    const query = {
      tenantId,
      entityType,
      entityId
    };

    const metaRecords = await Meta.find(query)
      .select('-__v')
      .lean();

    return metaRecords;
  } catch (error) {
    throw new Error(`Failed to get entity meta full: ${error instanceof Error ? error.message : String(error)}`);
  }
}

interface SetEntityMetaOptions {
  createdBy?: string;
}

// Установить или обновить метаданные
export async function setEntityMeta(
  tenantId: string, 
  entityType: EntityType, 
  entityId: string, 
  key: string, 
  value: unknown, 
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array' = 'string', 
  options: SetEntityMetaOptions = {}
): Promise<unknown> {
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
        createdBy: options.createdBy
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    return meta;
  } catch (error) {
    throw new Error(`Failed to set entity meta: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Удалить метаданные
 
export async function deleteEntityMeta(
  tenantId: string, 
  entityType: EntityType, 
  entityId: string, 
  key: string, 
  _options: GetEntityMetaOptions = {}
): Promise<boolean> {
  try {
    const result = await Meta.deleteOne({
      tenantId,
      entityType,
      entityId,
      key
    });

    return result.deletedCount > 0;
  } catch (error) {
    throw new Error(`Failed to delete entity meta: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Получить конкретное значение метаданных
 
export async function getEntityMetaValue(
  tenantId: string, 
  entityType: EntityType, 
  entityId: string, 
  key: string, 
  defaultValue: unknown = null, 
  _options: GetEntityMetaOptions = {}
): Promise<unknown> {
  try {
    const query = {
      tenantId,
      entityType,
      entityId,
      key
    };

    const record = await Meta.findOne(query).lean();
    return record ? record.value : defaultValue;
  } catch (error) {
    throw new Error(`Failed to get entity meta value: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Построить MongoDB query для фильтрации по метаданным
 
export async function buildMetaQuery(
  tenantId: string, 
  entityType: EntityType, 
  metaFilters: Record<string, unknown>, 
  _options: GetEntityMetaOptions = {}
): Promise<Record<string, unknown> | null> {
  try {
    if (!metaFilters || Object.keys(metaFilters).length === 0) {
      return null;
    }

    console.log('buildMetaQuery called with:', { tenantId, entityType, metaFilters });

    // Для каждого мета-фильтра находим соответствующие entityId
    // Используем пересечение (AND): топик должен удовлетворять ВСЕМ meta-фильтрам
    let allEntityIds: Set<string> | null = null;
    
    for (const [key, value] of Object.entries(metaFilters)) {
      console.log(`Looking for ${key}=${JSON.stringify(value)}, type=${typeof value}`);
      
      // Строим запрос с учетом операторов MongoDB
      const metaQuery: {
        tenantId: string;
        entityType: EntityType;
        key: string;
        value?: unknown;
      } = {
        tenantId,
        entityType,
        key
      };
      
      // Если value - это объект с операторами MongoDB (например, { $ne: "armor" })
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Применяем оператор к полю value в коллекции Meta
        metaQuery.value = value;
        
        // Для оператора $ne нужна особая логика
        const valueObj = value as { $ne?: unknown };
        if (valueObj.$ne !== undefined) {
          console.log(`Handling $ne operator for ${key}`);
          
          // Находим все entityId, которые НЕ имеют этого значения
          // Сначала получаем все entityId с этим ключом
          const allWithKeyQuery = {
            tenantId,
            entityType,
            key
          };
          const allWithKey = await Meta.find(allWithKeyQuery)
            .select('entityId')
            .lean();
          
          // Затем получаем entityId с конкретным значением (которые нужно исключить)
          const excludeQuery = {
            tenantId,
            entityType,
            key,
            value: valueObj.$ne
          };
          
          const excludeRecords = await Meta.find(excludeQuery).select('entityId').lean();
          const excludeIds = new Set(excludeRecords.map(r => String(r.entityId)));
          
          console.log(`Found ${allWithKey.length} records with key ${key}`);
          console.log(`Found ${excludeRecords.length} records to exclude`);
          
          // Собираем entityId для $ne: все с ключом, кроме исключаемых
          const neEntityIds = new Set<string>();
          allWithKey.forEach(record => {
            if (!excludeIds.has(String(record.entityId))) {
              neEntityIds.add(String(record.entityId));
            }
          });
          
          // Также нужно добавить entityId, которые вообще не имеют этого ключа
          // Для этого нам нужно получить все entityId данного типа и исключить те, что имеют этот ключ
          if (entityType === 'message') {
            // Message уже импортирован в начале файла
            const allMessages = await Message.find({ tenantId }).select('messageId').lean();
            const allMessageIds = new Set(allMessages.map(m => String(m.messageId)));
            
            const withKeyIds = new Set(allWithKey.map(r => String(r.entityId)));
            
            // Добавляем entityId, которые не имеют этого ключа вообще
            allMessageIds.forEach(id => {
              const idStr = String(id);
              if (!withKeyIds.has(idStr)) {
                neEntityIds.add(idStr);
              }
            });
          } else {
            // Для других типов (dialog, user и т.д.) entityId уже строки в Meta коллекции
            // Просто добавляем все entityId из Meta, которые не имеют этого ключа
             
            const _withKeyIds = new Set(allWithKey.map(r => String(r.entityId)));
            // Для других типов просто не добавляем пустые значения
            // Эта логика может быть расширена при необходимости
          }
          
          // Пересечение с neEntityIds (как для обычного фильтра)
          if (allEntityIds === null) {
            allEntityIds = neEntityIds;
            console.log(`First key ${key} ($ne): initialized with ${allEntityIds.size} entityIds`);
          } else {
            const beforeSize = allEntityIds.size;
            allEntityIds = new Set([...allEntityIds].filter(id => neEntityIds.has(id)));
            console.log(`After ${key} ($ne): intersection ${beforeSize} ∩ ${neEntityIds.size} = ${allEntityIds.size}`);
            if (allEntityIds.size === 0) {
              console.log(`Intersection is empty after ${key} ($ne), returning empty result`);
              if (entityType === 'message') {
                return { messageId: { $in: [] } };
              } else if (entityType === 'dialog') {
                return { dialogId: { $in: [] } };
              } else if (entityType === 'topic') {
                return { topicId: { $in: [] } };
              } else if (entityType === 'dialogMember') {
                return { _id: { $in: [] } };
              } else {
                return { _id: { $in: [] } };
              }
            }
          }
          
          continue; // Пропускаем обычную обработку
        }
      } else {
        // Простое равенство. Для чисел допускаем совпадение и со строкой в БД (phone, contact_phone и т.д. часто хранятся как строка)
        if (typeof value === 'number' && !Number.isNaN(value)) {
          metaQuery.value = { $in: [value, String(value)] };
        } else {
          metaQuery.value = value;
        }
      }
      
      console.log('Meta query:', metaQuery);
      
      const metaRecords = await Meta.find(metaQuery).select('entityId').lean();
      
      console.log(`Found ${metaRecords.length} records for ${key}=${JSON.stringify(value)}`);
      
      const currentEntityIds = new Set(metaRecords.map(r => String(r.entityId)));
      
      if (currentEntityIds.size === 0) {
        // Если нет записей для этого фильтра, возвращаем пустой результат (пересечение с пустым = пусто)
        console.log(`No records found for ${key}=${JSON.stringify(value)}, returning empty result`);
        if (entityType === 'message') {
          return { messageId: { $in: [] } };
        } else if (entityType === 'dialog') {
          return { dialogId: { $in: [] } };
        } else if (entityType === 'dialogMember') {
          return { _id: { $in: [] } };
        } else if (entityType === 'topic') {
          return { topicId: { $in: [] } };
        } else {
          return { _id: { $in: [] } };
        }
      }
      
      // Пересечение (AND): оставляем только те entityId, которые есть в текущем множестве
      if (allEntityIds === null) {
        allEntityIds = currentEntityIds;
        console.log(`First key ${key}: initialized with ${allEntityIds.size} entityIds`);
      } else {
        const beforeSize = allEntityIds.size;
        allEntityIds = new Set([...allEntityIds].filter(id => currentEntityIds.has(id)));
        console.log(`After ${key}: intersection ${beforeSize} ∩ ${currentEntityIds.size} = ${allEntityIds.size}`);
        if (allEntityIds.size === 0) {
          // Пересечение пусто — возвращаем пустой результат
          console.log(`Intersection is empty after ${key}, returning empty result`);
          if (entityType === 'message') {
            return { messageId: { $in: [] } };
          } else if (entityType === 'dialog') {
            return { dialogId: { $in: [] } };
          } else if (entityType === 'topic') {
            return { topicId: { $in: [] } };
          } else if (entityType === 'dialogMember') {
            return { _id: { $in: [] } };
          } else {
            return { _id: { $in: [] } };
          }
        }
      }
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
    } else if (entityType === 'topic') {
      // Для топиков entityId это topicId (строка)
      return { topicId: { $in: entityIds } };
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
      }).filter((q): q is { dialogId: string; userId: string } => q !== null);
      
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
    throw new Error(`Failed to build meta query: ${error instanceof Error ? error.message : String(error)}`);
  }
}
