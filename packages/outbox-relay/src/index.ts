import {
  initOtel,
  setHealth,
  startHealthPoll,
  setGauge,
  shutdownOtel
} from '@chat3/utils/otel.js';
import mongoose from 'mongoose';
import connectDB from '@chat3/utils/databaseUtils.js';
import * as rabbitmqUtils from '@chat3/utils/rabbitmqUtils.js';
import { publishOutboxBatch } from '@chat3/utils/outboxUtils.js';
import { OutboxEvent } from '@chat3/models';

initOtel({ instrumentations: ['mongoose', 'amqplib'] });

const POLL_INTERVAL_MS = 1000;
const WORKER_QUEUES = ['update_worker_queue', 'counter_worker_queue'] as const;

let shouldStop = false;

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function refreshRelayGauges(): Promise<void> {
  try {
    const pending = await OutboxEvent.countDocuments({ published: false });
    setGauge('outbox_pending_events', pending, { event_type: 'all' });
  } catch {
    // ignore gauge errors
  }

  setGauge('rabbitmq_connection_up', rabbitmqUtils.isRabbitMQConnected() ? 1 : 0);

  for (const queue of WORKER_QUEUES) {
    const n = await rabbitmqUtils.getQueueMessageCount(queue);
    if (n != null) {
      setGauge('rabbitmq_queue_messages', n, { queue });
    }
  }
}

/**
 * Основной цикл публикации outbox
 */
async function relayLoop(): Promise<void> {
  while (!shouldStop) {
    try {
      await publishOutboxBatch();
      await refreshRelayGauges();
    } catch (error: unknown) {
      console.error('❌ Error publishing outbox batch:', error);
    }

    await delay(POLL_INTERVAL_MS);
  }
}

/**
 * Запуск relay
 */
async function startRelay(): Promise<void> {
  try {
    console.log('🚀 Starting Outbox Relay...\n');

    await connectDB();
    console.log('✅ MongoDB connected\n');

    console.log('🐰 Initializing RabbitMQ...');
    const rabbitmqConnected = await rabbitmqUtils.initRabbitMQ();
    if (!rabbitmqConnected) {
      console.error('❌ Cannot start relay without RabbitMQ connection');
      setHealth(0);
      process.exit(1);
    }
    console.log('✅ RabbitMQ initialized\n');

    startHealthPoll(
      () => mongoose.connection.readyState === 1 && rabbitmqUtils.isRabbitMQConnected(),
      POLL_INTERVAL_MS
    );
    setHealth(1);

    console.log('📤 Polling outbox every 1s...\n');

    await relayLoop();
  } catch (error: unknown) {
    console.error('❌ Failed to start relay:', error);
    setHealth(0);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  console.log('\n\n🛑 Shutting down outbox relay...');
  setHealth(0);
  shouldStop = true;

  try {
    await rabbitmqUtils.closeRabbitMQ();
    await mongoose.connection.close();
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

void startRelay();
