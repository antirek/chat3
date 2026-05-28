/**
 * Утилиты для работы с датами и временем
 */

/**
 * Форматирует timestamp в строку с локальным временем
 * @param timestamp - timestamp в виде строки, числа или null/undefined
 * @returns Отформатированная строка даты и времени в формате ru-RU или '-' если timestamp отсутствует
 */
export function formatTimestamp(timestamp: string | number | null | undefined): string {
  if (!timestamp) return '-';
  const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;
  const date = new Date(ts);
  return date.toLocaleString('ru-RU');
}

/**
 * Приводит timestamp к строке с 6 знаками после точки (микросекунды), как в API.
 * @param timestamp - timestamp в виде строки, числа или null/undefined
 * @returns Строка вида "1734567890123.123456" или пустая строка при отсутствии значения
 */
export function toTimestampWithMicros(timestamp: string | number | null | undefined): string {
  if (timestamp == null || timestamp === '') return '';
  if (typeof timestamp === 'number') {
    if (!Number.isFinite(timestamp)) return '';
    return timestamp.toFixed(6);
  }
  if (typeof timestamp === 'string') {
    const match = timestamp.match(/^(\d+)(?:\.(\d+))?$/);
    if (match) {
      const intPart = match[1];
      const fracPart = (match[2] || '').padEnd(6, '0').slice(0, 6);
      return `${intPart}.${fracPart}`;
    }
  }
  return '';
}
