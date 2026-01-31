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

import { DialogMember } from '@chat3/models';
import type { FilterQuery } from 'mongoose';
import * as metaUtils from '@chat3/utils/metaUtils.js';

const MAX_GROUP_SIZE = 5;

export class FilterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FilterValidationError';
  }
}

type MongoQueryValue = string | number | boolean | null | RegExp | { [key: string]: any };
type MongoQuery = { [key: string]: MongoQueryValue | { [key: string]: any } };

interface RegexValue {
  pattern: string;
  options?: string;
}

interface MemberSortResult {
  userId: string;
  field: string;
  direction: 1 | -1;
  originalString: string;
}

interface ExtractedFilters {
  metaFilters: MongoQuery;
  regularFilters: MongoQuery;
  memberFilters: MongoQuery;
}

export type ExtractedFiltersResult = ExtractedFilters | { branches: ExtractedFilters[] };

/**
 * Парсит строку фильтра в MongoDB query
 * @param filterString - Строка фильтра вида "(field,operator,value)"
 * @returns MongoDB query объект
 */
export function parseFilter(filterString: string | undefined | null): MongoQuery {
  if (!filterString || typeof filterString !== 'string') {
    return {};
  }

  // Убираем пробелы
  let trimmedFilter = filterString.trim();
  trimmedFilter = stripInlineRegexFlags(trimmedFilter);

  // Если это старый JSON формат, парсим как JSON
  if (trimmedFilter.startsWith('{')) {
    try {
      return JSON.parse(trimmedFilter) as MongoQuery;
    } catch (_e) {
      throw new Error('Invalid JSON filter format');
    }
  }

  const result: MongoQuery = {};
  
  // Регулярка для парсинга: (field,operator,value)
  const filterRegex = /\(([^,]+),([^,]+),([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = filterRegex.exec(trimmedFilter)) !== null) {
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
      let current: any = result;
      
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
 * @param value - Строковое значение
 * @param fieldName - Имя поля для определения типа
 * @returns Распарсенное значение
 */
function parseValue(value: string, fieldName: string = ''): any {
  // Массив: [value1,value2,value3]
  if (value.startsWith('[') && value.endsWith(']')) {
    const items = value.slice(1, -1).split(',').map(v => v.trim());
    return items.map(item => parseScalarValue(item, fieldName));
  }

  return parseScalarValue(value, fieldName);
}

/**
 * Парсит скалярное значение
 * @param value - Строковое значение
 * @param fieldName - Имя поля для определения типа
 * @returns Распарсенное значение (число, boolean, строка, timestamp)
 */
function parseScalarValue(value: string, fieldName: string = ''): any {
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
 * @param value - Значение для проверки
 * @returns true если похоже на дату
 */
function isDateLike(value: string): boolean {
  // ISO формат: 2025-10-21, 2025-10-21T10:30:00, 2025-10-21T10:30:00Z, 2025-10-21T10:30:00.000Z
  const isoRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  return isoRegex.test(value);
}

/**
 * Конвертирует дату в timestamp (миллисекунды с микросекундной точностью)
 * @param dateStr - Строка с датой
 * @returns Timestamp или null если конвертация не удалась
 */
function dateToTimestamp(dateStr: string): number | null {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    // Возвращаем timestamp в миллисекундах (без дробной части, т.к. не знаем микросекунды)
    return date.getTime();
  } catch (e) {
    return null;
  }
}

/**
 * Преобразует оператор в MongoDB query
 * @param operator - Оператор (eq, ne, in, gt, etc.)
 * @param value - Значение
 * @returns MongoDB query
 */
function operatorToMongo(operator: string, value: any): any {
  const operators: { [key: string]: () => any } = {
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

function normalizeRegexValue(rawValue: string | RegExp): RegexValue {
  if (rawValue instanceof RegExp) {
    // В редких случаях значение уже могло быть RegExp
    const flags = rawValue.flags ? ensureCaseInsensitive(rawValue.flags) : 'i';
    return { pattern: rawValue.source, options: flags };
  }

  if (typeof rawValue !== 'string') {
    return { pattern: String(rawValue), options: 'i' };
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

function ensureCaseInsensitive(existingFlags: string): string {
  const flagsSet = new Set((existingFlags || '').split('').filter(Boolean));
  flagsSet.add('i');
  return Array.from(flagsSet).sort().join('');
}

function stripInlineRegexFlags(input: string): string {
  if (typeof input !== 'string' || input.indexOf('(?') === -1) {
    return input;
  }
  return input.replace(/\(\?[a-z]*i[a-z]*\)/gi, '');
}

/** Разделяет строку по разделителю только на глубине 0 (вне скобок). */
function splitAtDepth0(str: string, sep: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === sep && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Проверяет, есть ли на глубине 0 и & и | (смешанные операторы без скобок). */
function atDepth0HasBothAndOr(str: string): boolean {
  let hasAnd = false;
  let hasOr = false;
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (depth === 0) {
      if (char === '&') hasAnd = true;
      else if (char === '|') hasOr = true;
    }
    if (hasAnd && hasOr) return true;
  }
  return false;
}

/** Если строка целиком в одной паре скобок ( ... ), возвращает внутреннюю часть. */
function stripOuterParens(str: string): string {
  const s = str.trim();
  if (s.length < 2 || s[0] !== '(') return s;
  let depth = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return i === s.length - 1 ? s.slice(1, -1).trim() : s;
    }
  }
  return s;
}

/** Проверяет, что строка — одна сбалансированная пара скобок ( ... ). */
function isSingleBalancedParens(str: string): boolean {
  const s = str.trim();
  if (s.length < 2 || s[0] !== '(') return false;
  let depth = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return i === s.length - 1;
    }
  }
  return false;
}

/** Объединяет несколько MongoQuery в один (при конфликте ключей — в $and). */
function mergeAndOperands(queries: MongoQuery[]): MongoQuery {
  const result: MongoQuery = {};
  for (const q of queries) {
    for (const [key, value] of Object.entries(q)) {
      if (result[key]) {
        if (!result.$and) result.$and = [];
        (result.$and as any[]).push({ [key]: value });
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/** Парсит один операнд: либо группа ( ... ) с рекурсией, либо атом через parseFilter. */
function parseOneOperand(part: string): MongoQuery {
  const p = part.trim();
  if (isSingleBalancedParens(p)) {
    const inner = stripOuterParens(p);
    if (atDepth0HasBothAndOr(inner)) {
      throw new FilterValidationError('Filter validation failed: use parentheses to group when mixing & and |');
    }
    // Если внутри нет & и | — это один атом (field,op,value), парсим со скобками
    if (!/[&|]/.test(inner)) {
      return parseFilter(p);
    }
    return parseFiltersInternal(inner);
  }
  return parseFilter(p);
}

function parseFiltersInternal(filterString: string): MongoQuery {
  const trimmed = filterString.trim();
  if (!trimmed) return {};

  // На глубине 0 не допускаем смешивание & и |
  if (atDepth0HasBothAndOr(trimmed)) {
    throw new FilterValidationError('Filter validation failed: use parentheses to group when mixing & and |');
  }

  const orParts = splitAtDepth0(trimmed, '|');
  if (orParts.length > 1) {
    if (orParts.length > MAX_GROUP_SIZE) {
      throw new FilterValidationError(`Filter validation failed: too many OR branches (max ${MAX_GROUP_SIZE})`);
    }
    const branches = orParts.map(parseOneOperand);
    return { $or: branches };
  }

  const andParts = splitAtDepth0(trimmed, '&');
  if (andParts.length > MAX_GROUP_SIZE) {
    throw new FilterValidationError(`Filter validation failed: too many conditions in group (max ${MAX_GROUP_SIZE})`);
  }
  if (andParts.length === 1) {
    return parseOneOperand(andParts[0]);
  }
  const andQueries = andParts.map(parseOneOperand);
  return mergeAndOperands(andQueries);
}

/**
 * Парсит множественные фильтры, разделенные & и |
 * Группировка только скобками; внутри одной группы — один тип оператора (& или |).
 * Лимит 5 на число веток $or и операндов в группе.
 * @param filterString - Строка с фильтрами
 * @returns Объединенный MongoDB query
 */
export function parseFilters(filterString: string | undefined | null): MongoQuery {
  if (!filterString || typeof filterString !== 'string') {
    return {};
  }

  const trimmed = filterString.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as MongoQuery;
    } catch (_e) {
      throw new Error('Invalid JSON filter format');
    }
  }

  let normalized = trimmed;
  if (isSingleBalancedParens(trimmed)) {
    const inner = stripOuterParens(trimmed);
    if (/[&|]/.test(inner)) normalized = inner;
  }
  return parseFiltersInternal(normalized);
}

/**
 * Извлекает meta фильтры из общего фильтра.
 * При наличии $or возвращает { branches: ExtractedFilters[] } для сборки запроса по веткам.
 * @param filter - Фильтр объект
 * @returns Объект с разделенными фильтрами или ветки при $or
 */
export function extractMetaFilters(filter: MongoQuery): ExtractedFiltersResult {
  if (filter.$or && Array.isArray(filter.$or)) {
    const branches = (filter.$or as MongoQuery[]).map((branch) => extractMetaFilters(branch) as ExtractedFilters);
    return { branches };
  }

  const metaFilters: MongoQuery = {};
  const regularFilters: MongoQuery = {};
  const memberFilters: MongoQuery = {};

  for (const [key, value] of Object.entries(filter)) {
    if (key === 'meta') {
      // Старый формат: { meta: { type: "internal" } }
      Object.assign(metaFilters, value as MongoQuery);
    } else if (key.startsWith('meta.')) {
      // Новый формат: { "meta.type": "internal" }
      const metaKey = key.substring(5); // Убираем "meta."
      metaFilters[metaKey] = value;
    } else if (key === 'topic' && typeof value === 'object' && value !== null) {
      // Обрабатываем topic фильтры
      const topicFilters = { ...(value as MongoQuery) };
      
      // topic.meta.* фильтры должны попадать в metaFilters с префиксом "topic.meta."
      if ((value as any).meta && typeof (value as any).meta === 'object') {
        for (const [metaKey, metaValue] of Object.entries((value as any).meta)) {
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
      // Обрабатываем $and массив (элементы $and не содержат $or на верхнем уровне)
      for (const andCondition of value as MongoQuery[]) {
        const extractedAnd = extractMetaFilters(andCondition) as ExtractedFilters;
        const { metaFilters: nestedMeta, memberFilters: nestedMember, regularFilters: nestedRegular } = extractedAnd;
        Object.assign(metaFilters, nestedMeta);
        Object.assign(memberFilters, nestedMember);
        // Обрабатываем nested regularFilters для topic.meta.*
        if ((nestedRegular.topic as any)?.meta) {
          for (const [metaKey, metaValue] of Object.entries((nestedRegular.topic as any).meta)) {
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

export type EntityTypeForFilter = 'topic' | 'message' | 'dialog' | 'user' | 'dialogMember' | 'tenant';

/**
 * Собирает итоговый MongoDB-запрос из распарсенных фильтров с учётом meta по веткам.
 * При $or каждая ветка обрабатывается отдельно (regular + buildMetaQuery), member в ветках не поддерживается.
 * @param tenantId - ID тенанта
 * @param entityType - Тип сущности для meta-запроса
 * @param parsedFilters - Результат parseFilters
 * @returns Итоговый query для find/countDocuments
 */
export async function buildFilterQuery(
  tenantId: string,
  entityType: EntityTypeForFilter,
  parsedFilters: MongoQuery
): Promise<MongoQuery> {
  const extracted = extractMetaFilters(parsedFilters);

  if ('branches' in extracted) {
    const branchQueries: MongoQuery[] = [];
    for (const branch of extracted.branches) {
      const query: MongoQuery = { ...branch.regularFilters };
      if (Object.keys(branch.metaFilters).length > 0) {
        const metaQuery = await metaUtils.buildMetaQuery(tenantId, entityType as any, branch.metaFilters);
        if (metaQuery) Object.assign(query, metaQuery);
      }
      branchQueries.push(query);
    }
    return { $or: branchQueries };
  }

  const query: MongoQuery = { ...extracted.regularFilters };
  if (Object.keys(extracted.metaFilters).length > 0) {
    const metaQuery = await metaUtils.buildMetaQuery(tenantId, entityType as any, extracted.metaFilters);
    if (metaQuery) Object.assign(query, metaQuery);
  }
  return query;
}

/**
 * Обрабатывает member фильтры и возвращает dialogIds
 * @param memberFilters - Фильтры по участникам
 * @param tenantId - ID тенанта
 * @returns Массив dialogIds
 */
export async function processMemberFilters(memberFilters: MongoQuery, tenantId: string): Promise<string[] | null> {
  if (!memberFilters || Object.keys(memberFilters).length === 0) {
    return null;
  }
  
  // Строим запрос к DialogMember
  const memberQuery: FilterQuery<any> = {
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
      const memberObj = memberValue as any;
      if (memberObj.$in) {
        memberQuery.userId = { $in: memberObj.$in };
      } else if (memberObj.$ne) {
        memberQuery.userId = { $ne: memberObj.$ne };
      } else if (memberObj.$nin) {
        memberQuery.userId = { $nin: memberObj.$nin };
      } else if (memberObj.$all) {
        // Оператор $all требует специальной обработки
        // Найдем диалоги, где присутствуют ВСЕ указанные участники
        return await processAllMembersFilter(memberObj.$all, tenantId);
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
 * @param userIds - Массив ID участников
 * @param tenantId - ID тенанта
 * @returns Массив ID диалогов
 */
async function processAllMembersFilter(userIds: string[], tenantId: string): Promise<string[]> {
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
  const dialogMembers: { [dialogId: string]: string[] } = {};
  allMembers.forEach(member => {
    const dialogId = String(member.dialogId);
    if (!dialogMembers[dialogId]) {
      dialogMembers[dialogId] = [];
    }
    dialogMembers[dialogId].push(String(member.userId));
  });
  
  // Найдем диалоги, где присутствуют ВСЕ указанные участники
  const resultDialogIds: string[] = [];
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
 * @param sortString - Строка сортировки вида "(createdAt,desc)" или "(createdAt,asc)"
 * @returns Строка для Mongoose sort (например, "-createdAt" или "createdAt") или null если невалидный формат
 */
export function parseSort(sortString: string | undefined | null): string | null {
  if (!sortString || typeof sortString !== 'string') {
    return null;
  }

  // Убираем пробелы
  const trimmed = sortString.trim();

  // Проверяем формат: (field,direction)
  const sortRegex = /^\(([^,]+),([^)]+)\)$/;
  const match = trimmed.match(sortRegex);

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
 * @param sortString - Строка сортировки вида "(member[carl].unreadCount,desc)"
 * @returns Объект с информацией о сортировке
 */
export function parseMemberSort(sortString: string | undefined | null): MemberSortResult | null {
  if (!sortString || typeof sortString !== 'string') {
    return null;
  }

  // Убираем пробелы
  const trimmed = sortString.trim();

  // Проверяем формат: (member[userId].field,direction)
  const memberSortRegex = /^\(member\[([^\]]+)\]\.([^,]+),([^)]+)\)$/;
  const match = trimmed.match(memberSortRegex);

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
  const mongoDirection: 1 | -1 = normalizedDirection === 'desc' || normalizedDirection === '-1' ? -1 : 1;

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
  buildFilterQuery,
  processMemberFilters,
  parseSort,
  parseMemberSort,
  operatorToMongo,
  FilterValidationError,
};
