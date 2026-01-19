/**
 * Утилиты для работы со строками
 */

/**
 * Экранирует HTML символы в строке для безопасного отображения в HTML
 * @param value - значение для экранирования (может быть любого типа)
 * @returns Экранированная строка или пустая строка, если value null/undefined
 */
export function escapeHtml(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
