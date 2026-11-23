import {
  initOtel,
  setHealth,
  startHealthPoll,
  count,
  recordSeconds,
  shutdownOtel
} from '@chat3/utils/otel.js';
import mongoose from 'mongoose';
import connectDB from '@chat3/utils/databaseUtils.js';
import * as rabbitmqUtils from '@chat3/utils/rabbitmqUtils.js';
import { processUpdateEvent } from '@chat3/utils/updateProcessor/processUpdateEvent.js';

initOtel({ instrumentations: ['mongoose', 'amqplib'] });

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
  const eventType = String((eventData as { eventType?: string })?.eventType || 'other');
  const t0 = process.hrtime.bigint();
  try {
    await processUpdateEvent(eventData as Parameters<typeof processUpdateEvent>[0]);
    const dur = Number(process.hrtime.bigint() - t0) / 1e9;
    count('update_worker_events_total', {
      outcome: 'success',
      reason: 'ok',
      event_type: eventType
    });
    recordSeconds('update_worker_event_duration_seconds', dur, {
      outcome: 'success',
      event_type: eventType
    });
  } catch (error: unknown) {
    const dur = Number(process.hrtime.bigint() - t0) / 1e9;
    console.error('❌ Error processing event:', error);
    console.error('   Event data:', JSON.stringify(eventData, null, 2));
    count('update_worker_events_total', {
      outcome: 'error',
      reason: 'handler_error',
      event_type: eventType
    });
    recordSeconds('update_worker_event_duration_seconds', dur, {
      outcome: 'error',
      event_type: eventType
    });
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
      setHealth(0);
      process.exit(1);
    }
    console.log('✅ RabbitMQ initialized\n');

    startHealthPoll(
      () => mongoose.connection.readyState === 1 && rabbitmqUtils.isRabbitMQConnected(),
      1000
    );
    setHealth(1);

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
    setHealth(0);
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  console.log('\n\n🛑 Shutting down worker...');
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
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught exception:', error);
  console.error('⚠️  Critical error detected, shutting down...');
  void shutdown();
});

void startWorker();
