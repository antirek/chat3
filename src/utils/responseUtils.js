/**
 * Удаляет поля _id, id и __v из объекта и всех его вложенных объектов
 * @param {any} obj - Объект для очистки
 * @returns {any} - Очищенный объект
 */
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

  // Создаем новый объект без _id, id и __v
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Пропускаем поля _id, id и __v
    if (key === '_id' || key === 'id' || key === '__v') {
      continue;
    }
    
    // Рекурсивно обрабатываем вложенные объекты и массивы
    result[key] = removeIdFields(value);
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

