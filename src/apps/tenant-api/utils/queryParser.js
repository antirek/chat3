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
 * 
 * Для сортировки по полям участников:
 *   - (member[carl].unreadCount,desc)
 *   - (member[carl].lastSeenAt,desc)
 *   - (member[carl].lastMessageAt,desc)
 */

import { DialogMember } from '../../../models/index.js';

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
  filterString = stripInlineRegexFlags(filterString);

  // Если это старый JSON формат, парсим как JSON
  if (filterString.startsWith('{')) {
    try {
      return JSON.parse(filterString);
     
    } catch (_e) {
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

    const parsedValue = parseValue(valueTrimmed, fieldTrimmed);
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
 * @param {string} fieldName - Имя поля для определения типа
 * @returns {any} Распарсенное значение
 */
function parseValue(value, fieldName = '') {
  // Массив: [value1,value2,value3]
  if (value.startsWith('[') && value.endsWith(']')) {
    const items = value.slice(1, -1).split(',').map(v => v.trim());
    return items.map(item => parseScalarValue(item, fieldName));
  }

  return parseScalarValue(value, fieldName);
}

/**
 * Парсит скалярное значение
 * @param {string} value - Строковое значение
 * @param {string} fieldName - Имя поля для определения типа
 * @returns {any} Распарсенное значение (число, boolean, строка, timestamp)
 */
function parseScalarValue(value, fieldName = '') {
  // null
  if (value === 'null') return null;
  
  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;
  
  // Число
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return parseFloat(value);
  }
  
  // Конвертация дат в timestamps для временных полей
  const timestampFields = ['createdAt', 'updatedAt', 'lastSeenAt', 'lastMessageAt', 'publishedAt', 'readAt', 'deliveredAt', 'statusTime', 'reactionTime', 'joinedAt', 'expiresAt', 'lastUsedAt'];
  const isTimestampField = timestampFields.some(field => fieldName.includes(field));
  
  if (isTimestampField && isDateLike(value)) {
    const timestamp = dateToTimestamp(value);
    if (timestamp !== null) {
      return timestamp;
    }
  }
  
  // Строка (убираем кавычки если есть)
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  
  return value;
}

/**
 * Проверяет, похоже ли значение на дату
 * @param {string} value - Значение для проверки
 * @returns {boolean} true если похоже на дату
 */
function isDateLike(value) {
  // ISO формат: 2025-10-21, 2025-10-21T10:30:00, 2025-10-21T10:30:00Z, 2025-10-21T10:30:00.000Z
  const isoRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  return isoRegex.test(value);
}

/**
 * Конвертирует дату в timestamp (миллисекунды с микросекундной точностью)
 * @param {string} dateStr - Строка с датой
 * @returns {number|null} Timestamp или null если конвертация не удалась
 */
function dateToTimestamp(dateStr) {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    // Возвращаем timestamp в миллисекундах (без дробной части, т.к. не знаем микросекунды)
    return date.getTime();
    // eslint-disable-next-line no-unused-vars
  } catch (e) {
    return null;
  }
}

/**
 * Преобразует оператор в MongoDB query
 * @param {string} operator - Оператор (eq, ne, in, gt, etc.)
 * @param {any} value - Значение
 * @returns {any} MongoDB query
 */
function operatorToMongo(operator, value) {
  const operators = {
    'eq': () => value,                    // Равно
    'ne': () => ({ $ne: value }),         // Не равно
    'in': () => ({ $in: value }),         // В массиве
    'nin': () => ({ $nin: value }),       // Не в массиве
    'all': () => ({ $all: value }),       // Все элементы из массива (для member фильтров)
    'gt': () => ({ $gt: value }),         // Больше
    'gte': () => ({ $gte: value }),       // Больше или равно
    'lt': () => ({ $lt: value }),         // Меньше
    'lte': () => ({ $lte: value }),       // Меньше или равно
    'regex': () => {
      const { pattern, options } = normalizeRegexValue(value);
      return options ? { $regex: pattern, $options: options } : { $regex: pattern };
    }, // Регулярное выражение (по умолчанию insensitive)
    'exists': () => ({ $exists: value }), // Существование поля
  };

  if (!Object.prototype.hasOwnProperty.call(operators, operator)) {
    throw new Error(`Unsupported operator: ${operator}. Supported: ${Object.keys(operators).join(', ')}`);
  }

  return operators[operator]();
}

