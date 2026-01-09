/**
 * Удаляет поля _id, id и __v из объекта и всех его вложенных объектов
 */
export declare function removeIdFields(obj: unknown): unknown;
/**
 * Очищает объект ответа от полей _id, id и __v перед отправкой клиенту
 * @param data - Данные для очистки
 * @returns Очищенные данные
 */
export declare function sanitizeResponse(data: unknown): unknown;
/**
 * JSON.stringify replacer для форматирования timestamps с 6 знаками
 * Использовать: JSON.stringify(data, timestampReplacer)
 */
export declare function timestampReplacer(key: string, value: unknown): unknown;
//# sourceMappingURL=responseUtils.d.ts.map