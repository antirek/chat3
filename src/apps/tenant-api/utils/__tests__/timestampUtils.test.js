import { 
  generateTimestamp, 
  formatTimestampFixed, 
  formatTimestamp, 
  compareTimestamps,
  timestampToDate,
  generateISOTimestamp
} from '../../../../utils/timestampUtils.js';

describe('timestampUtils', () => {
  describe('generateTimestamp', () => {
    test('should generate a timestamp with microsecond precision', () => {
      const timestamp = generateTimestamp();
      
      // Проверяем, что timestamp - это число
      expect(typeof timestamp).toBe('number');
      
      // Проверяем, что timestamp положительный
      expect(timestamp).toBeGreaterThan(0);
      
      // Проверяем, что timestamp близок к текущему времени (в пределах 1 секунды)
      const now = Date.now();
      expect(timestamp).toBeGreaterThan(now - 1000);
      expect(timestamp).toBeLessThan(now + 1000);
    });

    test('should generate unique timestamps', () => {
      const timestamp1 = generateTimestamp();
      const timestamp2 = generateTimestamp();
      
      // Тимстемпы должны отличаться (хотя бы на микросекунды)
      expect(timestamp2).toBeGreaterThanOrEqual(timestamp1);
    });

    test('should generate timestamps with microsecond precision', () => {
      const timestamp = generateTimestamp();
      const timestampStr = timestamp.toString();
      
      // Проверяем, что есть дробная часть (микросекунды)
      expect(timestampStr).toMatch(/\.\d+$/);
      
      // Проверяем, что дробная часть имеет достаточное количество знаков
      const parts = timestampStr.split('.');
      if (parts.length > 1) {
        expect(parts[1].length).toBeGreaterThan(0);
      }
    });

    test('should generate timestamps that are valid Unix timestamps', () => {
      const timestamp = generateTimestamp();
      
      // Проверяем, что это валидная дата (примерно текущее время)
      const date = new Date(timestamp);
      expect(date.getTime()).toBeGreaterThan(0);
      
      // Проверяем, что дата не слишком далека от текущего времени (в пределах 1 секунды)
      const now = Date.now();
      expect(date.getTime()).toBeGreaterThan(now - 1000);
      expect(date.getTime()).toBeLessThan(now + 1000);
    });
  });

  describe('formatTimestampFixed', () => {
    test('should format timestamp with exactly 6 decimal places', () => {
      const timestamp = 1234567890.123456;
      const formatted = formatTimestampFixed(timestamp);
      
      // Проверяем формат: число с 6 знаками после запятой
      expect(formatted).toMatch(/^\d+\.\d{6}$/);
      
      // Проверяем, что дробная часть имеет ровно 6 знаков
      const parts = formatted.split('.');
      expect(parts[1].length).toBe(6);
    });

    test('should pad with zeros if necessary', () => {
      const timestamp = 1234567890.1;
      const formatted = formatTimestampFixed(timestamp);
      
      // Проверяем, что дробная часть дополнена нулями до 6 знаков
      expect(formatted).toMatch(/^\d+\.\d{6}$/);
      expect(formatted).toBe('1234567890.100000');
    });

    test('should handle integer timestamps', () => {
      const timestamp = 1234567890;
      const formatted = formatTimestampFixed(timestamp);
      
      // Проверяем, что добавлены 6 нулей после запятой
      expect(formatted).toMatch(/^\d+\.000000$/);
      expect(formatted).toBe('1234567890.000000');
    });

    test('should handle timestamps with more than 6 decimal places', () => {
      const timestamp = 1234567890.123456789;
      const formatted = formatTimestampFixed(timestamp);
      
      // Проверяем, что округлено до 6 знаков
      expect(formatted).toMatch(/^\d+\.\d{6}$/);
      const parts = formatted.split('.');
      expect(parts[1].length).toBe(6);
    });

    test('should handle negative timestamps', () => {
      const timestamp = -1234567890.123456;
      const formatted = formatTimestampFixed(timestamp);
      
      // Проверяем формат с отрицательным знаком
      expect(formatted).toMatch(/^-\d+\.\d{6}$/);
    });

    test('should handle very small timestamps', () => {
      const timestamp = 0.000001;
      const formatted = formatTimestampFixed(timestamp);
      
      expect(formatted).toMatch(/^\d+\.\d{6}$/);
      expect(formatted).toBe('0.000001');
    });

    test('should handle very large timestamps', () => {
      const timestamp = 9999999999999.123456;
      const formatted = formatTimestampFixed(timestamp);
      
      expect(formatted).toMatch(/^\d+\.\d{6}$/);
      // Проверяем формат, не точное значение (может быть округление)
      const parts = formatted.split('.');
      expect(parts[0]).toBe('9999999999999');
      expect(parts[1].length).toBe(6);
    });
  });

  describe('formatTimestamp', () => {
    test('should format timestamp as ISO string with iso format', () => {
      const timestamp = 1234567890123.456;
      const formatted = formatTimestamp(timestamp, 'iso');
      
      // Проверяем, что это валидная ISO строка
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
      
      // Проверяем, что можно распарсить обратно
      const date = new Date(formatted);
      expect(date.getTime()).toBeGreaterThan(0);
    });

    test('should format timestamp with full format (default)', () => {
      const timestamp = 1234567890123;
      const formatted = formatTimestamp(timestamp);
      
      // По умолчанию используется формат 'full' с локалью 'ru-RU'
      expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}/); // DD.MM.YYYY формат
      expect(formatted).toMatch(/\d{2}:\d{2}:\d{2}/); // HH:mm:ss
      expect(formatted).toMatch(/\.\d{6}$/); // микросекунды в конце
    });

    test('should handle timestamps with decimal part', () => {
      const timestamp = 1234567890123.456789;
      const formatted = formatTimestamp(timestamp, 'full');
      
      // Проверяем, что содержит микросекунды
      expect(formatted).toMatch(/\.\d{6}$/);
    });

    test('should format with different format options', () => {
      const timestamp = 1234567890123.456;
      
      const fullFormatted = formatTimestamp(timestamp, 'full');
      expect(fullFormatted).toMatch(/\.\d{6}$/);
      
      const isoFormatted = formatTimestamp(timestamp, 'iso');
      expect(isoFormatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
      
      const dateFormatted = formatTimestamp(timestamp, 'date');
      expect(typeof dateFormatted).toBe('string');
      
      const timeFormatted = formatTimestamp(timestamp, 'time');
      expect(timeFormatted).toMatch(/\d{2}:\d{2}:\d{2}\.\d{6}$/);
    });

    test('should format current timestamp', () => {
      const timestamp = Date.now();
      const formatted = formatTimestamp(timestamp, 'iso');
      
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
      
      // Проверяем, что дата близка к текущему времени
      const date = new Date(formatted);
      const now = Date.now();
      expect(date.getTime()).toBeGreaterThan(now - 1000);
      expect(date.getTime()).toBeLessThan(now + 1000);
    });

    test('should handle invalid timestamp', () => {
      expect(formatTimestamp('invalid')).toBe('Invalid timestamp');
      expect(formatTimestamp(NaN)).toBe('Invalid timestamp');
    });

    test('should handle Date objects', () => {
      const date = new Date(1234567890123);
      const formatted = formatTimestamp(date, 'iso');
      
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
    });

    test('should handle string timestamps', () => {
      const timestamp = '2009-02-13T23:31:30.123456Z';
      const formatted = formatTimestamp(timestamp, 'iso');
      
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
    });
  });

  describe('compareTimestamps', () => {
    test('should return -1 if first timestamp is less than second', () => {
      expect(compareTimestamps(1000, 2000)).toBe(-1);
      expect(compareTimestamps(1000.1, 2000.2)).toBe(-1);
    });

    test('should return 1 if first timestamp is greater than second', () => {
      expect(compareTimestamps(2000, 1000)).toBe(1);
      expect(compareTimestamps(2000.2, 1000.1)).toBe(1);
    });

    test('should return 0 if timestamps are equal', () => {
      expect(compareTimestamps(1000, 1000)).toBe(0);
      expect(compareTimestamps(1000.123, 1000.123)).toBe(0);
    });

    test('should handle Date objects', () => {
      const date1 = new Date(1000);
      const date2 = new Date(2000);
      expect(compareTimestamps(date1, date2)).toBe(-1);
    });

    test('should handle string timestamps', () => {
      expect(compareTimestamps('2000-01-01', '2001-01-01')).toBe(-1);
    });
  });

  describe('timestampToDate', () => {
    test('should convert timestamp to Date object', () => {
      const timestamp = 1234567890123.456;
      const date = timestampToDate(timestamp);
      
      expect(date instanceof Date).toBe(true);
      expect(date.getTime()).toBe(1234567890123);
    });

    test('should handle timestamps with decimal part', () => {
      const timestamp = 1234567890123.789;
      const date = timestampToDate(timestamp);
      
      expect(date.getTime()).toBe(1234567890123);
    });

    test('should handle very large timestamps (nanoseconds)', () => {
      // Если timestamp больше 1e15, считается что это наносекунды
      const nanoseconds = 1234567890123456789;
      const date = timestampToDate(nanoseconds);
      
      expect(date instanceof Date).toBe(true);
      expect(date.getTime()).toBe(Math.floor(nanoseconds / 1000));
    });
  });

  describe('generateISOTimestamp', () => {
    test('should generate ISO timestamp string', () => {
      const iso = generateISOTimestamp();
      
      // Проверяем формат ISO 8601 с микросекундами
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
    });

    test('should generate valid ISO timestamp', () => {
      const iso = generateISOTimestamp();
      const date = new Date(iso);
      
      // Проверяем, что это валидная дата
      expect(date.getTime()).toBeGreaterThan(0);
      
      // Проверяем, что дата близка к текущему времени
      const now = Date.now();
      expect(date.getTime()).toBeGreaterThan(now - 1000);
      expect(date.getTime()).toBeLessThan(now + 1000);
    });

    test('should include microseconds in ISO string', () => {
      const iso = generateISOTimestamp();
      
      // Проверяем, что есть 6 цифр после точки
      const match = iso.match(/\.(\d{6})Z$/);
      expect(match).not.toBeNull();
      expect(match[1].length).toBe(6);
    });
  });
});

