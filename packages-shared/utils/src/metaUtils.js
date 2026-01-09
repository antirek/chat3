import { Meta, Message } from '@chat3/models';
// Получить все метаданные для сущности в виде объекта {key: value}
export async function getEntityMeta(tenantId, entityType, entityId, _options = {}) {
    try {
        const query = {
            tenantId,
            entityType,
            entityId
        };
        const metaRecords = await Meta.find(query).lean();
        // Преобразуем в объект { key: value }
        const result = {};
        metaRecords.forEach((record) => {
            result[record.key] = record.value;
        });
        return result;
    }
    catch (error) {
        throw new Error(`Failed to get entity meta: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// Получить все метаданные для сущности в виде массива с полной информацией
// eslint-disable-next-line no-unused-vars
export async function getEntityMetaFull(tenantId, entityType, entityId, options = {}) {
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
    }
    catch (error) {
        throw new Error(`Failed to get entity meta full: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// Установить или обновить метаданные
export async function setEntityMeta(tenantId, entityType, entityId, key, value, dataType = 'string', options = {}) {
    try {
        const meta = await Meta.findOneAndUpdate({
            tenantId,
            entityType,
            entityId,
            key
        }, {
            value,
            dataType,
            createdBy: options.createdBy
        }, {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        });
        return meta;
    }
    catch (error) {
        throw new Error(`Failed to set entity meta: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// Удалить метаданные
// eslint-disable-next-line no-unused-vars
export async function deleteEntityMeta(tenantId, entityType, entityId, key, options = {}) {
    try {
        const result = await Meta.deleteOne({
            tenantId,
            entityType,
            entityId,
            key
        });
        return result.deletedCount > 0;
    }
    catch (error) {
        throw new Error(`Failed to delete entity meta: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// Получить конкретное значение метаданных
// eslint-disable-next-line no-unused-vars
export async function getEntityMetaValue(tenantId, entityType, entityId, key, defaultValue = null, options = {}) {
    try {
        const query = {
            tenantId,
            entityType,
            entityId,
            key
        };
        const record = await Meta.findOne(query).lean();
        return record ? record.value : defaultValue;
    }
    catch (error) {
        throw new Error(`Failed to get entity meta value: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// Построить MongoDB query для фильтрации по метаданным
// eslint-disable-next-line no-unused-vars
export async function buildMetaQuery(tenantId, entityType, metaFilters, options = {}) {
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
                const valueObj = value;
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
                    // Добавляем все entityId с этим ключом, кроме исключаемых
                    allWithKey.forEach(record => {
                        if (!excludeIds.has(String(record.entityId))) {
                            allEntityIds.add(String(record.entityId));
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
                            if (!withKeyIds.has(id)) {
                                allEntityIds.add(id);
                            }
                        });
                    }
                    else {
                        // Для других типов (dialog, user и т.д.) entityId уже строки в Meta коллекции
                        // Просто добавляем все entityId из Meta, которые не имеют этого ключа
                        // eslint-disable-next-line no-unused-vars
                        const withKeyIds = new Set(allWithKey.map(r => String(r.entityId)));
                        // Для других типов просто не добавляем пустые значения
                        // Эта логика может быть расширена при необходимости
                    }
                    continue; // Пропускаем обычную обработку
                }
            }
            else {
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
                }
                else if (entityType === 'dialog') {
                    return { dialogId: { $in: [] } };
                }
                else if (entityType === 'dialogMember') {
                    return { _id: { $in: [] } }; // Пустой результат для DialogMember
                }
                else {
                    return { _id: { $in: [] } };
                }
            }
            // Добавляем entityId в множество
            metaRecords.forEach(record => {
                allEntityIds.add(String(record.entityId));
            });
        }
        const entityIds = Array.from(allEntityIds);
        console.log('Final entity IDs:', entityIds);
        // Для разных типов сущностей используем разные поля для фильтрации
        if (entityType === 'message') {
            // Для сообщений entityId это messageId (строка), а не _id
            return { messageId: { $in: entityIds } };
        }
        else if (entityType === 'dialog') {
            // Для диалогов entityId это dialogId (строка), а не _id
            return { dialogId: { $in: entityIds } };
        }
        else if (entityType === 'dialogMember') {
            // Для DialogMember entityId это составной ключ dialogId:userId
            // Нужно распарсить и использовать dialogId и userId
            const memberQueries = entityIds.map(entityId => {
                const parts = entityId.toString().split(':');
                if (parts.length !== 2) {
                    return null;
                }
                const [dialogId, userId] = parts;
                return { dialogId, userId };
            }).filter((q) => q !== null);
            if (memberQueries.length === 0) {
                return { _id: { $in: [] } }; // Пустой результат
            }
            // Используем $or для поиска по составному ключу
            return { $or: memberQueries };
        }
        else {
            // Для других типов (user, tenant, system) entityId это строка, но не используется для фильтрации
            // Возвращаем пустой результат, так как для этих типов фильтрация по meta не поддерживается
            return { _id: { $in: [] } };
        }
    }
    catch (error) {
        console.error('Error in buildMetaQuery:', error);
        throw new Error(`Failed to build meta query: ${error instanceof Error ? error.message : String(error)}`);
    }
}
//# sourceMappingURL=metaUtils.js.map