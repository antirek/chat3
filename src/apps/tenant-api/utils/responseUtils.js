/**
 * Удаляет поля _id, id и __v из объекта и всех его вложенных объектов
 * @param {any} obj - Объект для очистки
 * @returns {any} - Очищенный объект
 */

// Список полей, которые являются timestamps и должны быть форматированы с 6 знаками
const TIMESTAMP_FIELDS = [
  'createdAt',
  'updatedAt', 
  'lastSeenAt',
  'lastMessageAt',
  'lastInteractionAt',
  'lastActiveAt',
  'publishedAt',
  'expiresAt',
  'lastUsedAt',
  'readAt',
  'deliveredAt',
  'joinedAt'
];

export function removeIdFields(obj) {
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
  if (obj._bsontype === 'ObjectID' || (obj.constructor && obj.constructor.name === 'ObjectID')) {
    return obj.toString();
  }

  // Если это Buffer или другой специальный объект, возвращаем как есть
  if (obj instanceof Buffer || obj.toString !== Object.prototype.toString) {
    return obj;
  }

  // Создаем новый объект без _id, id, __v и name (для объектов User)
  const result = {};
  
  // Определяем, является ли это объектом User (проверяем наличие userId и tenantId)
  const isUserObject = obj.userId !== undefined && obj.tenantId !== undefined;
  
  for (const [key, value] of Object.entries(obj)) {
    // Пропускаем поля _id, id, __v
    if (key === '_id' || key === 'id' || key === '__v') {
      continue;
    }
    
    // Удаляем name только для объектов User
    if (key === 'name' && isUserObject) {
      continue;
    }
    
    // Форматируем timestamp поля с 6 знаками после точки
    if (TIMESTAMP_FIELDS.includes(key) && typeof value === 'number' && value > 1000000000000) {
      // Возвращаем строку с 6 знаками для гарантии отображения всех микросекунд
      result[key] = value.toFixed(6);
    } else {
      // Рекурсивно обрабатываем вложенные объекты и массивы
      result[key] = removeIdFields(value);
    }
  }

  return result;
}

/**
 * Очищает объект ответа от полей _id, id и __v перед отправкой клиенту
 * @param {any} data - Данные для очистки
 * @returns {any} - Очищенные данные
 */
export function sanitizeResponse(data) {
  return removeIdFields(data);
}

/**
 * JSON.stringify replacer для форматирования timestamps с 6 знаками
 * Использовать: JSON.stringify(data, timestampReplacer)
 */
export function timestampReplacer(key, value) {
  if (TIMESTAMP_FIELDS.includes(key) && typeof value === 'number' && value > 1000000000000) {
    // Возвращаем число, но JSON.stringify покажет его с максимальной точностью
    // Для гарантии 6 знаков нужно было бы вернуть строку, но это нарушает типизацию
    return parseFloat(value.toFixed(6));
  }
  return value;
}

