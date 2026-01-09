export function removeIdFields(obj: any): any;
/**
 * Очищает объект ответа от полей _id, id и __v перед отправкой клиенту
 * @param {any} data - Данные для очистки
 * @returns {any} - Очищенные данные
 */
export function sanitizeResponse(data: any): any;
/**
 * JSON.stringify replacer для форматирования timestamps с 6 знаками
 * Использовать: JSON.stringify(data, timestampReplacer)
 */
export function timestampReplacer(key: any, value: any): any;
//# sourceMappingURL=responseUtils.d.ts.map