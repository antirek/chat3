/**
 * Инициализация подключения к RabbitMQ
 */
export function initRabbitMQ(): Promise<boolean>;
/**
 * Закрытие подключения к RabbitMQ
 */
export function closeRabbitMQ(): Promise<void>;
/**
 * Публикация события в RabbitMQ
 * @param {Object} event - Событие для публикации
 * @returns {Promise<boolean>} - true если успешно опубликовано
 */
export function publishEvent(event: any): Promise<boolean>;
/**
 * Создание очереди для прослушивания событий
 * @param {string} queueName - Имя очереди
 * @param {Array<string>} routingKeys - Массив routing keys для привязки
 * @param {Function} callback - Функция обработки сообщений
 */
export function createQueue(queueName: string, routingKeys: Array<string>, callback: Function): Promise<boolean>;
/**
 * Получить статус подключения
 */
export function isRabbitMQConnected(): boolean;
/**
 * Получить информацию о RabbitMQ
 */
export function getRabbitMQInfo(): {
    url: string;
    exchange: string;
    exchangeType: string;
    updatesExchange: string;
    connected: boolean;
    user: string;
};
/**
 * Создает или получает очередь для пользователя user_{userId}_updates
 * @param {string} userId - ID пользователя
 * @param {string} tenantId - ID тенанта (опционально, для получения типа из User модели)
 */
export function ensureUserUpdatesQueue(userId: string, tenantId?: string): Promise<string>;
/**
 * Публикация update в RabbitMQ
 * @param {Object} update - Update для публикации (уже очищенный от _id, id, __v)
 * @param {string} routingKey - Routing key (например, user.{userId}.dialogupdate)
 * @returns {Promise<boolean>} - true если успешно опубликовано
 */
export function publishUpdate(update: any, routingKey: string): Promise<boolean>;
/**
 * Создание consumer с автоматическим переподключением
 * @param {string} queueName - Имя очереди
 * @param {Array<string>} routingKeys - Routing keys для привязки к exchange
 * @param {Object} options - Опции consumer'а
 * @param {number} options.prefetch - Количество неподтвержденных сообщений (по умолчанию 1)
 * @param {number} options.queueTTL - TTL для очереди в миллисекундах (опционально)
 * @param {boolean} options.durable - Очередь переживет перезапуск RabbitMQ (по умолчанию true)
 * @param {string} options.exchange - Имя exchange (по умолчанию EXCHANGE_NAME)
 * @param {Function} messageHandler - Асинхронная функция обработки сообщений (msg) => Promise
 * @returns {Promise<Object>} - Объект с методами { cancel(), restart(), consumerTag }
 */
export function createConsumer(queueName: string, routingKeys: Array<string>, options: {
    prefetch: number;
    queueTTL: number;
    durable: boolean;
    exchange: string;
}, messageHandler: Function): Promise<any>;
//# sourceMappingURL=rabbitmqUtils.d.ts.map