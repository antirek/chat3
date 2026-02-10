/**
 * Удаляет поля _id, id и __v из объекта и всех его вложенных объектов
 */

// Список полей, которые являются timestamps и должны быть форматированы строками с 6 знаками после точки (микросекунды)
const TIMESTAMP_FIELDS = [
  'createdAt',
  'lastSeenAt',
  'lastMessageAt',
  'lastInteractionAt',
  'publishedAt',
  'expiresAt',
  'lastUsedAt',
  'readAt',
  'deliveredAt',
  'joinedAt',
  'lastUpdatedAt',
  'lastActivityAt',
  'addedAt'
] as const;

/** Приводит значение timestamp к строке с 6 знаками после точки */
function formatTimestampValue(value: unknown): string | undefined {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    return value.toFixed(6);
  }
  if (typeof value === 'string') {
    const match = value.match(/^(\d+)(?:\.(\d+))?$/);
    if (match) {
      const intPart = match[1];
      const fracPart = (match[2] || '').padEnd(6, '0').slice(0, 6);
      return `${intPart}.${fracPart}`;
    }
  }
  return undefined;
}

export function removeIdFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Если это массив, обрабатываем каждый элемент
  if (Array.isArray(obj)) {
    return obj.map(item => removeIdFields(item));
  }

  // Если это не объект (примитив), возвращаем как есть
  if (typeof obj !== 'object') {
    return obj;
  }

  // Если это Date, возвращаем как есть
  if (obj instanceof Date) {
    return obj;
  }

  // Проверяем на ObjectId (Mongoose ObjectId имеет свойство _bsontype)
  const objAny = obj as { _bsontype?: string; constructor?: { name?: string }; toString?: () => string };
  if (objAny._bsontype === 'ObjectID' || (objAny.constructor && objAny.constructor.name === 'ObjectID')) {
    return objAny.toString?.() || String(obj);
  }

  // Если это Buffer или другой специальный объект, возвращаем как есть
  if (obj instanceof Buffer || objAny.toString !== Object.prototype.toString) {
    return obj;
  }

  // Создаем новый объект без _id, id, __v и name (для объектов User)
  const result: Record<string, unknown> = {};
  const objRecord = obj as Record<string, unknown>;
  
  // Определяем, является ли это объектом User (проверяем наличие userId и tenantId)
  const isUserObject = objRecord.userId !== undefined && objRecord.tenantId !== undefined;
  
  for (const [key, value] of Object.entries(objRecord)) {
    // Пропускаем поля _id, id, __v
    if (key === '_id' || key === 'id' || key === '__v') {
      continue;
    }
    
    // Удаляем name только для объектов User
    if (key === 'name' && isUserObject) {
      continue;
    }
    
    // Форматируем timestamp поля: всегда строка с 6 знаками после точки (микросекунды)
    if (TIMESTAMP_FIELDS.includes(key as (typeof TIMESTAMP_FIELDS)[number])) {
      const formatted = formatTimestampValue(value);
      if (formatted !== undefined) {
        result[key] = formatted;
        continue;
      }
    }
    // Рекурсивно обрабатываем вложенные объекты и массивы
    result[key] = removeIdFields(value);
  }

  return result;
}

/**
 * Очищает объект ответа от полей _id, id и __v перед отправкой клиенту
 * @param data - Данные для очистки
 * @returns Очищенные данные
 */
export function sanitizeResponse(data: unknown): unknown {
  return removeIdFields(data);
}

/**
 * JSON.stringify replacer для форматирования timestamps строками с 6 знаками после точки
 * Использовать: JSON.stringify(data, timestampReplacer)
 */
export function timestampReplacer(key: string, value: unknown): unknown {
  if (TIMESTAMP_FIELDS.includes(key as (typeof TIMESTAMP_FIELDS)[number])) {
    const formatted = formatTimestampValue(value);
    if (formatted !== undefined) return formatted;
  }
  return value;
}
