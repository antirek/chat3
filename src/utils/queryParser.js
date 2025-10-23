/**
 * QueryParser - утилита для парсинга сложных фильтров
 * 
 * Формат фильтра: (field,operator,value)
 * Примеры:
 *   - (status,eq,active)
 *   - (status,in,[active,pending])
 *   - (age,gte,18)
 *   - (name,regex,^John)
 * 
 * Для meta фильтров:
 *   - (meta.type,eq,internal)
 *   - (meta.channelType,ne,telegram)
 */

/**
 * Парсит строку фильтра в MongoDB query
 * @param {string} filterString - Строка фильтра вида "(field,operator,value)"
 * @returns {object} MongoDB query объект
 */
export function parseFilter(filterString) {
  if (!filterString || typeof filterString !== 'string') {
    return {};
  }

  // Убираем пробелы
  filterString = filterString.trim();

  // Если это старый JSON формат, парсим как JSON
  if (filterString.startsWith('{')) {
    try {
      return JSON.parse(filterString);
    } catch (e) {
      throw new Error('Invalid JSON filter format');
    }
  }

  const result = {};
  
  // Регулярка для парсинга: (field,operator,value)
  const filterRegex = /\(([^,]+),([^,]+),([^)]+)\)/g;
  let match;

  while ((match = filterRegex.exec(filterString)) !== null) {
    const [, field, operator, value] = match;
    
    const fieldTrimmed = field.trim();
    const operatorTrimmed = operator.trim();
    const valueTrimmed = value.trim();

    const parsedValue = parseValue(valueTrimmed);
    const mongoQuery = operatorToMongo(operatorTrimmed, parsedValue);

    // Поддержка вложенных полей (meta.type)
    if (fieldTrimmed.includes('.')) {
      // Для вложенных полей создаем структуру
      const parts = fieldTrimmed.split('.');
      let current = result;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      
      const lastPart = parts[parts.length - 1];
      current[lastPart] = mongoQuery;
    } else {
      result[fieldTrimmed] = mongoQuery;
    }
  }

  return result;
}

/**
 * Парсит значение из строки
 * @param {string} value - Строковое значение
 * @returns {any} Распарсенное значение
 */
function parseValue(value) {
  // Массив: [value1,value2,value3]
  if (value.startsWith('[') && value.endsWith(']')) {
    const items = value.slice(1, -1).split(',').map(v => v.trim());
    return items.map(item => parseScalarValue(item));
  }

  return parseScalarValue(value);
}

/**
 * Парсит скалярное значение
 * @param {string} value - Строковое значение
 * @returns {any} Распарсенное значение (число, boolean, строка)
 */
function parseScalarValue(value) {
  // null
  if (value === 'null') return null;
  
  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;
  
  // Число
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return parseFloat(value);
  }
  
  // Строка (убираем кавычки если есть)
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  
  return value;
}

/**
 * Преобразует оператор в MongoDB query
 * @param {string} operator - Оператор (eq, ne, in, gt, etc.)
 * @param {any} value - Значение
 * @returns {any} MongoDB query
 */
function operatorToMongo(operator, value) {
  const operators = {
    'eq': value,                    // Равно
    'ne': { $ne: value },          // Не равно
    'in': { $in: value },          // В массиве
    'nin': { $nin: value },        // Не в массиве
    'gt': { $gt: value },          // Больше
    'gte': { $gte: value },        // Больше или равно
    'lt': { $lt: value },          // Меньше
    'lte': { $lte: value },        // Меньше или равно
    'regex': { $regex: value, $options: 'i' }, // Регулярное выражение (case-insensitive)
    'exists': { $exists: value },  // Существование поля
  };

  if (!operators.hasOwnProperty(operator)) {
    throw new Error(`Unsupported operator: ${operator}. Supported: ${Object.keys(operators).join(', ')}`);
  }

  return operators[operator];
}

/**
 * Парсит множественные фильтры, разделенные &
 * @param {string} filterString - Строка с фильтрами
 * @returns {object} Объединенный MongoDB query
 */
export function parseFilters(filterString) {
  if (!filterString || typeof filterString !== 'string') {
    return {};
  }

  // Если это JSON, парсим как JSON
  if (filterString.trim().startsWith('{')) {
    try {
      return JSON.parse(filterString);
    } catch (e) {
      throw new Error('Invalid JSON filter format');
    }
  }

  // Разделяем по & (но не внутри скобок)
  const filters = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < filterString.length; i++) {
    const char = filterString[i];
    
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === '&' && depth === 0) {
      if (current.trim()) {
        filters.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    filters.push(current.trim());
  }

  // Парсим каждый фильтр и объединяем
  const result = {};
  
  for (const filter of filters) {
    const parsed = parseFilter(filter);
    
    // Объединяем результаты
    for (const [key, value] of Object.entries(parsed)) {
      if (result[key]) {
        // Если ключ уже существует, объединяем условия через $and
        if (!result.$and) {
          result.$and = [];
        }
        result.$and.push({ [key]: value });
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Извлекает meta фильтры из общего фильтра
 * @param {object} filter - Фильтр объект
 * @returns {{ metaFilters: object, regularFilters: object }}
 */
export function extractMetaFilters(filter) {
  const metaFilters = {};
  const regularFilters = {};

  for (const [key, value] of Object.entries(filter)) {
    if (key === 'meta') {
      // Старый формат: { meta: { type: "internal" } }
      Object.assign(metaFilters, value);
    } else if (key.startsWith('meta.')) {
      // Новый формат: { "meta.type": "internal" }
      const metaKey = key.substring(5); // Убираем "meta."
      metaFilters[metaKey] = value;
    } else if (key === '$and' && Array.isArray(value)) {
      // Обрабатываем $and массив
      for (const andCondition of value) {
        const { metaFilters: nestedMeta } = extractMetaFilters(andCondition);
        Object.assign(metaFilters, nestedMeta);
      }
      // $and не добавляем в regularFilters
    } else {
      regularFilters[key] = value;
    }
  }

  return { metaFilters, regularFilters };
}

export default {
  parseFilter,
  parseFilters,
  extractMetaFilters,
  operatorToMongo,
};

