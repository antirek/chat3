import {
  toApiTimestampString,
  toGrpcMicros,
  fromGrpcMicros
} from '../timestampUtils.js';

describe('toApiTimestampString / toGrpcMicros / fromGrpcMicros', () => {
  test('formats storage number as ms.micros string', () => {
    expect(toApiTimestampString(1730891234567.123456)).toMatch(/^\d+\.\d{6}$/);
    expect(toApiTimestampString(1730891234567)).toBe('1730891234567.000000');
  });

  test('toGrpcMicros returns decimal string (beyond MAX_SAFE_INTEGER)', () => {
    const storage = 1730891234567.123456;
    const s = toApiTimestampString(storage);
    const [ms, frac] = s.split('.');
    const expected = (BigInt(ms) * 1000000n + BigInt(frac)).toString();
    expect(toGrpcMicros(storage)).toBe(expected);
    expect(toGrpcMicros(s)).toBe(expected);
    expect(BigInt(toGrpcMicros(storage))).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
  });

  test('round-trip preserves toFixed(6) representation', () => {
    const storage = 1730891234567.123456;
    const s = toApiTimestampString(storage);
    const us = toGrpcMicros(storage);
    const back = fromGrpcMicros(us);
    expect(toApiTimestampString(back)).toBe(s);
  });

  test('small values still work; fromGrpcMicros accepts number/string/bigint', () => {
    expect(toGrpcMicros(1000)).toBe('1000000000');
    const us = toGrpcMicros(1000.5);
    expect(fromGrpcMicros(us)).toBe(fromGrpcMicros(BigInt(us)));
    // number path only safe for small µs (tests / synthetic)
    expect(fromGrpcMicros(Number(us))).toBe(fromGrpcMicros(us));
  });

  test('empty / invalid → 0', () => {
    expect(toGrpcMicros(null)).toBe('0');
    expect(toGrpcMicros(undefined)).toBe('0');
    expect(fromGrpcMicros(null)).toBe(0);
    expect(fromGrpcMicros('nope')).toBe(0);
  });
});
