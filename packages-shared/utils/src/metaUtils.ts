import { Meta, Message, Pack, Dialog, Topic } from '@chat3/models';
import type { MetaEntityType } from '@chat3/models';
import {
  loadDefinitions,
  findAllowlistDefinition,
  getIndexDefinitions,
  assertMetaKeysAllowed,
  validateBeforeSingleKeyWrite,
  validateBeforeSingleKeyDelete,
  validateBeforeBulkDelete,
  enforceMetaState,
  releaseAllMetaIndexForEntity,
  syncUniqueForDefinition,
  validateRequiredBundle,
  assertNoPartialRequiredBundle,
  validateRequiredMetaForCreate,
  parseMetaPayload,
  runWithOptionalTransaction,
  metaMapFromDb
} from './metaIndexUtils.js';
import { MetaIndexError } from './metaIndexErrors.js';
import type { ClientSession } from 'mongoose';

/** @deprecated use MetaEntityType from @chat3/models */
export type EntityType = MetaEntityType;
/**
 * Утилиты для работы с метаданными
 */

interface GetEntityMetaOptions {
  [key: string]: unknown;
}

export { validateRequiredMetaForCreate, parseMetaPayload } from './metaIndexUtils.js';

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

export interface MetaBulkEntry {
  value: unknown;
  dataType?: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

async function upsertMetaRecord(
  tenantId: string,
  entityType: MetaEntityType,
  entityId: string,
  key: string,
  value: unknown,
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array',
  createdBy: string | undefined,
  session: ClientSession | null
): Promise<unknown> {
  const filter = { tenantId, entityType, entityId, key };
  const update = { value, dataType, createdBy };
  const opts = { upsert: true, new: true, setDefaultsOnInsert: true, session: session ?? undefined };
  return Meta.findOneAndUpdate(filter, update, opts);
}

// Установить или обновить метаданные
export async function setEntityMeta(
  tenantId: string,
  entityType: MetaEntityType,
  entityId: string,
  key: string,
  value: unknown,
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array' = 'string',
  options: SetEntityMetaOptions = {}
): Promise<unknown> {
  try {
    const definitions = await loadDefinitions(tenantId, entityType);
    const allowlist = findAllowlistDefinition(definitions);
    assertMetaKeysAllowed([key], allowlist, entityType);
    const indexDefs = getIndexDefinitions(definitions);

    return await runWithOptionalTransaction(async (session) => {
      await validateBeforeSingleKeyWrite(
        tenantId,
        entityType,
        entityId,
        key,
        value,
        dataType,
        indexDefs,
        session
      );

      const meta = await upsertMetaRecord(
        tenantId,
        entityType,
        entityId,
        key,
        value,
        dataType,
        options.createdBy,
        session
      );

      const { values, dataTypes } = await metaMapFromDb(tenantId, entityType, entityId, session);
      const uniqueDefs = indexDefs.filter((d) => d.mode === 'unique' && d.keys.includes(key));
      for (const def of uniqueDefs) {
        await syncUniqueForDefinition(tenantId, entityType, entityId, def, values, dataTypes, session);
      }

      for (const def of indexDefs.filter((d) => d.mode === 'required')) {
        validateRequiredBundle(values, dataTypes, def);
      }

      return meta;
    });
  } catch (error) {
    if (error instanceof MetaIndexError) {
      throw error;
    }
    throw new Error(`Failed to set entity meta: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function setEntityMetaBulk(
  tenantId: string,
  entityType: MetaEntityType,
  entityId: string,
  meta: Record<string, MetaBulkEntry | unknown>,
  options: SetEntityMetaOptions = {}
): Promise<Record<string, unknown>> {
  const definitions = await loadDefinitions(tenantId, entityType);
  const allowlist = findAllowlistDefinition(definitions);
  const indexDefs = getIndexDefinitions(definitions);
  const { values: parsedValues, dataTypes: parsedDataTypes } = parseMetaPayload(meta as Record<string, unknown>);
  const entries = Object.keys(parsedValues).map((key) => ({
    key,
    value: parsedValues[key],
    dataType: parsedDataTypes[key] as 'string' | 'number' | 'boolean' | 'object' | 'array'
  }));

  assertMetaKeysAllowed(entries.map((e) => e.key), allowlist, entityType);

  return await runWithOptionalTransaction(async (session) => {
    const { values: currentValues, dataTypes: currentDataTypes } = await metaMapFromDb(
      tenantId,
      entityType,
      entityId,
      session
    );
    const nextValues = { ...currentValues };
    const nextDataTypes = { ...currentDataTypes };

    for (const { key, value, dataType } of entries) {
      nextValues[key] = value;
      nextDataTypes[key] = dataType;
    }

    for (const def of indexDefs) {
      const touches = def.keys.some((k) => entries.some((e) => e.key === k));
      if (!touches) {
        continue;
      }
      if (def.mode === 'required' && def.keys.length > 1) {
        assertNoPartialRequiredBundle(nextValues, def);
        validateRequiredBundle(nextValues, nextDataTypes, def);
      }
    }

    for (const { key, value, dataType } of entries) {
      await upsertMetaRecord(tenantId, entityType, entityId, key, value, dataType, options.createdBy, session);
    }

    const { values, dataTypes } = await metaMapFromDb(tenantId, entityType, entityId, session);
    await enforceMetaState(tenantId, entityType, entityId, values, dataTypes, indexDefs, session);

    return values;
  });
}

// Удалить метаданные
export async function deleteEntityMeta(
  tenantId: string,
  entityType: MetaEntityType,
  entityId: string,
  key: string,
  _options: GetEntityMetaOptions = {}
): Promise<boolean> {
  try {
    const definitions = await loadDefinitions(tenantId, entityType);
    const indexDefs = getIndexDefinitions(definitions);
    await validateBeforeSingleKeyDelete(tenantId, entityType, entityId, key, indexDefs);

    return await runWithOptionalTransaction(async (session) => {
      const op = Meta.deleteOne({ tenantId, entityType, entityId, key });
      if (session) {
        op.session(session);
      }
      const result = await op;
      if (result.deletedCount === 0) {
        return false;
      }

      const { values, dataTypes } = await metaMapFromDb(tenantId, entityType, entityId, session);
      for (const def of indexDefs.filter((d) => d.mode === 'unique' && d.keys.includes(key))) {
        await syncUniqueForDefinition(tenantId, entityType, entityId, def, values, dataTypes, session);
      }

      return true;
    });
  } catch (error) {
    if (error instanceof MetaIndexError) {
      throw error;
    }
    throw new Error(`Failed to delete entity meta: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function deleteEntityMetaBulk(
  tenantId: string,
  entityType: MetaEntityType,
  entityId: string,
  keys: string[]
): Promise<Record<string, unknown>> {
  const definitions = await loadDefinitions(tenantId, entityType);
  const indexDefs = getIndexDefinitions(definitions);
  await validateBeforeBulkDelete(tenantId, entityType, entityId, keys, indexDefs);

  return await runWithOptionalTransaction(async (session) => {
    const op = Meta.deleteMany({
      tenantId,
      entityType,
      entityId,
      key: { $in: keys }
    });
    if (session) {
      op.session(session);
    }
    await op;

    const { values, dataTypes } = await metaMapFromDb(tenantId, entityType, entityId, session);
    // После bulk delete required-связки meta может не удовлетворять required — это OK (B3).
    // Обновляем только слоты unique.
    for (const def of indexDefs.filter((d) => d.mode === 'unique')) {
      await syncUniqueForDefinition(tenantId, entityType, entityId, def, values, dataTypes, session);
    }

    return values;
  });
}

export async function deleteAllMetaForEntity(
  tenantId: string,
  entityType: MetaEntityType,
  entityId: string,
  session: ClientSession | null = null
): Promise<void> {
  const metaOp = Meta.deleteMany({ tenantId, entityType, entityId });
  if (session) {
    metaOp.session(session);
  }
  await metaOp;
  await releaseAllMetaIndexForEntity(tenantId, entityType, entityId, session);
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
    
    const emptyResult = () => {
      if (entityType === 'message') return { messageId: { $in: [] } };
      if (entityType === 'dialog') return { dialogId: { $in: [] } };
      if (entityType === 'topic') return { topicId: { $in: [] } };
      if (entityType === 'pack') return { packId: { $in: [] } };
      if (entityType === 'dialogMember') return { _id: { $in: [] } };
      return { _id: { $in: [] } };
    };

    const getAllEntityIdsForExists = async (): Promise<Set<string>> => {
      if (entityType === 'message') {
        const all = await Message.find({ tenantId }).select('messageId').lean();
        return new Set(all.map((m) => String((m as any).messageId)));
      }
      if (entityType === 'dialog') {
        const all = await Dialog.find({ tenantId }).select('dialogId').lean();
        return new Set(all.map((d) => String((d as any).dialogId)));
      }
      if (entityType === 'topic') {
        const all = await Topic.find({ tenantId }).select('topicId').lean();
        return new Set(all.map((t) => String((t as any).topicId)));
      }
      if (entityType === 'pack') {
        const all = await Pack.find({ tenantId }).select('packId').lean();
        return new Set(all.map((p) => String((p as any).packId)));
      }
      // user/tenant/system/dialogMember — для них list endpoints либо не поддерживают meta-фильтры, либо entityId не представим одним полем
      return new Set();
    };

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
        const valueObj = value as { $ne?: unknown; $exists?: unknown };

        // exists: true/false по наличию meta-ключа. Для exists:false нужно множество всех сущностей.
        if (typeof valueObj.$exists === 'boolean') {
          const allWithKey = await Meta.find({ tenantId, entityType, key }).select('entityId').lean();
          const withKeyIds = new Set(allWithKey.map((r) => String((r as any).entityId)));

          const currentEntityIds = new Set<string>();
          if (valueObj.$exists) {
            for (const id of withKeyIds) currentEntityIds.add(id);
          } else {
            const universeIds = await getAllEntityIdsForExists();
            // если тип не поддерживает exists:false корректно — вернём пусто (безопаснее, чем “все”)
            if (universeIds.size === 0) {
              return emptyResult();
            }
            for (const id of universeIds) {
              if (!withKeyIds.has(id)) currentEntityIds.add(id);
            }
          }

          if (currentEntityIds.size === 0) {
            return emptyResult();
          }

          if (allEntityIds === null) {
            allEntityIds = currentEntityIds;
          } else {
            allEntityIds = new Set([...allEntityIds].filter((id) => currentEntityIds.has(id)));
            if (allEntityIds.size === 0) {
              return emptyResult();
            }
          }
          continue;
        }

        // Применяем оператор к полю value в коллекции Meta
        metaQuery.value = value;
        
        // Для оператора $ne нужна особая логика
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
          
          // entityId без meta-ключа (для message/dialog/topic/pack)
          const withKeyIds = new Set(allWithKey.map((r) => String(r.entityId)));
          const universeIds = await getAllEntityIdsForExists();
          for (const id of universeIds) {
            if (!withKeyIds.has(id)) {
              neEntityIds.add(id);
            }
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
              } else if (entityType === 'pack') {
                return { packId: { $in: [] } };
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
        return emptyResult();
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
          return emptyResult();
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
    } else if (entityType === 'pack') {
      return { packId: { $in: entityIds } };
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