function normalizeRegexValue(rawValue) {
  if (rawValue instanceof RegExp) {
    // В редких случаях значение уже могло быть RegExp
    const flags = rawValue.flags ? ensureCaseInsensitive(rawValue.flags) : 'i';
    return { pattern: rawValue.source, options: flags };
  }

  if (typeof rawValue !== 'string') {
    return { pattern: rawValue, options: 'i' };
  }

  let pattern = rawValue;
  let options = 'i';

  // Обрабатываем inline-флаги вида (?i), (?im) и т.д. только в начале строки
  const inlineFlagRegex = /^\(\?([a-z]+)\)/i;
  let match = inlineFlagRegex.exec(pattern);
  while (match) {
    const flags = match[1];
    if (flags.includes('i')) {
      options = ensureCaseInsensitive(options || '');
    }
    // Удаляем распознанный inline-блок
    pattern = pattern.slice(match[0].length);
    match = inlineFlagRegex.exec(pattern);
  }

  pattern = pattern || '.*';

  return { pattern, options };
}

function ensureCaseInsensitive(existingFlags) {
  const flagsSet = new Set((existingFlags || '').split('').filter(Boolean));
  flagsSet.add('i');
  return Array.from(flagsSet).sort().join('');
}

function stripInlineRegexFlags(input) {
  if (typeof input !== 'string' || input.indexOf('(?') === -1) {
    return input;
  }
  return input.replace(/\(\?[a-z]*i[a-z]*\)/gi, '');
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
     
    } catch (_e) {
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
 * @returns {{ metaFilters: object, regularFilters: object, memberFilters: object }}
 */
export function extractMetaFilters(filter) {
  const metaFilters = {};
  const regularFilters = {};
  const memberFilters = {};

  for (const [key, value] of Object.entries(filter)) {
    if (key === 'meta') {
      // Старый формат: { meta: { type: "internal" } }
      Object.assign(metaFilters, value);
    } else if (key.startsWith('meta.')) {
      // Новый формат: { "meta.type": "internal" }
      const metaKey = key.substring(5); // Убираем "meta."
      metaFilters[metaKey] = value;
    } else if (key === 'topic' && typeof value === 'object' && value !== null) {
      // Обрабатываем topic фильтры
      const topicFilters = { ...value };
      
      // topic.meta.* фильтры должны попадать в metaFilters с префиксом "topic.meta."
      if (value.meta && typeof value.meta === 'object') {
        for (const [metaKey, metaValue] of Object.entries(value.meta)) {
          metaFilters[`topic.meta.${metaKey}`] = metaValue;
        }
        // Удаляем meta из topicFilters, чтобы не дублировать
        delete topicFilters.meta;
      }
      
      // topic.topicId и topic.topicCount остаются в regularFilters
      if (Object.keys(topicFilters).length > 0) {
        regularFilters[key] = topicFilters;
      }
    } else if (key === 'member') {
      // Фильтр по участникам: { member: "carl" } или { member: { $in: ["carl", "marta"] } }
      memberFilters[key] = value;
    } else if (key === '$and' && Array.isArray(value)) {
      // Обрабатываем $and массив
      for (const andCondition of value) {
        const { metaFilters: nestedMeta, memberFilters: nestedMember, regularFilters: nestedRegular } = extractMetaFilters(andCondition);
        Object.assign(metaFilters, nestedMeta);
        Object.assign(memberFilters, nestedMember);
        // Обрабатываем nested regularFilters для topic.meta.*
        if (nestedRegular.topic && nestedRegular.topic.meta) {
          for (const [metaKey, metaValue] of Object.entries(nestedRegular.topic.meta)) {
            metaFilters[`topic.meta.${metaKey}`] = metaValue;
          }
        }
      }
      // $and не добавляем в regularFilters
    } else {
      regularFilters[key] = value;
    }
  }

  return { metaFilters, regularFilters, memberFilters };
}

/**
 * Обрабатывает member фильтры и возвращает dialogIds
 * @param {object} memberFilters - Фильтры по участникам
 * @param {string} tenantId - ID тенанта
 * @returns {Promise<Array>} Массив dialogIds
 */
export async function processMemberFilters(memberFilters, tenantId) {
  if (!memberFilters || Object.keys(memberFilters).length === 0) {
    return null;
  }
  
  // Строим запрос к DialogMember
  const memberQuery = {
    tenantId: tenantId
  };

  // Обрабатываем фильтр member
  if (memberFilters.member) {
    const memberValue = memberFilters.member;
    
    if (typeof memberValue === 'string') {
      // Простое равенство: member = "carl"
      memberQuery.userId = memberValue;
    } else if (typeof memberValue === 'object') {
      // Сложные операторы: member = { $in: ["carl", "marta"] }
      if (memberValue.$in) {
        memberQuery.userId = { $in: memberValue.$in };
      } else if (memberValue.$ne) {
        memberQuery.userId = { $ne: memberValue.$ne };
      } else if (memberValue.$nin) {
        memberQuery.userId = { $nin: memberValue.$nin };
      } else if (memberValue.$all) {
        // Оператор $all требует специальной обработки
        // Найдем диалоги, где присутствуют ВСЕ указанные участники
        return await processAllMembersFilter(memberValue.$all, tenantId);
      } else {
        // Для других операторов используем как есть
        memberQuery.userId = memberValue;
      }
    }
  }

  // Выполняем запрос
  const members = await DialogMember.find(memberQuery).select('dialogId').lean();
  
  if (members.length === 0) {
    // Если нет участников, возвращаем пустой массив (никаких диалогов)
    return [];
  }

  return members.map(member => member.dialogId);
}

/**
 * Обрабатывает фильтр $all для участников
 * Находит диалоги, где присутствуют ВСЕ указанные участники
 * @param {Array} userIds - Массив ID участников
 * @param {string} tenantId - ID тенанта
 * @returns {Array} Массив ID диалогов
 */
async function processAllMembersFilter(userIds, tenantId) {
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return [];
  }
  
  // Найдем всех участников для указанных пользователей
  const allMembers = await DialogMember.find({
    tenantId: tenantId,
    userId: { $in: userIds }
  }).select('dialogId userId').lean();
  
  if (allMembers.length === 0) {
    return [];
  }
  
  // Группируем по dialogId
  const dialogMembers = {};
  allMembers.forEach(member => {
    if (!dialogMembers[member.dialogId]) {
      dialogMembers[member.dialogId] = [];
    }
    dialogMembers[member.dialogId].push(member.userId);
  });
  
  // Найдем диалоги, где присутствуют ВСЕ указанные участники
  const resultDialogIds = [];
  for (const [dialogId, members] of Object.entries(dialogMembers)) {
    // Проверяем, что в диалоге присутствуют ВСЕ указанные участники
    const hasAllMembers = userIds.every(userId => members.includes(userId));
    if (hasAllMembers) {
      resultDialogIds.push(dialogId);
    }
  }
  
  return resultDialogIds;
}

