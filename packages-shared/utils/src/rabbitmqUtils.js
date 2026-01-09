import amqp from 'amqplib';
import { getUserType } from './userTypeUtils.js';
let connection = null;
let channel = null;
let isConnected = false;
let isReconnecting = false;
let isClosing = false; // Флаг для предотвращения переподключения при явном закрытии
const activeConsumers = new Map();
// Переменные окружения для RabbitMQ
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rmuser:rmpassword@localhost:5672/';
const EXCHANGE_NAME = process.env.RABBITMQ_EVENTS_EXCHANGE || 'chat3_events';
const EXCHANGE_TYPE = 'topic'; // topic exchange для гибкой маршрутизации
// Exchange для updates
const UPDATES_EXCHANGE_NAME = process.env.RABBITMQ_UPDATES_EXCHANGE || 'chat3_updates';
const UPDATES_EXCHANGE_TYPE = 'topic';
const UPDATES_QUEUE_TTL = 3600000; // TTL 1 час в миллисекундах для user queues
/**
 * Инициализация подключения к RabbitMQ
 */
export async function initRabbitMQ() {
    try {
        // Скрываем пароль в логах для безопасности
        const safeUrl = RABBITMQ_URL.replace(/\/\/.*@/, '//***:***@');
        if (process.env.NODE_ENV !== 'test') {
            console.log('🐰 Connecting to RabbitMQ:', safeUrl);
        }
        // Закрываем старые соединения, если они есть
        if (channel) {
            try {
                await channel.close().catch(() => { });
            }
            catch (_e) { }
            channel = null;
        }
        if (connection) {
            try {
                await connection.close().catch(() => { });
            }
            catch (_e) { }
            connection = null;
        }
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        // Создаем exchange для событий
        await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, {
            durable: true // Exchange переживет перезапуск RabbitMQ
        });
        // Создаем exchange для updates
        await channel.assertExchange(UPDATES_EXCHANGE_NAME, UPDATES_EXCHANGE_TYPE, {
            durable: true
        });
        // API Server НЕ создает очереди - только публикует в exchanges
        // Очереди создаются Workers и Consumers
        isConnected = true;
        isReconnecting = false; // Сбрасываем флаг переподключения при успешном подключении
        isClosing = false; // Сбрасываем флаг закрытия при новом подключении
        if (process.env.NODE_ENV !== 'test') {
            console.log('✅ RabbitMQ connected successfully');
            console.log(`   Events Exchange: ${EXCHANGE_NAME} (${EXCHANGE_TYPE})`);
            console.log(`   Updates Exchange: ${UPDATES_EXCHANGE_NAME} (${UPDATES_EXCHANGE_TYPE})`);
            console.log(`   📌 API publishes to exchanges, Workers consume from queues`);
        }
        // Обработчики ошибок и закрытия соединения
        connection.on('error', (err) => {
            if (isClosing)
                return; // Игнорируем ошибки при явном закрытии
            console.error('❌ RabbitMQ connection error:', err.message);
            isConnected = false;
            if (!isReconnecting) {
                handleDisconnect().catch(err => {
                    console.error('Error during reconnection after connection error:', err instanceof Error ? err.message : String(err));
                });
            }
        });
        connection.on('close', () => {
            if (isClosing)
                return; // Игнорируем при явном закрытии
            if (process.env.NODE_ENV !== 'test') {
                console.warn('⚠️  RabbitMQ connection closed');
            }
            isConnected = false;
            if (!isReconnecting) {
                handleDisconnect().catch(err => {
                    console.error('Error during reconnection after connection close:', err instanceof Error ? err.message : String(err));
                });
            }
        });
        channel.on('error', (err) => {
            if (isClosing)
                return; // Игнорируем ошибки при явном закрытии
            if (process.env.NODE_ENV !== 'test') {
                console.error('❌ RabbitMQ channel error:', err.message);
            }
            // Ошибка канала обычно означает, что соединение тоже закрыто
            isConnected = false;
            if (!isReconnecting) {
                handleDisconnect().catch(err => {
                    console.error('Error during reconnection after channel error:', err instanceof Error ? err.message : String(err));
                });
            }
        });
        channel.on('close', () => {
            if (isClosing)
                return; // Игнорируем при явном закрытии
            if (process.env.NODE_ENV !== 'test') {
                console.warn('⚠️  RabbitMQ channel closed');
            }
            // Закрытие канала может означать закрытие соединения
            isConnected = false;
            if (!isReconnecting) {
                handleDisconnect().catch(err => {
                    console.error('Error during reconnection after channel close:', err instanceof Error ? err.message : String(err));
                });
            }
        });
        return true;
    }
    catch (error) {
        console.error('❌ Failed to connect to RabbitMQ:', error instanceof Error ? error.message : String(error));
        console.warn('⚠️  Events will be saved to MongoDB only (RabbitMQ disabled)');
        isConnected = false;
        return false;
    }
}
/**
 * Обработка разрыва соединения и переподключение
 */
