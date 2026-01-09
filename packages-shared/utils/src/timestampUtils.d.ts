/**
 * Утилиты для работы с временными метками с точностью до наносекунд
 */
/**
 * Генерирует временную метку с микросекундами
 * Формат: миллисекунды Unix timestamp + дробная часть с микросекундами
 * Пример: 1730891234567.123456
 * @returns Timestamp в миллисекундах с точностью до микросекунд
 */
export declare function generateTimestamp(): number;
/**
 * Генерирует временную метку в формате ISO 8601 с микросекундами
 * Формат: YYYY-MM-DDTHH:mm:ss.ffffffZ (где ffffff - микросекунды)
 * @returns ISO 8601 строка с микросекундами
 */
export declare function generateISOTimestamp(): string;
/**
 * Преобразует timestamp в читаемый формат
 * @param timestamp - Временная метка
 * @param format - Формат вывода ('full', 'date', 'time', 'datetime', 'iso', 'relative')
 * @param locale - Локаль для форматирования (по умолчанию 'ru-RU')
 * @returns Форматированная строка
 */
export declare function formatTimestamp(timestamp: number | string | Date, format?: 'full' | 'date' | 'time' | 'datetime' | 'iso' | 'relative', locale?: string): string;
/**
 * Форматирует timestamp с фиксированным количеством знаков после запятой
 * @param timestamp - Временная метка
 * @param decimals - Количество знаков после запятой (по умолчанию 6)
 * @returns Timestamp как строка с фиксированным количеством знаков
 */
export declare function formatTimestampFixed(timestamp: number, decimals?: number): string;
/**
 * Сравнивает две временные метки
 * @param timestamp1
 * @param timestamp2
 * @returns -1 если timestamp1 < timestamp2, 0 если равны, 1 если timestamp1 > timestamp2
 */
export declare function compareTimestamps(timestamp1: number | string | Date, timestamp2: number | string | Date): number;
/**
 * Преобразует наносекундный timestamp в Date объект
 * @param timestamp - Timestamp с микросекундами
 * @returns Date объект
 */
export declare function timestampToDate(timestamp: number): Date;
/**
 * Получает текущее время в формате для MongoDB
 * MongoDB хранит Date в миллисекундах, но мы добавляем микросекунды в отдельное поле
 * @returns Объект с timestamp и microseconds
 */
export declare function getMongoTimestamp(): {
    date: Date;
    microseconds: number;
};
declare const _default: {
    generateTimestamp: typeof generateTimestamp;
    generateISOTimestamp: typeof generateISOTimestamp;
    formatTimestamp: typeof formatTimestamp;
    compareTimestamps: typeof compareTimestamps;
    timestampToDate: typeof timestampToDate;
    getMongoTimestamp: typeof getMongoTimestamp;
};
export default _default;
//# sourceMappingURL=timestampUtils.d.ts.map