import {
  ALLOWED_USER_STATS_KEYS,
  USER_SORT_ALLOWED_TOP_LEVEL,
  extractStatsFilters,
  buildUserStatsQuery,
  validateSort,
  sortHasStatsKeys
} from '../userStatsFilterUtils.js';

describe('userStatsFilterUtils', () => {
  describe('extractStatsFilters', () => {
    test('returns null statsFilters and empty rest for null input', () => {
      const result = extractStatsFilters(null);
      expect(result.statsFilters).toBeNull();
      expect(result.rest).toEqual({});
    });

    test('returns null statsFilters and empty rest for empty object', () => {
      const result = extractStatsFilters({});
      expect(result.statsFilters).toBeNull();
      expect(result.rest).toEqual({});
    });

    test('extracts stats object and leaves rest empty when only stats', () => {
      const result = extractStatsFilters({
        stats: { dialogCount: { $gte: 1 } }
      });
      expect(result.statsFilters).toEqual({ dialogCount: { $gte: 1 } });
      expect(result.rest).toEqual({});
    });

    test('puts type in rest and stats in statsFilters', () => {
      const result = extractStatsFilters({
        type: 'user',
        stats: { dialogCount: { $gte: 1 } }
      });
      expect(result.statsFilters).toEqual({ dialogCount: { $gte: 1 } });
      expect(result.rest).toEqual({ type: 'user' });
    });

    test('ignores disallowed keys inside stats', () => {
      const result = extractStatsFilters({
        stats: {
          dialogCount: { $gte: 1 },
          unknownField: { $eq: 1 }
        }
      });
      expect(result.statsFilters).toEqual({ dialogCount: { $gte: 1 } });
    });

    test('returns null statsFilters when stats has only disallowed keys', () => {
      const result = extractStatsFilters({
        stats: { unknownField: 1 }
      });
      expect(result.statsFilters).toBeNull();
      expect(result.rest).toEqual({});
    });

    test('does not treat non-object stats as stats filter', () => {
      const result = extractStatsFilters({ stats: 'string' });
      expect(result.statsFilters).toBeNull();
      expect(result.rest).toEqual({ stats: 'string' });
    });
  });

  describe('buildUserStatsQuery', () => {
    test('returns tenantId and allowed stats conditions', () => {
      const query = buildUserStatsQuery('tnt_default', {
        dialogCount: { $gte: 1 },
        unreadDialogsCount: { $lte: 5 }
      });
      expect(query).toEqual({
        tenantId: 'tnt_default',
        dialogCount: { $gte: 1 },
        unreadDialogsCount: { $lte: 5 }
      });
    });

    test('ignores disallowed keys in statsFilters', () => {
      const query = buildUserStatsQuery('tnt_1', {
        dialogCount: 1,
        invalidKey: 2
      });
      expect(query).toEqual({ tenantId: 'tnt_1', dialogCount: 1 });
    });
  });

  describe('validateSort', () => {
    test('returns null for null or undefined', () => {
      expect(validateSort(null)).toBeNull();
      expect(validateSort(undefined)).toBeNull();
    });

    test('returns error for non-object sort', () => {
      expect(validateSort('string')).toMatch(/Sort must be a JSON object/);
      expect(validateSort(123)).toMatch(/Sort must be a JSON object/);
      expect(validateSort([])).toMatch(/Sort must be a JSON object/);
    });

    test('returns null for valid top-level only sort', () => {
      expect(validateSort({ createdAt: -1 })).toBeNull();
      expect(validateSort({ userId: 1, type: -1 })).toBeNull();
    });

    test('returns null for valid stats sort', () => {
      expect(validateSort({ 'stats.dialogCount': -1 })).toBeNull();
      expect(validateSort({ 'stats.totalUnreadCount': 1 })).toBeNull();
    });

    test('returns error for invalid stats field', () => {
      const err = validateSort({ 'stats.dialogCountt': -1 });
      expect(err).toMatch(/Invalid sort field/);
      expect(err).toMatch(/stats.dialogCountt/);
      expect(err).toMatch(/Allowed stats fields/);
    });

    test('returns error for invalid top-level field', () => {
      const err = validateSort({ unknownField: -1 });
      expect(err).toMatch(/Invalid sort field/);
      expect(err).toMatch(/Allowed top-level fields/);
    });
  });

  describe('sortHasStatsKeys', () => {
    test('returns false for null or non-object', () => {
      expect(sortHasStatsKeys(null)).toBe(false);
      expect(sortHasStatsKeys(undefined)).toBe(false);
      expect(sortHasStatsKeys([])).toBe(false);
    });

    test('returns false when no stats keys', () => {
      expect(sortHasStatsKeys({ createdAt: -1 })).toBe(false);
      expect(sortHasStatsKeys({ userId: 1 })).toBe(false);
    });

    test('returns true when sort has stats key', () => {
      expect(sortHasStatsKeys({ 'stats.dialogCount': -1 })).toBe(true);
      expect(sortHasStatsKeys({ createdAt: 1, 'stats.totalUnreadCount': -1 })).toBe(true);
    });
  });

  describe('constants', () => {
    test('ALLOWED_USER_STATS_KEYS includes expected fields', () => {
      expect(ALLOWED_USER_STATS_KEYS).toContain('dialogCount');
      expect(ALLOWED_USER_STATS_KEYS).toContain('unreadDialogsCount');
      expect(ALLOWED_USER_STATS_KEYS).toContain('totalUnreadCount');
      expect(ALLOWED_USER_STATS_KEYS).toContain('totalMessagesCount');
    });

    test('USER_SORT_ALLOWED_TOP_LEVEL includes User fields', () => {
      expect(USER_SORT_ALLOWED_TOP_LEVEL).toContain('userId');
      expect(USER_SORT_ALLOWED_TOP_LEVEL).toContain('createdAt');
      expect(USER_SORT_ALLOWED_TOP_LEVEL).toContain('type');
    });
  });
});