async function handleDisconnect() {
    if (isReconnecting) {
        return; // Уже переподключаемся
    }
    if (process.env.NODE_ENV === 'test') {
        return; // Не переподключаемся в тестах
    }
    isReconnecting = true;
    // Закрываем текущие соединения
    try {
        if (channel) {
            await channel.close().catch(() => { });
            channel = null;
        }
        if (connection) {
            await connection.close().catch(() => { });
            connection = null;
        }
    }
    catch (_error) {
        // Игнорируем ошибки при закрытии
    }
    console.log('🔄 Attempting to reconnect to RabbitMQ...');
    // Попытка переподключения с экспоненциальной задержкой
    let retryDelay = 1000; // Начинаем с 1 секунды
    const maxDelay = 30000; // Максимум 30 секунд
    let attempts = 0;
    while (true) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        try {
            const connected = await initRabbitMQ();
            if (connected) {
                console.log('✅ Successfully reconnected to RabbitMQ');
                isReconnecting = false;
                // Перезапускаем все активные consumer'ы
                await restartAllConsumers();
                return;
            }
        }
        catch (error) {
            console.error('Error during reconnection attempt:', error instanceof Error ? error.message : String(error));
        }
        // Увеличиваем задержку экспоненциально, но не больше maxDelay
        retryDelay = Math.min(retryDelay * 2, maxDelay);
        console.log(`⚠️  Reconnection attempt ${attempts} failed, retrying in ${retryDelay}ms...`);
    }
}
/**
 * Закрытие подключения к RabbitMQ
 */
export async function closeRabbitMQ() {
    // Защита от повторных вызовов
    if (isClosing) {
        return; // Уже закрываемся
    }
    // Устанавливаем флаг закрытия, чтобы обработчики событий не запускали переподключение
    isClosing = true;
    isReconnecting = false; // Останавливаем переподключение
    // Отменяем все активные consumer'ы
    const consumersToCancel = Array.from(activeConsumers.entries());
    activeConsumers.clear(); // Очищаем сразу, чтобы избежать повторных попыток
    for (const [_queueName, consumerInfo] of consumersToCancel) {
        if (channel && consumerInfo.consumerTag) {
            try {
                await channel.cancel(consumerInfo.consumerTag).catch(() => { });
            }
            catch (_e) {
                // Игнорируем ошибки при отмене (channel может быть уже закрыт)
            }
        }
    }
    try {
        // Удаляем обработчики событий перед закрытием, чтобы они не срабатывали
        if (connection) {
            connection.removeAllListeners('error');
            connection.removeAllListeners('close');
        }
        if (channel) {
            channel.removeAllListeners('error');
            channel.removeAllListeners('close');
        }
        // Закрываем channel и connection
        if (channel) {
            await channel.close().catch(() => { }); // Игнорируем ошибки, если уже закрыт
        }
        if (connection) {
            // Connection.close() возвращает Promise<void>
            await connection.close().catch(() => { }); // Игнорируем ошибки, если уже закрыт
        }
        isConnected = false;
        if (process.env.NODE_ENV !== 'test') {
            console.log('✅ RabbitMQ connection closed');
        }
    }
    catch (error) {
        console.error('Error closing RabbitMQ connection:', error instanceof Error ? error.message : String(error));
    }
    finally {
        // Сбрасываем флаг после закрытия
        isClosing = false;
        channel = null;
        connection = null;
    }
}
/**
 * Проверка и восстановление соединения перед операцией
 * @returns true если соединение активно или восстановлено
 */
async function ensureConnection() {
    // Проверяем, что соединение действительно активно
    if (isConnected && channel && connection) {
        try {
            // Проверяем, что соединение не закрыто
            // connection.connection - это внутренний объект amqplib
            const conn = connection;
            if (connection && !conn.connection) {
                // Соединение закрыто
                isConnected = false;
            }
            else {
                // Соединение выглядит активным
                return true;
            }
        }
        catch (_e) {
            // Ошибка при проверке - считаем соединение потерянным
            isConnected = false;
        }
    }
    // Если соединение потеряно и мы не в процессе переподключения, запускаем его
    if (!isReconnecting) {
        // Запускаем переподключение асинхронно (не блокируем)
        handleDisconnect().catch(err => {
            console.error('Error during reconnection:', err instanceof Error ? err.message : String(err));
        });
    }
    // Ждем переподключения (максимум 3 секунды)
    const maxWait = 3000;
    const startTime = Date.now();
    while (isReconnecting && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (isConnected && channel) {
            return true;
        }
    }
    return isConnected && channel !== null;
}
/**
 * Публикация события в RabbitMQ
 * @param event - Событие для публикации
 * @returns true если успешно опубликовано
 */
