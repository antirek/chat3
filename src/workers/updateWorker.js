import connectDB from '../config/database.js';
import * as updateUtils from '../utils/updateUtils.js';
import * as rabbitmqUtils from '../utils/rabbitmqUtils.js';
import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rmuser:rmpassword@localhost:5672/';
const EXCHANGE_NAME = 'chat3_events';
const WORKER_QUEUE = 'update_worker_queue';

let connection = null;
let channel = null;

/**
 * Подключение к RabbitMQ
 */
async function connectRabbitMQ() {
  try {
    console.log('🐰 Connecting to RabbitMQ:', RABBITMQ_URL.replace(/:[^:]*@/, ':***@'));
    
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Создаем или проверяем наличие exchange
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

    // Создаем очередь для воркера
    await channel.assertQueue(WORKER_QUEUE, { 
      durable: true,
      arguments: {
        'x-message-ttl': 3600000, // 1 час TTL для сообщений
      }
    });

    // Привязываем очередь к exchange со всеми routing keys
    await channel.bindQueue(WORKER_QUEUE, EXCHANGE_NAME, '#');

    console.log('✅ RabbitMQ connected successfully');
    console.log(`   Exchange: ${EXCHANGE_NAME} (topic)`);
    console.log(`   Worker Queue: ${WORKER_QUEUE}`);
    console.log(`   Binding: # (all events)`);

    return true;
  } catch (error) {
    console.error('❌ Failed to connect to RabbitMQ:', error.message);
    return false;
  }
}

/**
 * Обработка события из RabbitMQ
 */
async function processEvent(eventData) {
  try {
    const { 
      _id: eventId,
      tenantId,
      eventType,
      entityType,
      entityId,
      data = {}
    } = eventData;

    console.log(`📩 Processing event: ${eventType} (${entityId})`);

    // Определяем, нужно ли создавать update
    const shouldUpdate = updateUtils.shouldCreateUpdate(eventType);
    
    if (shouldUpdate.dialog) {
      // Для диалоговых событий нужен dialogId
      let dialogId;
      
      if (entityType === 'dialog') {
        dialogId = entityId;
      } else if (entityType === 'dialogMember') {
        // Для событий dialog.member.* dialogId должен быть в data
        dialogId = data.dialogId || entityId;
      }
      
      if (dialogId) {
        await updateUtils.createDialogUpdate(tenantId, dialogId, eventId, eventType);
        console.log(`✅ Created DialogUpdate for event ${eventId}`);
      } else {
        console.warn(`⚠️ No dialogId found for event ${eventId}`);
      }
    }
    
    if (shouldUpdate.message) {
      // Для событий сообщений нужен dialogId из data
      let dialogId;
      let messageId;
      
      if (entityType === 'message') {
        dialogId = data.dialogId || entityId;
        messageId = entityId;
      } else if (entityType === 'messageReaction' || entityType === 'messageStatus') {
        // Для событий реакций и статусов messageId и dialogId должны быть в data
        dialogId = data.dialogId;
        messageId = data.messageId;
      }
      
      if (dialogId && messageId) {
        await updateUtils.createMessageUpdate(tenantId, dialogId, messageId, eventId, eventType);
        console.log(`✅ Created MessageUpdate for event ${eventId}`);
      } else {
        console.warn(`⚠️ No dialogId or messageId found for event ${eventId}`);
      }
    }

    if (!shouldUpdate.dialog && !shouldUpdate.message) {
      console.log(`ℹ️ Event ${eventType} does not require update creation`);
    }

  } catch (error) {
    console.error('❌ Error processing event:', error);
    throw error; // Requeue message
  }
}

/**
 * Запуск воркера
 */
async function startWorker() {
  try {
    console.log('🚀 Starting Update Worker...\n');

    // Подключаемся к MongoDB
    await connectDB();
    console.log('✅ MongoDB connected\n');

    // Подключаемся к RabbitMQ для ЧТЕНИЯ событий
    const rabbitmqConnected = await connectRabbitMQ();
    if (!rabbitmqConnected) {
      console.error('❌ Cannot start worker without RabbitMQ connection');
      process.exit(1);
    }

    // Инициализируем rabbitmqUtils для ПУБЛИКАЦИИ Updates
    console.log('🐰 Initializing RabbitMQ for Updates publishing...');
    const publishRabbitmqConnected = await rabbitmqUtils.initRabbitMQ();
    if (!publishRabbitmqConnected) {
      console.error('❌ Cannot start worker without RabbitMQ connection for publishing');
      process.exit(1);
    }
    console.log('✅ RabbitMQ for Updates publishing initialized\n');

    console.log('\n👂 Waiting for events...\n');

    // Настраиваем обработку сообщений
    await channel.prefetch(1); // Обрабатываем по одному событию за раз

    channel.consume(WORKER_QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const eventData = JSON.parse(msg.content.toString());
        await processEvent(eventData);
        
        // Подтверждаем обработку сообщения
        channel.ack(msg);
      } catch (error) {
        console.error('❌ Failed to process message:', error);
        
        // Отклоняем сообщение и возвращаем в очередь для повторной обработки
        // После нескольких попыток сообщение попадет в DLQ (если настроено)
        channel.nack(msg, false, true);
      }
    });

    console.log('✅ Update Worker is running');
    console.log('   Press Ctrl+C to stop\n');

  } catch (error) {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('\n\n🛑 Shutting down worker...');
  
  try {
    // Закрываем Worker's own RabbitMQ connection
    if (channel) {
      await channel.close();
      console.log('✅ Worker RabbitMQ channel closed');
    }
    if (connection) {
      await connection.close();
      console.log('✅ Worker RabbitMQ connection closed');
    }
    
    // Закрываем rabbitmqUtils connection
    await rabbitmqUtils.closeRabbitMQ();
    console.log('✅ RabbitMQ Utils connection closed');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
  
  process.exit(0);
}

// Обработка сигналов завершения
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Обработка необработанных ошибок
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  shutdown();
});

// Запускаем воркер
startWorker();