/**
 * Парсит строку сортировки для обычных полей
 * @param {string} sortString - Строка сортировки вида "(createdAt,desc)" или "(createdAt,asc)"
 * @returns {string|null} Строка для Mongoose sort (например, "-createdAt" или "createdAt") или null если невалидный формат
 */
export function parseSort(sortString) {
  if (!sortString || typeof sortString !== 'string') {
    return null;
  }

  // Убираем пробелы
  sortString = sortString.trim();

  // Проверяем формат: (field,direction)
  const sortRegex = /^\(([^,]+),([^)]+)\)$/;
  const match = sortString.match(sortRegex);

  if (!match) {
    return null;
  }

  const [, field, direction] = match;
  
  // Валидируем направление сортировки
  const validDirections = ['asc', 'desc', '1', '-1'];
  const normalizedDirection = direction.trim().toLowerCase();
  
  if (!validDirections.includes(normalizedDirection)) {
    return null;
  }

  // Конвертируем направление в Mongoose формат
  const fieldName = field.trim();
  const isDesc = normalizedDirection === 'desc' || normalizedDirection === '-1';
  
  return isDesc ? `-${fieldName}` : fieldName;
}

/**
 * Парсит строку сортировки для полей участников
 * @param {string} sortString - Строка сортировки вида "(member[carl].unreadCount,desc)"
 * @returns {object} Объект с информацией о сортировке
 */
export function parseMemberSort(sortString) {
  if (!sortString || typeof sortString !== 'string') {
    return null;
  }

  // Убираем пробелы
  sortString = sortString.trim();

  // Проверяем формат: (member[userId].field,direction)
  const memberSortRegex = /^\(member\[([^\]]+)\]\.([^,]+),([^)]+)\)$/;
  const match = sortString.match(memberSortRegex);

  if (!match) {
    return null;
  }

  const [, userId, field, direction] = match;
  
  // Валидируем направление сортировки
  const validDirections = ['asc', 'desc', '1', '-1'];
  const normalizedDirection = direction.toLowerCase();
  
  if (!validDirections.includes(normalizedDirection)) {
    return null;
  }

  // Конвертируем направление в MongoDB формат
  const mongoDirection = normalizedDirection === 'desc' || normalizedDirection === '-1' ? -1 : 1;

  return {
    userId: userId.trim(),
    field: field.trim(),
    direction: mongoDirection,
    originalString: sortString
  };
}

export default {
  parseFilter,
  parseFilters,
  extractMetaFilters,
  processMemberFilters,
  parseSort,
  parseMemberSort,
  operatorToMongo,
};

