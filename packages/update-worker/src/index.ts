import connectDB from '@chat3/utils/databaseUtils.js';
import * as rabbitmqUtils from '@chat3/utils/rabbitmqUtils.js';
import { processUpdateEvent } from '@chat3/utils/updateProcessor/processUpdateEvent.js';

const WORKER_QUEUE = 'update_worker_queue';

interface ConsumerObject {
  consumerTag: string;
  cancel: () => Promise<void>;
  restart: () => Promise<void>;
}

let consumer: ConsumerObject | null = null;

/**
 * Обработка события из RabbitMQ — только domain Updates (без записи stats).
 */
async function processEvent(eventData: unknown): Promise<void> {
  try {
    await processUpdateEvent(eventData as Parameters<typeof processUpdateEvent>[0]);
  } catch (error: unknown) {
    console.error('❌ Error processing event:', error);
    console.error('   Event data:', JSON.stringify(eventData, null, 2));
  }
}

async function startWorker(): Promise<void> {
  try {
    console.log('🚀 Starting Update Worker...\n');

    await connectDB();
    console.log('✅ MongoDB connected\n');

    console.log('🐰 Initializing RabbitMQ...');
    const rabbitmqConnected = await rabbitmqUtils.initRabbitMQ();
    if (!rabbitmqConnected) {
      console.error('❌ Cannot start worker without RabbitMQ connection');
      process.exit(1);
    }
    console.log('✅ RabbitMQ initialized\n');

    console.log('👂 Creating consumer for events...\n');
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

    console.log('✅ Update Worker is running');
    console.log('   Press Ctrl+C to stop\n');
  } catch (error: unknown) {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  console.log('\n\n🛑 Shutting down worker...');

  try {
    if (consumer) {
      await consumer.cancel();
      console.log('✅ Consumer cancelled');
    }

    await rabbitmqUtils.closeRabbitMQ();
  } catch (error: unknown) {
    console.error('❌ Error during shutdown:', error);
  }

  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', (error: unknown) => {
  console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught exception:', error);
  console.error('⚠️  Critical error detected, shutting down...');
  shutdown();
});

startWorker();
