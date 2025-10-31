import amqp from 'amqplib';

let connection = null;
let channel = null;
let isConnected = false;

// Переменные окружения для RabbitMQ
const RABBITMQ_HOST = process.env.RABBITMQ_HOST || 'localhost';
const RABBITMQ_PORT = process.env.RABBITMQ_PORT || '5672';
const RABBITMQ_USER = process.env.RABBITMQ_USER || 'rmuser';
const RABBITMQ_PASSWORD = process.env.RABBITMQ_PASSWORD || 'rmpassword';
const RABBITMQ_VHOST = process.env.RABBITMQ_VHOST || '/';

// Формируем URL с авторизацией
const RABBITMQ_URL = process.env.RABBITMQ_URL || 
  `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}:${RABBITMQ_PORT}${RABBITMQ_VHOST}`;

const EXCHANGE_NAME = process.env.RABBITMQ_EXCHANGE || 'chat3_events';
const EXCHANGE_TYPE = 'topic'; // topic exchange для гибкой маршрутизации
const QUEUE_NAME = 'chat3_events'; // Имя очереди для всех событий
const QUEUE_TTL = 3600000; // TTL 1 час в миллисекундах

/**
 * Инициализация подключения к RabbitMQ
 */
export async function initRabbitMQ() {
  try {
    // Скрываем пароль в логах для безопасности
    const safeUrl = RABBITMQ_URL.replace(/\/\/.*@/, '//***:***@');
    console.log('🐰 Connecting to RabbitMQ:', safeUrl);
    
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    
    // Создаем exchange для событий
    await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, {
      durable: true // Exchange переживет перезапуск RabbitMQ
    });
    
    // Создаем очередь chat3_events с TTL 1 час
    await channel.assertQueue(QUEUE_NAME, {
      durable: true, // Очередь переживет перезапуск RabbitMQ
      arguments: {
        'x-message-ttl': QUEUE_TTL // TTL 1 час (3600000 мс)
      }
    });
    
    // Привязываем очередь к exchange с routing key '#' (все события)
    await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, '#');
    
    isConnected = true;
    console.log('✅ RabbitMQ connected successfully');
    console.log(`   Exchange: ${EXCHANGE_NAME} (${EXCHANGE_TYPE})`);
    console.log(`   Queue: ${QUEUE_NAME} (TTL: 1 hour)`);
    console.log(`   Routing: All events (#) -> ${QUEUE_NAME}`);
    console.log(`   User: ${RABBITMQ_USER}`);
    
    // Обработчики ошибок и закрытия соединения
    connection.on('error', (err) => {
      console.error('❌ RabbitMQ connection error:', err.message);
      isConnected = false;
    });
    
    connection.on('close', () => {
      console.warn('⚠️  RabbitMQ connection closed');
      isConnected = false;
      // Попытка переподключения через 5 секунд
      setTimeout(() => {
        console.log('🔄 Attempting to reconnect to RabbitMQ...');
        initRabbitMQ();
      }, 5000);
    });
    
    channel.on('error', (err) => {
      console.error('❌ RabbitMQ channel error:', err.message);
    });
    
    channel.on('close', () => {
      console.warn('⚠️  RabbitMQ channel closed');
    });
    
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to RabbitMQ:', error.message);
    console.warn('⚠️  Events will be saved to MongoDB only (RabbitMQ disabled)');
    isConnected = false;
    return false;
  }
}

/**
 * Закрытие подключения к RabbitMQ
 */
export async function closeRabbitMQ() {
  try {
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
    isConnected = false;
    console.log('✅ RabbitMQ connection closed');
  } catch (error) {
    console.error('Error closing RabbitMQ connection:', error.message);
  }
}

/**
 * Публикация события в RabbitMQ
 * @param {Object} event - Событие для публикации
 * @returns {Promise<boolean>} - true если успешно опубликовано
 */
export async function publishEvent(event) {
  // Если RabbitMQ недоступен, просто возвращаем false (событие все равно сохранится в MongoDB)
  if (!isConnected || !channel) {
    return false;
  }
  
  try {
    const routingKey = generateRoutingKey(event);
    const message = JSON.stringify(event);
    
    const published = channel.publish(
      EXCHANGE_NAME,
      routingKey,
      Buffer.from(message),
      {
        persistent: true, // Сообщения переживут перезапуск RabbitMQ
        contentType: 'application/json',
        timestamp: Date.now(),
        headers: {
          eventType: event.eventType,
          entityType: event.entityType,
          tenantId: event.tenantId?.toString(),
        }
      }
    );
    
    if (published) {
      console.log(`📨 Event published to RabbitMQ: ${routingKey}`);
      return true;
    } else {
      console.warn('⚠️  Failed to publish event to RabbitMQ (buffer full)');
      return false;
    }
  } catch (error) {
    console.error('Error publishing event to RabbitMQ:', error.message);
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
  const action = eventType.split('.').pop();
  
  return `${entityType}.${action}.${tenantId}`;
}

/**
 * Создание очереди для прослушивания событий
 * @param {string} queueName - Имя очереди
 * @param {Array<string>} routingKeys - Массив routing keys для привязки
 * @param {Function} callback - Функция обработки сообщений
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
        } catch (error) {
          console.error('Error processing message:', error);
          channel.nack(msg, false, false); // Отклоняем и не возвращаем в очередь
        }
      }
    });
    
    console.log(`👂 Listening for messages on queue: ${queueName}`);
    return true;
  } catch (error) {
    console.error('Error creating queue:', error.message);
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
  return {
    url: RABBITMQ_URL.replace(/\/\/.*@/, '//***:***@'), // Скрываем креды
    exchange: EXCHANGE_NAME,
    exchangeType: EXCHANGE_TYPE,
    queue: QUEUE_NAME,
    queueTtl: QUEUE_TTL / 1000, // TTL в секундах для читаемости
    connected: isConnected,
    user: RABBITMQ_USER
  };
}

/**
 * Получить имя очереди по умолчанию
 */
export function getDefaultQueueName() {
  return QUEUE_NAME;
}

export default {
  initRabbitMQ,
  closeRabbitMQ,
  publishEvent,
  createQueue,
  isRabbitMQConnected,
  getRabbitMQInfo,
  getDefaultQueueName
};