export async function publishEvent(event) {
    // Пытаемся восстановить соединение, если оно потеряно
    const connected = await ensureConnection();
    if (!connected || !channel) {
        console.warn(`⚠️  Cannot publish event ${event?.eventType || 'unknown'}: RabbitMQ not connected (isConnected: ${isConnected}, channel: ${channel ? 'exists' : 'null'})`);
        return false;
    }
    try {
        const routingKey = generateRoutingKey(event);
        const message = JSON.stringify(event);
        const published = channel.publish(EXCHANGE_NAME, routingKey, Buffer.from(message), {
            persistent: true, // Сообщения переживут перезапуск RabbitMQ
            contentType: 'application/json',
            timestamp: Date.now(),
            headers: {
                eventType: event.eventType,
                entityType: event.entityType,
                tenantId: event.tenantId?.toString(),
            }
        });
        if (published) {
            console.log(`📨 Event published to RabbitMQ: ${routingKey} (${event.eventType})`);
            return true;
        }
        else {
            console.warn(`⚠️  Failed to publish event to RabbitMQ (buffer full): ${routingKey} (${event.eventType})`);
            return false;
        }
    }
    catch (error) {
        console.error(`❌ Error publishing event to RabbitMQ (${event?.eventType || 'unknown'}):`, error instanceof Error ? error.message : String(error));
        console.error('Event details:', {
            eventType: event?.eventType,
            entityType: event?.entityType,
            entityId: event?.entityId,
            tenantId: event?.tenantId
        });
        // При ошибке проверяем, не разорвалось ли соединение
        isConnected = false;
        if (!isReconnecting) {
            // Запускаем переподключение в фоне (не блокируем текущий запрос)
            handleDisconnect().catch(err => {
                console.error('Error during reconnection:', err instanceof Error ? err.message : String(err));
            });
        }
        return false;
    }
}
/**
 * Генерация routing key для события
 * Формат: {entityType}.{action}.{tenantId}
 * Примеры:
 *   - dialog.create.tenant123
 *   - message.update.tenant456
 *   - dialog.member.add.tenant123
 */
function generateRoutingKey(event) {
    const entityType = event.entityType || 'unknown';
    const eventType = event.eventType || 'unknown';
    const tenantId = event.tenantId?.toString() || 'unknown';
    // Извлекаем действие из eventType (например, "create" из "dialog.create")
    const action = eventType.split('.').pop() || 'unknown';
    return `${entityType}.${action}.${tenantId}`;
}
/**
 * Создание очереди для прослушивания событий
 * @param queueName - Имя очереди
 * @param routingKeys - Массив routing keys для привязки
 * @param callback - Функция обработки сообщений
 */
export async function createQueue(queueName, routingKeys, callback) {
    if (!isConnected || !channel) {
        throw new Error('RabbitMQ is not connected');
    }
    try {
        // Создаем очередь
        await channel.assertQueue(queueName, {
            durable: true // Очередь переживет перезапуск RabbitMQ
        });
        // Привязываем очередь к exchange с routing keys
        for (const routingKey of routingKeys) {
            await channel.bindQueue(queueName, EXCHANGE_NAME, routingKey);
            console.log(`✅ Queue "${queueName}" bound to pattern: ${routingKey}`);
        }
        // Устанавливаем обработчик сообщений
        await channel.consume(queueName, (msg) => {
            if (msg) {
                try {
                    const event = JSON.parse(msg.content.toString());
                    callback(event, msg);
                    channel.ack(msg); // Подтверждаем обработку
                }
                catch (error) {
                    console.error('Error processing message:', error);
                    channel.nack(msg, false, false); // Отклоняем и не возвращаем в очередь
                }
            }
        });
        console.log(`👂 Listening for messages on queue: ${queueName}`);
        return true;
    }
    catch (error) {
        console.error('Error creating queue:', error instanceof Error ? error.message : String(error));
        throw error;
    }
}
/**
 * Получить статус подключения
 */
export function isRabbitMQConnected() {
    return isConnected;
}
/**
 * Получить информацию о RabbitMQ
 */
