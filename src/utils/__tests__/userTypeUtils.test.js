import { extractUserType } from '../userTypeUtils.js';

describe('userTypeUtils', () => {
  describe('extractUserType', () => {
    test('extracts type from userId with prefix', () => {
      expect(extractUserType('usr_123')).toBe('usr');
      expect(extractUserType('cnt_456')).toBe('cnt');
      expect(extractUserType('bot_789')).toBe('bot');
    });

    test('extracts type only up to first underscore', () => {
      expect(extractUserType('usr_abc_def')).toBe('usr');
      expect(extractUserType('cnt_123_456')).toBe('cnt');
      expect(extractUserType('bot_test_more')).toBe('bot');
    });

    test('returns usr as default when no underscore', () => {
      expect(extractUserType('carl')).toBe('usr');
      expect(extractUserType('marta')).toBe('usr');
      expect(extractUserType('john')).toBe('usr');
    });

    test('returns usr for empty string', () => {
      expect(extractUserType('')).toBe('usr');
    });

    test('returns usr for null', () => {
      expect(extractUserType(null)).toBe('usr');
    });

    test('returns usr for undefined', () => {
      expect(extractUserType(undefined)).toBe('usr');
    });

    test('returns usr for non-string values', () => {
      expect(extractUserType(123)).toBe('usr');
      expect(extractUserType({})).toBe('usr');
      expect(extractUserType([])).toBe('usr');
    });

    test('handles various prefix types', () => {
      expect(extractUserType('admin_1')).toBe('admin');
      expect(extractUserType('guest_2')).toBe('guest');
      expect(extractUserType('api_3')).toBe('api');
      expect(extractUserType('test_4')).toBe('test');
    });

    test('handles userId starting with underscore', () => {
      expect(extractUserType('_user123')).toBe('');
      // Пустая строка до первого подчеркивания, но это edge case
      // В реальности такого не должно быть, но функция должна корректно обработать
    });

    test('handles userId with only underscore', () => {
      expect(extractUserType('_')).toBe('');
    });
  });
});

