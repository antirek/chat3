/**
 * Пример consumer для RabbitMQ
 * Подписывается на события Chat3 и обрабатывает их
 * 
 * Запуск:
 *   node examples/rabbitmq-consumer.js
 */

import amqp from 'amqplib';

const RABBITMQ_HOST = process.env.RABBITMQ_HOST || 'localhost';
const RABBITMQ_PORT = process.env.RABBITMQ_PORT || '5672';
const RABBITMQ_USER = process.env.RABBITMQ_USER || 'rmuser';
const RABBITMQ_PASSWORD = process.env.RABBITMQ_PASSWORD || 'rmpassword';
const RABBITMQ_VHOST = process.env.RABBITMQ_VHOST || '/';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 
  `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}:${RABBITMQ_PORT}${RABBITMQ_VHOST}`;

const EXCHANGE_NAME = 'chat3_events';
const QUEUE_NAME = 'chat3_events'; // Очередь по умолчанию (создается автоматически с TTL 1 час)

// Паттерны событий для подписки (если используете другую очередь)
// Для очереди chat3_events все события уже попадают автоматически через routing key '#'
const ROUTING_PATTERNS = [
  '#', // Все события (уже настроено для chat3_events)
  // Можно использовать более специфичные паттерны для других очередей:
  // '*.create.*',   // Все события создания
  // '*.delete.*',   // Все события удаления
  // 'message.*.*',  // Все события сообщений
  // 'dialog.*.*',   // Все события диалогов
];

async function startConsumer() {
  try {
    const safeUrl = RABBITMQ_URL.replace(/\/\/.*@/, '//***:***@');
    console.log('🐰 Connecting to RabbitMQ:', safeUrl);
    
    // Подключение
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    
    // Проверяем, что exchange существует
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    
    // Используем очередь chat3_events (создается автоматически сервером с TTL 1 час)
    // assertQueue проверит существование очереди и использует её, если параметры совпадают
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-message-ttl': 3600000 // TTL 1 час (должно совпадать с сервером)
      }
    });
    
    // Очередь уже привязана к exchange с routing key '#' на сервере
    // Если нужно подписаться на другие паттерны, можно добавить дополнительные привязки
    // Но для базового использования очередь уже настроена на все события
    console.log(`✅ Using queue: ${QUEUE_NAME} (TTL: 1 hour)`);
    console.log(`   Queue is already bound to exchange with routing key '#' (all events)`);
    
    // Настройка prefetch (обрабатываем по 1 сообщению за раз)
    await channel.prefetch(1);
    
    console.log(`\n👂 Listening for events on queue: ${QUEUE_NAME}`);
    console.log('Press Ctrl+C to exit\n');
    
    // Подписка на сообщения
    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg) {
        try {
          const event = JSON.parse(msg.content.toString());
          
          // Обработка события
          await processEvent(event, msg);
          
          // Подтверждаем успешную обработку
          channel.ack(msg);
        } catch (error) {
          console.error('❌ Error processing message:', error);
          // Отклоняем сообщение без повторной отправки
          channel.nack(msg, false, false);
        }
      }
    });
    
    // Обработка закрытия соединения
    connection.on('close', () => {
      console.warn('⚠️  Connection closed. Reconnecting...');
      setTimeout(startConsumer, 5000);
    });
    
    connection.on('error', (err) => {
      console.error('❌ Connection error:', err.message);
    });
    
  } catch (error) {
    console.error('❌ Failed to start consumer:', error);
    console.log('Retrying in 5 seconds...');
    setTimeout(startConsumer, 5000);
  }
}

/**
 * Обработка события
 */
async function processEvent(event, msg) {
  const timestamp = new Date(event.createdAt).toLocaleString();
  const routingKey = msg.fields.routingKey;
  
  console.log('\n' + '='.repeat(80));
  console.log(`📨 Received Event [${timestamp}]`);
  console.log('─'.repeat(80));
  console.log(`Event Type:    ${event.eventType}`);
  console.log(`Entity Type:   ${event.entityType}`);
  console.log(`Entity ID:     ${event.entityId}`);
  console.log(`Actor:         ${event.actorId} (${event.actorType})`);
  console.log(`Routing Key:   ${routingKey}`);
  console.log(`Tenant ID:     ${event.tenantId}`);
  
  // Специфичная обработка для разных типов событий
  switch (event.eventType) {
    case 'dialog.create':
      console.log(`📝 Dialog Created: "${event.data.dialogName}"`);
      // Пример: отправить уведомление администраторам
      await notifyAdmins('New dialog created', event.data);
      break;
      
    case 'message.create':
      console.log(`💬 New Message in dialog: ${event.data.dialogId}`);
      console.log(`   Type: ${event.data.messageType}, Length: ${event.data.contentLength} chars`);
      // Пример: отправить push-уведомление
      await sendPushNotification(event.data.dialogId, event.data);
      break;
      
    case 'dialog.member.add':
      console.log(`👥 Member Added: ${event.data.userId} to dialog ${event.data.dialogId}`);
      // Пример: обновить статистику
      await updateStatistics('member_added', event.data);
      break;
      
    case 'dialog.member.remove':
      console.log(`👋 Member Removed: ${event.data.userId} from dialog ${event.data.dialogId}`);
      break;
      
    case 'message.status.update':
      console.log(`✅ Message Status: ${event.data.oldStatus} → ${event.data.newStatus}`);
      break;
      
    case 'dialog.delete':
      console.log(`🗑️  Dialog Deleted: "${event.data.dialogName}"`);
      // Пример: очистка связанных данных
      await cleanupRelatedData(event.entityId);
      break;
      
    default:
      console.log(`ℹ️  Other event type: ${event.eventType}`);
  }
  
  // Вывод дополнительных данных
  if (event.data && Object.keys(event.data).length > 0) {
    console.log('\nEvent Data:');
    console.log(JSON.stringify(event.data, null, 2));
  }
  
  console.log('='.repeat(80));
}

/**
 * Примеры функций обработки
 */

async function notifyAdmins(title, data) {
  // Здесь можно отправить email, slack, telegram и т.д.
  console.log(`   → Notify admins: ${title}`);
}

async function sendPushNotification(dialogId, data) {
  // Здесь можно отправить push через Firebase, OneSignal и т.д.
  console.log(`   → Send push notification for dialog: ${dialogId}`);
}

async function updateStatistics(action, data) {
  // Здесь можно обновить счетчики в Redis, InfluxDB и т.д.
  console.log(`   → Update statistics: ${action}`);
}

async function cleanupRelatedData(entityId) {
  // Здесь можно очистить кэш, удалить файлы и т.д.
  console.log(`   → Cleanup data for entity: ${entityId}`);
}

// Запуск consumer
startConsumer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

