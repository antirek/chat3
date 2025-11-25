import amqp from 'amqplib';
import { getUserType } from '../apps/tenant-api/utils/userTypeUtils.js';

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

// Exchange для updates
const UPDATES_EXCHANGE_NAME = 'chat3_updates';
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
    if (process.env.NODE_ENV !== 'test') {
      console.log('✅ RabbitMQ connected successfully');
      console.log(`   Events Exchange: ${EXCHANGE_NAME} (${EXCHANGE_TYPE})`);
      console.log(`   Updates Exchange: ${UPDATES_EXCHANGE_NAME} (${UPDATES_EXCHANGE_TYPE})`);    
      console.log(`   📌 API publishes to exchanges, Workers consume from queues`);
    }
    
    // Обработчики ошибок и закрытия соединения
    connection.on('error', (err) => {
      console.error('❌ RabbitMQ connection error:', err.message);
      isConnected = false;
    });
    
    connection.on('close', () => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('⚠️  RabbitMQ connection closed');
      }
      isConnected = false;
      if (process.env.NODE_ENV !== 'test') {
        // Попытка переподключения через 5 секунд
        setTimeout(() => {
          console.log('🔄 Attempting to reconnect to RabbitMQ...');
          initRabbitMQ();
        }, 5000);
      }
    });
    
    channel.on('error', (err) => {
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ RabbitMQ channel error:', err.message);
      }
    });
    
    channel.on('close', () => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('⚠️  RabbitMQ channel closed');
      }
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
    url: RABBITMQ_URL ? RABBITMQ_URL.replace(/\/\/.*@/, '//***:***@') : 'not configured', // Скрываем креды
    exchange: EXCHANGE_NAME,
    exchangeType: EXCHANGE_TYPE,
    updatesExchange: UPDATES_EXCHANGE_NAME,
    connected: isConnected,
    user: RABBITMQ_USER
  };
}

/**
 * Создает или получает очередь для пользователя user_{userId}_updates
 * @param {string} userId - ID пользователя
 * @param {string} tenantId - ID тенанта (опционально, для получения типа из User модели)
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
  } catch (error) {
    console.error(`Error creating user updates queue for ${userId}:`, error);
    throw error;
  }
}

/**
 * Публикация update в RabbitMQ
 * @param {Object} update - Update для публикации (уже очищенный от _id, id, __v)
 * @param {string} routingKey - Routing key (например, user.{userId}.dialogupdate)
 * @returns {Promise<boolean>} - true если успешно опубликовано
 */
export async function publishUpdate(update, routingKey) {
  // Если RabbitMQ недоступен, просто возвращаем false
  if (!isConnected || !channel) {
    return false;
  }

  try {
    // Публикуем Update в exchange chat3_updates
    // Exchange сам роутит сообщение в нужную user queue по routing key
    // НЕ создаем очереди здесь - они должны быть созданы заранее!
    
    // Преобразуем ObjectId в строки для headers (dialogId и entityId могут быть ObjectId)
    const dialogIdStr = update.dialogId?.toString?.() || update.dialogId;
    const entityIdStr = update.entityId?.toString?.() || update.entityId;
    
    const message = JSON.stringify(update);
    
    const published = channel.publish(
      UPDATES_EXCHANGE_NAME,
      routingKey,
      Buffer.from(message),
      {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
        headers: {
          userId: update.userId,
          dialogId: dialogIdStr,
          entityId: entityIdStr,
          eventType: update.eventType
        }
      }
    );
    
    if (published) {
      console.log(`📤 Update published to RabbitMQ: ${routingKey}`);
      return true;
    } else {
      console.warn(`⚠️  Failed to publish update to RabbitMQ (buffer full): ${routingKey}`);
      return false;
    }
  } catch (error) {
    console.error('Error publishing update to RabbitMQ:', error.message);
    return false;
  }
}

export default {
  initRabbitMQ,
  closeRabbitMQ,
  publishEvent,
  publishUpdate,
  createQueue,
  ensureUserUpdatesQueue,
  isRabbitMQConnected,
  getRabbitMQInfo
};
