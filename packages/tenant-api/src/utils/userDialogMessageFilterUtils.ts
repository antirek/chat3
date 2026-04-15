/**
 * Фильтр message.createdAt для GET /api/users/:userId/dialogs (строковый filter).
 * См. packages/tenant-api/docs/plan-message-createdAt-filter-user-dialogs.md
 */

const MS_24H = 24 * 60 * 60 * 1000;
/** Значения &lt; этого порога считаем unix-секундами и переводим в миллисекунды. */
const SECONDS_VS_MS_THRESHOLD = 1e12;

export const MSG_OR_WITH_MESSAGE =
  'Условия по сообщениям (message.*) несовместимы с оператором ИЛИ (|) в фильтре; используйте только &.';

export type MongoQuery = Record<string, any>;

function normalizeTimestampOperand(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return NaN;
  }
  if (value < SECONDS_VS_MS_THRESHOLD) {
    return value * 1000;
  }
  return value;
}

function treeHasMessageKey(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const o = node as MongoQuery;
  if ('message' in o && o.message != null) return true;
  if (Array.isArray(o.$and) && o.$and.some((x) => treeHasMessageKey(x))) return true;
  if (Array.isArray(o.$or) && o.$or.some((x) => treeHasMessageKey(x))) return true;
  return false;
}

function filterHasTopLevelOr(obj: unknown): boolean {
  return Boolean(obj && typeof obj === 'object' && Array.isArray((obj as MongoQuery).$or));
}

/** Возвращает текст ошибки или null, если всё ок. */
export function assertFilterNotOrWithMessage(parsed: MongoQuery): string | null {
  if (!filterHasTopLevelOr(parsed)) return null;
  if (treeHasMessageKey(parsed)) return MSG_OR_WITH_MESSAGE;
  return null;
}

function normalizeCreatedAtFragment(cond: unknown): Record<string, number> | null {
  if (cond === undefined || cond === null) return null;
  if (typeof cond !== 'object' || Array.isArray(cond)) return null;
  const out: Record<string, number> = {};
  for (const op of ['$gte', '$lte', '$gt', '$lt', '$eq'] as const) {
    if (op in (cond as object)) {
      const n = normalizeTimestampOperand((cond as any)[op]);
      if (Number.isNaN(n)) return null;
      out[op] = n;
    }
  }
  return Object.keys(out).length ? out : null;
}

function mergeCreatedAtFragments(fragments: Record<string, number>[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const f of fragments) {
    for (const [op, val] of Object.entries(f)) {
      if (m[op] === undefined) {
        m[op] = val;
      } else if (op === '$gte' || op === '$gt' || op === '$eq') {
        m[op] = Math.max(m[op], val);
      } else if (op === '$lte' || op === '$lt') {
        m[op] = Math.min(m[op], val);
      }
    }
  }
  return m;
}

function collectMessageCreatedAtFragments(node: unknown, fragments: Record<string, number>[], errors: string[]): void {
  if (!node || typeof node !== 'object') return;
  const o = node as MongoQuery;
  if (o.message != null && typeof o.message === 'object') {
    const msg = o.message as MongoQuery;
    const keys = Object.keys(msg);
    for (const k of keys) {
      if (k !== 'createdAt') {
        errors.push(`Неподдерживаемое поле в фильтре: message.${k}`);
        return;
      }
    }
    const frag = normalizeCreatedAtFragment(msg.createdAt);
    if (frag && Object.keys(frag).length) {
      fragments.push(frag);
    }
  }
  if (Array.isArray(o.$and)) {
    for (const sub of o.$and) {
      collectMessageCreatedAtFragments(sub, fragments, errors);
    }
  }
}

/** Проверка: две конечные границы → разница не больше 24 ч (в миллисекундах). */
export function validateMessageCreatedAt24HourWindow(cond: Record<string, number>): string | null {
  if (cond.$eq !== undefined) {
    return null;
  }
  let lower: number | null = null;
  let upper: number | null = null;
  if (cond.$gte !== undefined) lower = cond.$gte;
  if (cond.$gt !== undefined) {
    lower = lower === null ? cond.$gt : Math.max(lower, cond.$gt);
  }
  if (cond.$lte !== undefined) upper = cond.$lte;
  if (cond.$lt !== undefined) {
    upper = upper === null ? cond.$lt : Math.min(upper, cond.$lt);
  }
  if (lower !== null && upper !== null) {
    if (upper - lower > MS_24H) {
      return 'Интервал по message.createdAt не должен превышать 24 часа.';
    }
  }
  return null;
}

export type CollectMessageCreatedAtResult =
  | { ok: true; createdAt: Record<string, number> | null }
  | { ok: false; errorMessage: string };

/**
 * Собирает условие по Message.createdAt из дерева parseFilters (включая $and с дублирующим message).
 */
export function collectMessageCreatedAtCondition(rawParsed: MongoQuery): CollectMessageCreatedAtResult {
  const fragments: Record<string, number>[] = [];
  const errors: string[] = [];
  collectMessageCreatedAtFragments(rawParsed, fragments, errors);
  if (errors.length) {
    return { ok: false, errorMessage: errors[0] };
  }
  if (fragments.length === 0) {
    return { ok: true, createdAt: null };
  }
  const merged = mergeCreatedAtFragments(fragments);
  const winErr = validateMessageCreatedAt24HourWindow(merged);
  if (winErr) {
    return { ok: false, errorMessage: winErr };
  }
  return { ok: true, createdAt: merged };
}

/**
 * Удаляет из фильтра блоки message, чтобы extractMetaFilters не протаскивал их в DialogMember.
 */
export function stripMessageFilterFromParsed(input: MongoQuery): MongoQuery {
  if (!input || typeof input !== 'object') return {};
  const out: MongoQuery = { ...input };
  delete out.message;
  if (Array.isArray(out.$and)) {
    const filtered = (out.$and as MongoQuery[])
      .map((sub) => stripMessageFilterFromParsed(sub as MongoQuery))
      .filter((sub) => sub && typeof sub === 'object' && Object.keys(sub).length > 0);
    if (filtered.length === 0) {
      delete out.$and;
    } else {
      out.$and = filtered;
    }
  }
  return out;
}
