import {
  allUpdatesBindKey,
  bindKeysForWatchScope,
  tenantUpdatesBindKey,
  userUpdatesBindKey,
  watchScopeKey
} from '../updateRoutingKeys.js';

describe('updateRoutingKeys', () => {
  test('user bind matches publish axis (tenantId, userType, userId)', () => {
    expect(userUpdatesBindKey('tnt_a', 'user', 'alice')).toBe(
      'update.*.tnt_a.user.alice.*'
    );
  });

  test('tenant firehose bind', () => {
    expect(tenantUpdatesBindKey('tnt_a')).toBe('update.*.tnt_a.*.*.*');
  });

  test('wildcard bind', () => {
    expect(allUpdatesBindKey()).toBe('update.*.*.*.*.*');
  });

  test('bindKeysForWatchScope user', () => {
    expect(
      bindKeysForWatchScope({
        kind: 'user',
        tenantId: 'tnt_a',
        userId: 'bob',
        userType: 'bot'
      })
    ).toEqual(['update.*.tnt_a.bot.bob.*']);
  });

  test('bindKeysForWatchScope tenants dedupes', () => {
    expect(
      bindKeysForWatchScope({
        kind: 'tenants',
        tenantIds: ['tnt_b', 'tnt_a', 'tnt_a', '']
      })
    ).toEqual(['update.*.tnt_b.*.*.*', 'update.*.tnt_a.*.*.*']);
  });

  test('bindKeysForWatchScope all', () => {
    expect(bindKeysForWatchScope({ kind: 'all' })).toEqual(['update.*.*.*.*.*']);
  });

  test('bindKeysForWatchScope tenants empty throws', () => {
    expect(() =>
      bindKeysForWatchScope({ kind: 'tenants', tenantIds: [] })
    ).toThrow(/non-empty/);
  });

  test('watchScopeKey stable for tenants order', () => {
    expect(
      watchScopeKey({ kind: 'tenants', tenantIds: ['tnt_b', 'tnt_a'] })
    ).toBe('tenants:tnt_a,tnt_b');
    expect(
      watchScopeKey({ kind: 'tenants', tenantIds: ['tnt_a', 'tnt_b'] })
    ).toBe('tenants:tnt_a,tnt_b');
  });
});
