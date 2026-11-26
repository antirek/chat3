import './otelRegister.js';
import {
  setHealth,
  startHealthPoll,
  stopHealthPoll,
  shutdownOtel,
  recordCrashInSpan
} from '@chat3/utils/otel.js';
import { checkMongo } from '@chat3/utils/httpHealth.js';
import connectDB from '@chat3/utils/databaseUtils.js';
import * as rabbitmqUtils from '@chat3/utils/rabbitmqUtils.js';
import { processCounterEvent } from '@chat3/utils/counterProcessor/processCounterEvent.js';

const WORKER_QUEUE = 'counter_worker_queue';

interface ConsumerObject {
  consumerTag: string;
  cancel: () => Promise<void>;
  restart: () => Promise<void>;
}

let consumer: ConsumerObject | null = null;

/**
 * Обработка события из RabbitMQ (счётчики)
 */
async function processEvent(eventData: unknown): Promise<void> {
  await processCounterEvent(eventData);
}

/**
 * Запуск воркера
 */
async function startWorker(): Promise<void> {
  try {
    console.log('🚀 Starting Counter Worker...\n');

    await connectDB();
    console.log('✅ MongoDB connected\n');

    console.log('🐰 Initializing RabbitMQ...');
    const rabbitmqConnected = await rabbitmqUtils.initRabbitMQ();
    if (!rabbitmqConnected) {
      console.error('❌ Cannot start worker without RabbitMQ connection');
      setHealth(0);
      process.exit(1);
    }
    console.log('✅ RabbitMQ initialized\n');

    startHealthPoll(
      async () => (await checkMongo()) === 'connected' && rabbitmqUtils.isRabbitMQConnected(),
      1000
    );
    setHealth(1);

    console.log('👂 Creating consumer for counter events...\n');
    consumer = await rabbitmqUtils.createConsumer(
      WORKER_QUEUE,
      ['#'],
      {
        prefetch: 1,
        queueTTL: 3600000,
        durable: true
      },
      processEvent
    );
    console.log('✅ Consumer created successfully\n');

    console.log('✅ Counter Worker is running');
    console.log('   Press Ctrl+C to stop\n');
  } catch (error: unknown) {
    console.error('❌ Failed to start worker:', error);
    setHealth(0);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  console.log('\n\n🛑 Shutting down worker...');
  stopHealthPoll();
  setHealth(0);

  try {
    if (consumer) {
      await consumer.cancel();
      console.log('✅ Consumer cancelled');
    }

    await rabbitmqUtils.closeRabbitMQ();
    await shutdownOtel();
  } catch (error: unknown) {
    console.error('❌ Error during shutdown:', error);
  }

  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});

process.on('unhandledRejection', (error: unknown) => {
  console.error('❌ Unhandled promise rejection:', error);
  recordCrashInSpan(error);
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught exception:', error);
  console.error('⚠️  Critical error detected, shutting down...');
  recordCrashInSpan(error);
  void shutdown();
});

void startWorker();
