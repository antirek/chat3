import { ConsumeMessage } from 'amqplib';
/**
 * Инициализация подключения к RabbitMQ
 */
export declare function initRabbitMQ(): Promise<boolean>;
/**
 * Закрытие подключения к RabbitMQ
 */
export declare function closeRabbitMQ(): Promise<void>;
interface Event {
    eventType?: string;
    entityType?: string;
    entityId?: unknown;
    tenantId?: unknown;
}
/**
 * Публикация события в RabbitMQ
 * @param event - Событие для публикации
 * @returns true если успешно опубликовано
 */
export declare function publishEvent(event: Event): Promise<boolean>;
/**
 * Создание очереди для прослушивания событий
 * @param queueName - Имя очереди
 * @param routingKeys - Массив routing keys для привязки
 * @param callback - Функция обработки сообщений
 */
export declare function createQueue(queueName: string, routingKeys: string[], callback: (event: unknown, msg: ConsumeMessage) => void): Promise<boolean>;
/**
 * Получить статус подключения
 */
export declare function isRabbitMQConnected(): boolean;
/**
 * Получить информацию о RabbitMQ
 */
export declare function getRabbitMQInfo(): {
    url: string;
    exchange: string;
    exchangeType: string;
    updatesExchange: string;
    connected: boolean;
    user: string;
};
/**
 * Создает или получает очередь для пользователя user_{userId}_updates
 * @param userId - ID пользователя
 * @param tenantId - ID тенанта (опционально, для получения типа из User модели)
 */
export declare function ensureUserUpdatesQueue(userId: string, tenantId?: string | null): Promise<string>;
interface Update {
    userId?: string;
    entityId?: unknown;
    eventType?: string;
}
/**
 * Публикация update в RabbitMQ
 * @param update - Update для публикации (уже очищенный от _id, id, __v)
 * @param routingKey - Routing key (например, user.{userId}.dialogupdate)
 * @returns true если успешно опубликовано
 */
export declare function publishUpdate(update: Update, routingKey: string): Promise<boolean>;
interface CreateConsumerOptions {
    prefetch?: number;
    queueTTL?: number;
    durable?: boolean;
    exchange?: string;
}
interface ConsumerObject {
    consumerTag: string;
    cancel: () => Promise<void>;
    restart: () => Promise<void>;
}
/**
 * Создание consumer с автоматическим переподключением
 * @param queueName - Имя очереди
 * @param routingKeys - Routing keys для привязки к exchange
 * @param options - Опции consumer'а
 * @param messageHandler - Асинхронная функция обработки сообщений (msg) => Promise
 * @returns Объект с методами { cancel(), restart(), consumerTag }
 */
export declare function createConsumer(queueName: string, routingKeys: string[], options: CreateConsumerOptions, messageHandler: (eventData: unknown, msg: ConsumeMessage) => Promise<void>): Promise<ConsumerObject>;
export {};
//# sourceMappingURL=rabbitmqUtils.d.ts.map