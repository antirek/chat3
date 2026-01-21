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
