/**
 * Утилиты для работы с временными метками с точностью до наносекунд
 */
/**
 * Генерирует временную метку с микросекундами
 * Формат: миллисекунды Unix timestamp + дробная часть с микросекундами
 * Пример: 1730891234567.123456
 * @returns {number} Timestamp в миллисекундах с точностью до микросекунд
 */
export function generateTimestamp(): number;
/**
 * Генерирует временную метку в формате ISO 8601 с микросекундами
 * Формат: YYYY-MM-DDTHH:mm:ss.ffffffZ (где ffffff - микросекунды)
 * @returns {string} ISO 8601 строка с микросекундами
 */
export function generateISOTimestamp(): string;
/**
 * Преобразует timestamp в читаемый формат
 * @param {number|string|Date} timestamp - Временная метка
 * @param {string} format - Формат вывода ('full', 'date', 'time', 'datetime', 'iso', 'relative')
 * @param {string} locale - Локаль для форматирования (по умолчанию 'ru-RU')
 * @returns {string} Форматированная строка
 */
export function formatTimestamp(timestamp: number | string | Date, format?: string, locale?: string): string;
/**
 * Форматирует timestamp с фиксированным количеством знаков после запятой
 * @param {number} timestamp - Временная метка
 * @param {number} decimals - Количество знаков после запятой (по умолчанию 6)
 * @returns {string} Timestamp как строка с фиксированным количеством знаков
 */
export function formatTimestampFixed(timestamp: number, decimals?: number): string;
/**
 * Сравнивает две временные метки
 * @param {number|string|Date} timestamp1
 * @param {number|string|Date} timestamp2
 * @returns {number} -1 если timestamp1 < timestamp2, 0 если равны, 1 если timestamp1 > timestamp2
 */
export function compareTimestamps(timestamp1: number | string | Date, timestamp2: number | string | Date): number;
/**
 * Преобразует наносекундный timestamp в Date объект
 * @param {number} timestamp - Timestamp с микросекундами
 * @returns {Date} Date объект
 */
export function timestampToDate(timestamp: number): Date;
/**
 * Получает текущее время в формате для MongoDB
 * MongoDB хранит Date в миллисекундах, но мы добавляем микросекунды в отдельное поле
 * @returns {Object} Объект с timestamp и microseconds
 */
export function getMongoTimestamp(): any;
declare namespace _default {
    export { generateTimestamp };
    export { generateISOTimestamp };
    export { formatTimestamp };
    export { compareTimestamps };
    export { timestampToDate };
    export { getMongoTimestamp };
}
export default _default;
//# sourceMappingURL=timestampUtils.d.ts.map