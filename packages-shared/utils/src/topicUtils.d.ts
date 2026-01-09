/**
 * Утилиты для работы с топиками
 */
/**
 * Генерирует ID топика
 * @returns topicId в формате topic_xxxxxxxxxxxxx
 */
export declare function generateTopicId(): string;
interface GetDialogTopicsOptions {
    page?: number;
    limit?: number;
    sort?: Record<string, 1 | -1>;
}
/**
 * Получение списка топиков диалога
 * @param tenantId - ID тенанта
 * @param dialogId - ID диалога
 * @param options - Опции (page, limit, sort)
 * @returns Массив топиков
 */
export declare function getDialogTopics(tenantId: string, dialogId: string, options?: GetDialogTopicsOptions): Promise<unknown[]>;
interface CreateTopicOptions {
    meta?: Record<string, unknown>;
    createdBy?: string;
}
/**
 * Создание нового топика
 * @param tenantId - ID тенанта
 * @param dialogId - ID диалога
 * @param options - Опции (meta - объект с мета-тегами)
 * @returns Созданный топик
 */
export declare function createTopic(tenantId: string, dialogId: string, options?: CreateTopicOptions): Promise<unknown>;
/**
 * Получение топика по ID
 * @param tenantId - ID тенанта
 * @param dialogId - ID диалога
 * @param topicId - ID топика
 * @returns Топик или null, если не найден
 */
export declare function getTopicById(tenantId: string, dialogId: string, topicId: string): Promise<unknown | null>;
interface UpdateTopicOptions {
    meta?: Record<string, unknown>;
    createdBy?: string;
}
/**
 * Обновление топика (мета-теги)
 * @param tenantId - ID тенанта
 * @param dialogId - ID диалога
 * @param topicId - ID топика
 * @param updates - Обновления (meta - объект с мета-тегами)
 * @returns Обновленный топик или null, если не найден
 */
export declare function updateTopic(tenantId: string, dialogId: string, topicId: string, updates?: UpdateTopicOptions): Promise<unknown | null>;
/**
 * Получение топика с мета-тегами (для одного топика)
 * @param tenantId - ID тенанта
 * @param dialogId - ID диалога
 * @param topicId - ID топика
 * @returns Объект { topicId, meta: {...} } или null
 */
export declare function getTopicWithMeta(tenantId: string, dialogId: string, topicId: string): Promise<{
    topicId: string;
    meta: Record<string, unknown>;
} | null>;
/**
 * Получение нескольких топиков с мета-тегами (оптимизация N+1)
 * @param tenantId - ID тенанта
 * @param dialogId - ID диалога
 * @param topicIds - Массив уникальных topicId (может быть пустым)
 * @returns Map<topicId, { topicId, meta: {...} }>
 */
export declare function getTopicsWithMetaBatch(tenantId: string, dialogId: string, topicIds: string[]): Promise<Map<string, {
    topicId: string;
    meta: Record<string, unknown>;
}>>;
export {};
//# sourceMappingURL=topicUtils.d.ts.map