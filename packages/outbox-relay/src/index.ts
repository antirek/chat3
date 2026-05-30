import connectDB from '@chat3/utils/databaseUtils.js';
import * as rabbitmqUtils from '@chat3/utils/rabbitmqUtils.js';
import { publishOutboxBatch } from '@chat3/utils/outboxUtils.js';

const POLL_INTERVAL_MS = 1000;

let shouldStop = false;

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Основной цикл публикации outbox
 */
async function relayLoop(): Promise<void> {
  while (!shouldStop) {
    try {
      await publishOutboxBatch();
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
      process.exit(1);
    }
    console.log('✅ RabbitMQ initialized\n');

    console.log('📤 Polling outbox every 1s...\n');

    await relayLoop();
  } catch (error: unknown) {
    console.error('❌ Failed to start relay:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  console.log('\n\n🛑 Shutting down outbox relay...');

  shouldStop = true;

  try {
    await rabbitmqUtils.closeRabbitMQ();
  } catch (error: unknown) {
    console.error('❌ Error during shutdown:', error);
  }

  console.log('✅ Outbox Relay stopped');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', (error: unknown) => {
  console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught exception:', error);
  shutdown();
});

startRelay();
