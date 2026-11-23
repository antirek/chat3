import {
  initOtel,
  setHealth,
  startHealthPoll,
  shutdownOtel
} from '@chat3/utils/otel.js';
import mongoose from 'mongoose';
import connectDB from '@chat3/utils/databaseUtils.js';
import { DialogReadTask } from '@chat3/models';
import type { IDialogReadTask } from '@chat3/models';
import { runDialogReadTask } from '@chat3/utils/dialogReadTaskUtils.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import type { Document } from 'mongoose';

initOtel({ instrumentations: ['mongoose'] });

type DialogReadTaskDocument = Document & IDialogReadTask;

const POLL_INTERVAL_MS = parseInt(process.env.DIALOG_READ_TASK_POLL_MS || '2000', 10);
const BATCH_SIZE = parseInt(process.env.DIALOG_READ_BATCH_SIZE || '200', 10);

let shouldStop = false;
let currentTask: DialogReadTaskDocument | null = null;

/**
 * Получение следующей задачи из очереди
 */
async function fetchNextTask(): Promise<DialogReadTaskDocument | null> {
  return DialogReadTask.findOneAndUpdate(
    { status: 'pending' },
    {
      status: 'running',
      startedAt: generateTimestamp(),
      error: null
    },
    {
      sort: { createdAt: 1 },
      new: true
    }
  );
}

/**
 * Обработка задачи
 */
async function processTask(task: DialogReadTaskDocument): Promise<void> {
  try {
    console.log(`🧹 Running dialog read task ${task._id} for ${task.dialogId}/${task.userId}`);
    await runDialogReadTask(task, { batchSize: BATCH_SIZE });
    console.log(`✅ Task ${task._id} completed`);
  } catch (error: any) {
    console.error(`❌ Task ${task._id} failed:`, error.message);
    task.status = 'failed';
    task.error = error.message;
    task.finishedAt = generateTimestamp();
    await task.save();
  }
}

/**
 * Задержка между опросами
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Основной цикл воркера
 */
async function workerLoop(): Promise<void> {
  while (!shouldStop) {
    try {
      const task = await fetchNextTask();

      if (!task) {
        await delay(POLL_INTERVAL_MS);
        continue;
      }

      currentTask = task;
      await processTask(task);
      currentTask = null;
    } catch (error: any) {
      console.error('❌ Error in worker loop:', error);
      // Продолжаем работу после ошибки
      await delay(POLL_INTERVAL_MS);
    }
  }
}

/**
 * Запуск воркера
 */
async function startWorker(): Promise<void> {
  try {
    console.log('🚀 Starting Dialog Read Worker...\n');

    // Подключаемся к MongoDB
    await connectDB();
    console.log('✅ MongoDB connected\n');

    startHealthPoll(() => mongoose.connection.readyState === 1, POLL_INTERVAL_MS);
    setHealth(1);

    console.log('👂 Polling for dialog read tasks...\n');
    console.log(`   Poll interval: ${POLL_INTERVAL_MS}ms`);
    console.log(`   Batch size: ${BATCH_SIZE}\n`);

    // Запускаем основной цикл
    await workerLoop();
  } catch (error: any) {
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
  setHealth(0);
  
  shouldStop = true;
  
  // Если есть текущая задача, ждем её завершения
  if (currentTask) {
    console.log(`⏳ Waiting for current task ${currentTask._id} to complete...`);
    // Даем время на завершение (максимум 30 секунд)
    const maxWait = 30000;
    const startTime = Date.now();
    while (currentTask && (Date.now() - startTime) < maxWait) {
      await delay(100);
    }
  }

  try {
    await shutdownOtel();
  } catch {
    // ignore
  }
  
  console.log('✅ Dialog Read Worker stopped');
  process.exit(0);
}

// Обработка сигналов завершения
process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});

// Обработка необработанных ошибок
process.on('unhandledRejection', (error: any) => {
  console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught exception:', error);
  void shutdown();
});

// Запускаем воркер
void startWorker();