export function getRabbitMQInfo() {
    // Извлекаем пользователя из URL для отображения
    let user = 'unknown';
    try {
        const url = new URL(RABBITMQ_URL);
        user = url.username || 'unknown';
    }
    catch (_e) {
        // Если не удалось распарсить URL, оставляем unknown
    }
    return {
        url: RABBITMQ_URL ? RABBITMQ_URL.replace(/\/\/.*@/, '//***:***@') : 'not configured', // Скрываем креды
        exchange: EXCHANGE_NAME,
        exchangeType: EXCHANGE_TYPE,
        updatesExchange: UPDATES_EXCHANGE_NAME,
        connected: isConnected,
        user: user
    };
}
/**
 * Создает или получает очередь для пользователя user_{userId}_updates
 * @param userId - ID пользователя
 * @param tenantId - ID тенанта (опционально, для получения типа из User модели)
 */
export async function ensureUserUpdatesQueue(userId, tenantId = null) {
    if (!isConnected || !channel) {
        throw new Error('RabbitMQ is not connected');
    }
    const queueName = `user_${userId}_updates`;
    try {
        // Создаем очередь с TTL 1 час
        await channel.assertQueue(queueName, {
            durable: true,
            arguments: {
                'x-message-ttl': UPDATES_QUEUE_TTL
            }
        });
        // Получаем тип пользователя из модели User
        let userType = 'user'; // Дефолтное значение
        if (tenantId) {
            userType = await getUserType(tenantId, userId);
        }
        // Привязываем очередь к exchange updates с routing key user.{type}.{userId}.*
        await channel.bindQueue(queueName, UPDATES_EXCHANGE_NAME, `user.${userType}.${userId}.*`);
        return queueName;
    }
    catch (error) {
        console.error(`Error creating user updates queue for ${userId}:`, error);
        throw error;
    }
}
/**
 * Публикация update в RabbitMQ
 * @param update - Update для публикации (уже очищенный от _id, id, __v)
 * @param routingKey - Routing key (например, user.{userId}.dialogupdate)
 * @returns true если успешно опубликовано
 */
export async function publishUpdate(update, routingKey) {
    // Пытаемся восстановить соединение, если оно потеряно
    const connected = await ensureConnection();
    if (!connected || !channel) {
        console.warn(`⚠️  Cannot publish update ${routingKey}: RabbitMQ not connected`);
        return false;
    }
    try {
        // Публикуем Update в exchange chat3_updates
        // Exchange сам роутит сообщение в нужную user queue по routing key
        // НЕ создаем очереди здесь - они должны быть созданы заранее!
        // Преобразуем ObjectId в строки для headers (entityId может быть ObjectId)
        const entityIdStr = update.entityId?.toString?.() || String(update.entityId);
        const message = JSON.stringify(update);
        const published = channel.publish(UPDATES_EXCHANGE_NAME, routingKey, Buffer.from(message), {
            persistent: true,
            contentType: 'application/json',
            timestamp: Date.now(),
            headers: {
                userId: update.userId,
                entityId: entityIdStr,
                eventType: update.eventType
            }
        });
        if (published) {
            console.log(`📤 Update published to RabbitMQ (exchange: ${UPDATES_EXCHANGE_NAME}, routing key: ${routingKey})`);
            return true;
        }
        else {
            console.warn(`⚠️  Failed to publish update to RabbitMQ (buffer full): ${routingKey}`);
            return false;
        }
    }
    catch (error) {
        console.error('Error publishing update to RabbitMQ:', error instanceof Error ? error.message : String(error));
        // При ошибке проверяем, не разорвалось ли соединение
        isConnected = false;
        if (!isReconnecting) {
            // Запускаем переподключение в фоне (не блокируем текущий запрос)
            handleDisconnect().catch(err => {
                console.error('Error during reconnection:', err instanceof Error ? err.message : String(err));
            });
        }
        return false;
    }
}
/**
 * Создание consumer с автоматическим переподключением
 * @param queueName - Имя очереди
 * @param routingKeys - Routing keys для привязки к exchange
 * @param options - Опции consumer'а
 * @param messageHandler - Асинхронная функция обработки сообщений (msg) => Promise
 * @returns Объект с методами { cancel(), restart(), consumerTag }
 */
