import { encodePackMessagesCursor, decodePackMessagesCursor } from '../packMessageUtils.js';

describe('packMessageUtils cursor helpers', () => {
  test('encodePackMessagesCursor and decodePackMessagesCursor round trip', () => {
    const createdAt = 1737391234.123456;
    const messageId = 'msg_test123456789012';

    const encoded = encodePackMessagesCursor(createdAt, messageId);
    expect(typeof encoded).toBe('string');
    expect(encoded).not.toContain('|'); // закодировано

    const decoded = decodePackMessagesCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.createdAt).toBe(createdAt);
    expect(decoded?.messageId).toBe(messageId);
  });

  test('decodePackMessagesCursor returns null for invalid payload', () => {
    expect(decodePackMessagesCursor(undefined)).toBeNull();
    expect(decodePackMessagesCursor(null)).toBeNull();
    expect(decodePackMessagesCursor('not-base64')).toBeNull();
    expect(decodePackMessagesCursor(Buffer.from('invalid-format', 'utf8').toString('base64'))).toBeNull();
  });
});
