/**
 * Удаляет поля _id, id и __v из объекта и всех его вложенных объектов;
 * timestamps из TIMESTAMP_FIELDS → строки с 6 знаками после точки (микросекунды).
 */

/** Поля-timestamps на HTTP/Rabbit/Controlo egress → string `"ms.micros"`. */
export const TIMESTAMP_FIELDS = [
  'createdAt',
  'lastSeenAt',
  'lastMessageAt',
  'lastInteractionAt',
  'publishedAt',
  'expiresAt',
  'expireAt',
  'lastUsedAt',
  'readAt',
  'deliveredAt',
  'joinedAt',
  'lastUpdatedAt',
  'lastActivityAt',
  'addedAt',
  'deletedAt',
  'editedAt',
  'updatedAt',
  'processedAt',
  'startedAt',
  'finishedAt',
  'claimedAt',
  'lastProcessedAt',
  'statusTime',
  'reactionTime'
] as const;

export type TimestampField = (typeof TIMESTAMP_FIELDS)[number];

export type SanitizeResponseOptions = {
  /** Controlo DB Explorer: сохранить `_id` (и не трогать `id`), timestamps всё равно в string. */
  keepId?: boolean;
};

/** Приводит значение timestamp к строке с 6 знаками после точки */
export function formatTimestampValue(value: unknown): string | undefined {
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

function isTimestampField(key: string): key is TimestampField {
  return (TIMESTAMP_FIELDS as readonly string[]).includes(key);
}

export function removeIdFields(
  obj: unknown,
  options: SanitizeResponseOptions = {}
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removeIdFields(item, options));
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return obj;
  }

  const objAny = obj as {
    _bsontype?: string;
    constructor?: { name?: string };
    toString?: () => string;
  };
  const ctorName = objAny.constructor?.name;
  if (
    objAny._bsontype === 'ObjectID' ||
    objAny._bsontype === 'ObjectId' ||
    ctorName === 'ObjectID' ||
    ctorName === 'ObjectId'
  ) {
    return objAny.toString?.() || String(obj);
  }

  if (obj instanceof Buffer) {
    return obj;
  }

  // Plain-object (и null-prototype). Не сравниваем proto === Object.prototype по ссылке:
  // в Jest/VM modules structuredClone даёт объект с Object.prototype другого realm.
  const proto = Object.getPrototypeOf(obj);
  const isPlainObject =
    proto === null ||
    proto === Object.prototype ||
    proto?.constructor?.name === 'Object';
  if (!isPlainObject) {
    return obj;
  }

  const result: Record<string, unknown> = {};
  const objRecord = obj as Record<string, unknown>;
  const keepId = options.keepId === true;

  const isUserObject =
    objRecord.userId !== undefined && objRecord.tenantId !== undefined;

  for (const [key, value] of Object.entries(objRecord)) {
    if (key === '__v') {
      continue;
    }
    if (!keepId && (key === '_id' || key === 'id')) {
      continue;
    }

    if (value === null) {
      continue;
    }

    if (key === 'name' && isUserObject) {
      continue;
    }

    if (isTimestampField(key)) {
      const formatted = formatTimestampValue(value);
      if (formatted !== undefined) {
        result[key] = formatted;
        continue;
      }
    }

    const processed = removeIdFields(value, options);
    if (processed === null) {
      continue;
    }
    result[key] = processed;
  }

  return result;
}

/**
 * Очищает объект ответа от полей _id, id и __v перед отправкой клиенту
 * и форматирует TIMESTAMP_FIELDS строками с µs.
 */
export function sanitizeResponse(
  data: unknown,
  options: SanitizeResponseOptions = {}
): unknown {
  return removeIdFields(data, options);
}

/**
 * JSON.stringify replacer для форматирования timestamps строками с 6 знаками после точки
 * Использовать: JSON.stringify(data, timestampReplacer)
 */
export function timestampReplacer(key: string, value: unknown): unknown {
  if (isTimestampField(key)) {
    const formatted = formatTimestampValue(value);
    if (formatted !== undefined) return formatted;
  }
  return value;
}
