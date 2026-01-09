import connectDB from '@chat3/config';
import { DialogReadTask } from '@chat3/models';
import { runDialogReadTask } from '@chat3/utils/dialogReadTaskUtils.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

const POLL_INTERVAL_MS = parseInt(process.env.DIALOG_READ_TASK_POLL_MS || '2000', 10);
const BATCH_SIZE = parseInt(process.env.DIALOG_READ_BATCH_SIZE || '200', 10);

let shouldStop = false;
let currentTask = null;

/**
 * Получение следующей задачи из очереди
 */
async function fetchNextTask() {
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
async function processTask(task) {
  try {
    console.log(`🧹 Running dialog read task ${task._id} for ${task.dialogId}/${task.userId}`);
    await runDialogReadTask(task, { batchSize: BATCH_SIZE });
    console.log(`✅ Task ${task._id} completed`);
  } catch (error) {
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
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Основной цикл воркера
 */
async function workerLoop() {
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
    } catch (error) {
      console.error('❌ Error in worker loop:', error);
      // Продолжаем работу после ошибки
      await delay(POLL_INTERVAL_MS);
    }
  }
}

/**
 * Запуск воркера
 */
async function startWorker() {
  try {
    console.log('🚀 Starting Dialog Read Worker...\n');

    // Подключаемся к MongoDB
    await connectDB();
    console.log('✅ MongoDB connected\n');

    console.log('👂 Polling for dialog read tasks...\n');
    console.log(`   Poll interval: ${POLL_INTERVAL_MS}ms`);
    console.log(`   Batch size: ${BATCH_SIZE}\n`);

    // Запускаем основной цикл
    await workerLoop();
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
  
  console.log('✅ Dialog Read Worker stopped');
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

