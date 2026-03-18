/**
 * Утилиты для фильтрации и сортировки GET /api/users по полям stats (UserStats).
 * Белый список полей и маппинг в одном месте.
 */

/** Поля UserStats, допустимые в фильтре (stats.dialogCount и т.д.) и в sort */
export const ALLOWED_USER_STATS_KEYS = [
  'dialogCount',
  'unreadDialogsCount',
  'totalUnreadCount',
  'totalMessagesCount',
  'lastUpdatedAt',
  'createdAt'
] as const;

/** Поля коллекции User, допустимые в sort */
export const USER_SORT_ALLOWED_TOP_LEVEL = ['userId', 'tenantId', 'type', 'createdAt'] as const;

const STATS_KEYS_SET = new Set<string>(ALLOWED_USER_STATS_KEYS);
const USER_SORT_SET = new Set<string>(USER_SORT_ALLOWED_TOP_LEVEL);

export interface ExtractStatsFiltersResult {
  statsFilters: Record<string, unknown> | null;
  rest: Record<string, unknown>;
}

/**
 * Разделяет regularFilters на stats-условия и остальное (для User.find).
 * Ключ "stats" с объектом условий выносится в statsFilters, остальные ключи — в rest.
 */
export function extractStatsFilters(regularFilters: Record<string, unknown> | null): ExtractStatsFiltersResult {
  const rest: Record<string, unknown> = {};
  let statsFilters: Record<string, unknown> | null = null;

  if (!regularFilters || typeof regularFilters !== 'object') {
    return { statsFilters: null, rest };
  }

  for (const [key, value] of Object.entries(regularFilters)) {
    if (key === 'stats' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const statsObj = value as Record<string, unknown>;
      const allowed: Record<string, unknown> = {};
      for (const k of Object.keys(statsObj)) {
        if (STATS_KEYS_SET.has(k)) {
          allowed[k] = statsObj[k];
        }
      }
      if (Object.keys(allowed).length > 0) {
        statsFilters = allowed;
      }
    } else {
      rest[key] = value;
    }
  }

  return { statsFilters, rest };
}

/**
 * Строит запрос к коллекции UserStats по tenantId и условиям из stats-фильтра.
 */
export function buildUserStatsQuery(
  tenantId: string,
  statsFilters: Record<string, unknown>
): Record<string, unknown> {
  const query: Record<string, unknown> = { tenantId };
  for (const [key, value] of Object.entries(statsFilters)) {
    if (STATS_KEYS_SET.has(key)) {
      query[key] = value;
    }
  }
  return query;
}

/**
 * Проверяет, что все ключи в sort допустимы (поля User или stats.* из белого списка).
 * @returns null если валидно, иначе строку с сообщением об ошибке для 400.
 */
export function validateSort(sort: unknown): string | null {
  if (sort === null || sort === undefined) return null;
  if (typeof sort !== 'object' || Array.isArray(sort)) {
    return 'Sort must be a JSON object (e.g. {"createdAt":-1})';
  }
  const keys = Object.keys(sort as Record<string, unknown>);
  for (const key of keys) {
    if (key.startsWith('stats.')) {
      const statKey = key.slice(6);
      if (!STATS_KEYS_SET.has(statKey)) {
        return `Invalid sort field: '${key}'. Allowed stats fields: ${ALLOWED_USER_STATS_KEYS.join(', ')}`;
      }
    } else {
      if (!USER_SORT_SET.has(key)) {
        return `Invalid sort field: '${key}'. Allowed top-level fields: ${USER_SORT_ALLOWED_TOP_LEVEL.join(', ')}`;
      }
    }
  }
  return null;
}

/**
 * Возвращает true, если в sort есть хотя бы один ключ с префиксом stats.
 */
export function sortHasStatsKeys(sort: unknown): boolean {
  if (sort === null || typeof sort !== 'object' || Array.isArray(sort)) return false;
  return Object.keys(sort as Record<string, unknown>).some((k) => k.startsWith('stats.'));
}