export async function createConsumer(queueName, routingKeys, options = {}, messageHandler) {
    if (!messageHandler || typeof messageHandler !== 'function') {
        throw new Error('messageHandler is required and must be a function');
    }
    // Пытаемся восстановить соединение, если оно потеряно
    const connected = await ensureConnection();
    if (!connected || !channel) {
        throw new Error('RabbitMQ is not connected');
    }
    const { prefetch = 1, queueTTL, durable = true, exchange = EXCHANGE_NAME } = options;
    let consumerTag = null;
    const startConsumer = async () => {
        if (!channel || !isConnected) {
            throw new Error('RabbitMQ channel is not available');
        }
        try {
            // Убеждаемся, что exchange существует (создаем, если нужно)
            await channel.assertExchange(exchange, 'topic', { durable: true });
            // Настраиваем prefetch
            await channel.prefetch(prefetch);
            // Создаем очередь
            const queueOptions = { durable };
            if (queueTTL) {
                queueOptions.arguments = { 'x-message-ttl': queueTTL };
            }
            await channel.assertQueue(queueName, queueOptions);
            // Привязываем очередь к exchange с routing keys
            for (const routingKey of routingKeys) {
                await channel.bindQueue(queueName, exchange, routingKey);
                if (process.env.NODE_ENV !== 'test') {
                    console.log(`✅ Queue "${queueName}" bound to pattern: ${routingKey}`);
                }
            }
            // Устанавливаем обработчик сообщений
            const result = await channel.consume(queueName, async (msg) => {
                if (!msg)
                    return;
                try {
                    // Парсим сообщение
                    const eventData = JSON.parse(msg.content.toString());
                    // Вызываем обработчик с eventData
                    // Если обработчику нужен msg, он может быть передан вторым параметром
                    await messageHandler(eventData, msg);
                    // Подтверждаем обработку сообщения
                    channel.ack(msg);
                }
                catch (error) {
                    console.error('❌ Error processing message:', error);
                    // Отклоняем сообщение и возвращаем в очередь для повторной обработки
                    channel.nack(msg, false, true);
                }
            });
            consumerTag = result.consumerTag;
            if (process.env.NODE_ENV !== 'test') {
                console.log(`👂 Consumer started on queue: ${queueName} (tag: ${consumerTag})`);
            }
            return consumerTag;
        }
        catch (error) {
            console.error(`❌ Error creating consumer for queue ${queueName}:`, error instanceof Error ? error.message : String(error));
            throw error;
        }
    };
    // Запускаем consumer
    const initialConsumerTag = await startConsumer();
    consumerTag = initialConsumerTag;
    // Сохраняем информацию о consumer для перезапуска после переподключения
    const consumerInfo = {
        queueName,
        routingKeys,
        options,
        messageHandler,
        consumerTag: initialConsumerTag,
        startConsumer
    };
    activeConsumers.set(queueName, consumerInfo);
    // Возвращаем объект с методами управления
    const consumerObject = {
        get consumerTag() {
            return consumerTag || '';
        },
        async cancel() {
            if (channel && consumerTag) {
                try {
                    await channel.cancel(consumerTag);
                    activeConsumers.delete(queueName);
                    if (process.env.NODE_ENV !== 'test') {
                        console.log(`✅ Consumer cancelled: ${queueName}`);
                    }
                }
                catch (error) {
                    console.error(`❌ Error cancelling consumer ${queueName}:`, error instanceof Error ? error.message : String(error));
                }
            }
        },
        async restart() {
            if (!channel || !isConnected) {
                throw new Error('RabbitMQ channel is not available');
            }
            // Отменяем старый consumer
            if (consumerTag) {
                try {
                    await channel.cancel(consumerTag).catch(() => { });
                }
                catch (_e) { }
            }
            // Запускаем заново
            const newConsumerTag = await startConsumer();
            consumerTag = newConsumerTag;
            consumerInfo.consumerTag = newConsumerTag;
        }
    };
    return consumerObject;
}
/**
 * Перезапуск всех активных consumer'ов после переподключения
 */
async function restartAllConsumers() {
    if (activeConsumers.size === 0) {
        return;
    }
    if (process.env.NODE_ENV !== 'test') {
        console.log(`🔄 Restarting ${activeConsumers.size} consumer(s)...`);
    }
    for (const [queueName, consumerInfo] of activeConsumers.entries()) {
        try {
            const newConsumerTag = await consumerInfo.startConsumer();
            consumerInfo.consumerTag = newConsumerTag;
            if (process.env.NODE_ENV !== 'test') {
                console.log(`✅ Consumer restarted: ${queueName}`);
            }
        }
        catch (error) {
            console.error(`❌ Failed to restart consumer ${queueName}:`, error instanceof Error ? error.message : String(error));
        }
    }
}
//# sourceMappingURL=rabbitmqUtils.js.map