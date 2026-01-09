/**
 * Утилиты для работы с топиками
 */
/**
 * Генерирует ID топика
 * @returns {string} topicId в формате topic_xxxxxxxxxxxxx
 */
export function generateTopicId(): string;
/**
 * Получение списка топиков диалога
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {Object} options - Опции (page, limit, sort)
 * @returns {Promise<Array>} Массив топиков
 */
export function getDialogTopics(tenantId: string, dialogId: string, options?: any): Promise<any[]>;
/**
 * Создание нового топика
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {Object} options - Опции (meta - объект с мета-тегами)
 * @returns {Promise<Object>} Созданный топик
 */
export function createTopic(tenantId: string, dialogId: string, options?: any): Promise<any>;
/**
 * Получение топика по ID
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {string} topicId - ID топика
 * @returns {Promise<Object|null>} Топик или null, если не найден
 */
export function getTopicById(tenantId: string, dialogId: string, topicId: string): Promise<any | null>;
/**
 * Обновление топика (мета-теги)
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {string} topicId - ID топика
 * @param {Object} updates - Обновления (meta - объект с мета-тегами)
 * @returns {Promise<Object|null>} Обновленный топик или null, если не найден
 */
export function updateTopic(tenantId: string, dialogId: string, topicId: string, updates?: any): Promise<any | null>;
/**
 * Получение топика с мета-тегами (для одного топика)
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {string} topicId - ID топика
 * @returns {Promise<Object|null>} Объект { topicId, meta: {...} } или null
 */
export function getTopicWithMeta(tenantId: string, dialogId: string, topicId: string): Promise<any | null>;
/**
 * Получение нескольких топиков с мета-тегами (оптимизация N+1)
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {Array<string>} topicIds - Массив уникальных topicId (может быть пустым)
 * @returns {Promise<Map>} Map<topicId, { topicId, meta: {...} }>
 */
export function getTopicsWithMetaBatch(tenantId: string, dialogId: string, topicIds: Array<string>): Promise<Map<any, any>>;
//# sourceMappingURL=topicUtils.d.ts.map