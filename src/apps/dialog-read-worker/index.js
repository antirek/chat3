import connectDB from '../../config/database.js';
import { DialogReadTask } from '../../models/index.js';
import { runDialogReadTask } from '../tenant-api/utils/dialogReadTaskUtils.js';
import { generateTimestamp } from '../../utils/timestampUtils.js';

const POLL_INTERVAL_MS = parseInt(process.env.DIALOG_READ_TASK_POLL_MS || '2000', 10);
const BATCH_SIZE = parseInt(process.env.DIALOG_READ_BATCH_SIZE || '200', 10);

let shouldStop = false;

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

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function workerLoop() {
  while (!shouldStop) {
    const task = await fetchNextTask();

    if (!task) {
      await delay(POLL_INTERVAL_MS);
      continue;
    }

    await processTask(task);
  }
}

async function startWorker() {
  try {
    console.log('🚀 Starting Dialog Read Worker...');
    await connectDB();
    console.log('✅ MongoDB connected');
    await workerLoop();
  } catch (error) {
    console.error('❌ Dialog Read Worker crashed:', error);
    process.exit(1);
  }
}

function shutdown() {
  console.log('\n🛑 Stopping Dialog Read Worker...');
  shouldStop = true;
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startWorker();

