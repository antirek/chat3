import {
  DEFAULT_MULTIPLEX_LIMITS,
  MultiplexActiveSet
} from '../multiplexActiveSet.js';

describe('MultiplexActiveSet', () => {
  test('U1 watch adds bind key', () => {
    const set = new MultiplexActiveSet();
    const r = set.watch('tnt', ['u1']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bindKeys).toEqual(['update.*.tnt.user.u1.*']);
    expect(r.watchedCount).toBe(1);
    expect(set.has('tnt', 'user', 'u1')).toBe(true);
  });

  test('U2 repeat watch bumps ref without second bind', () => {
    const set = new MultiplexActiveSet();
    set.watch('tnt', ['u1']);
    const r = set.watch('tnt', ['u1']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bindKeys).toEqual([]);
    expect(r.watchedCount).toBe(1);
  });

  test('U3 unwatch with ref>1 does not unbind', () => {
    const set = new MultiplexActiveSet();
    set.watch('tnt', ['u1']);
    set.watch('tnt', ['u1']);
    const r = set.unwatch('tnt', ['u1']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bindKeys).toEqual([]);
    expect(set.has('tnt', 'user', 'u1')).toBe(true);
  });

  test('U4 unwatch last ref unbinds', () => {
    const set = new MultiplexActiveSet();
    set.watch('tnt', ['u1']);
    const r = set.unwatch('tnt', ['u1']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bindKeys).toEqual(['update.*.tnt.user.u1.*']);
    expect(set.size).toBe(0);
  });

  test('U5 dedupe user_ids in batch', () => {
    const set = new MultiplexActiveSet();
    const r = set.watch('tnt', ['u1', 'u2', 'u1']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.userIds).toEqual(['u1', 'u2']);
    expect(r.bindKeys).toHaveLength(2);
    expect(set.size).toBe(2);
  });

  test('U6/U7 acceptsUpdate filter', () => {
    const set = new MultiplexActiveSet();
    set.watch('tnt', ['u1', 'u2']);
    expect(set.acceptsUpdate('tnt', 'u3')).toBe(false);
    expect(set.acceptsUpdate('tnt', 'u1')).toBe(true);
    expect(set.acceptsUpdate('other', 'u1')).toBe(false);
  });

  test('U8 empty tenant / user_ids errors', () => {
    const set = new MultiplexActiveSet();
    expect(set.watch('', ['u1']).ok).toBe(false);
    expect(set.watch('tnt', []).ok).toBe(false);
    expect(set.size).toBe(0);
  });

  test('U9 atomic reject on max keys', () => {
    const set = new MultiplexActiveSet({
      maxWatchedKeys: 2,
      maxUserIdsPerMessage: 100
    });
    expect(set.watch('tnt', ['a', 'b']).ok).toBe(true);
    const r = set.watch('tnt', ['c']);
    expect(r.ok).toBe(false);
    expect(set.size).toBe(2);
    expect(set.has('tnt', 'user', 'c')).toBe(false);
  });

  test('U10 idle keeps empty set (no auto-close — just size 0)', () => {
    const set = new MultiplexActiveSet();
    set.watch('tnt', ['u1']);
    set.unwatch('tnt', ['u1']);
    expect(set.size).toBe(0);
  });

  test('max user_ids per message', () => {
    const set = new MultiplexActiveSet({
      ...DEFAULT_MULTIPLEX_LIMITS,
      maxUserIdsPerMessage: 2
    });
    const r = set.watch('tnt', ['a', 'b', 'c']);
    expect(r.ok).toBe(false);
    expect(set.size).toBe(0);
  });
});
