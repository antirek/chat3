import connectDB from '@chat3/utils/databaseUtils.js';
import * as updateUtils from '@chat3/utils/updateUtils.js';
import * as rabbitmqUtils from '@chat3/utils/rabbitmqUtils.js';

const WORKER_QUEUE = 'update_worker_queue';

interface ConsumerObject {
  consumerTag: string;
  cancel: () => Promise<void>;
  restart: () => Promise<void>;
}

let consumer: ConsumerObject | null = null;

interface EventData {
  _id: unknown;
  tenantId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Обработка события из RabbitMQ — только domain Updates (без записи stats).
 */
async function processEvent(eventData: EventData): Promise<void> {
  try {
    const {
      _id: eventId,
      tenantId,
      eventType,
      entityType,
      entityId,
      data = {}
    } = eventData;

    const context = (data.context || {}) as Record<string, unknown>;
    const dialogPayload = (data.dialog || {}) as Record<string, unknown>;
    const memberPayload = (data.member || {}) as Record<string, unknown>;
    const messagePayload = (data.message || {}) as Record<string, unknown>;
    const typingPayload = (data.typing || {}) as Record<string, unknown>;

    console.log(`📩 Processing event: ${eventType} (${entityId})`);

    const shouldUpdate = updateUtils.shouldCreateUpdate(eventType);

    if (shouldUpdate.dialog) {
      let dialogId = (context.dialogId || dialogPayload.dialogId) as string | undefined;

      if (!dialogId && entityType === 'dialog') {
        dialogId = entityId;
      } else if (!dialogId && entityType === 'dialogMember') {
        dialogId = entityId;
      }

      if (dialogId) {
        await updateUtils.createDialogUpdate(tenantId, dialogId, eventId as string, eventType, data);
        console.log(`✅ Created DialogUpdate for event ${eventId}`);
      } else {
        console.warn(`⚠️ No dialogId found for event ${eventId}`);
      }
    }

    if (shouldUpdate.dialogMember) {
      const dialogId = (context.dialogId || dialogPayload.dialogId) as string | undefined;
      const userId = (memberPayload.userId || data.userId) as string | undefined;

      if (dialogId && userId) {
        await updateUtils.createDialogMemberUpdate(tenantId, dialogId, userId, eventId as string, eventType, data);
        console.log(`✅ Created DialogMemberUpdate for user ${userId} in event ${eventId}`);
      } else {
        console.warn(`⚠️ No dialogId or userId found for event ${eventId}`);
      }
    }

    if (shouldUpdate.message) {
      let dialogId = (context.dialogId || dialogPayload.dialogId || messagePayload.dialogId) as string | undefined;
      let messageId = (context.messageId || messagePayload.messageId) as string | undefined;

      if (!dialogId && entityType === 'message') {
        dialogId = entityId;
      }
      if (!messageId && entityType === 'message') {
        messageId = entityId;
      }

      if (dialogId && messageId) {
        await updateUtils.createMessageUpdate(tenantId, dialogId, messageId, eventId as string, eventType, data);
        console.log(`✅ Created MessageUpdate for event ${eventId}`);
      } else {
        console.warn(`⚠️ No dialogId or messageId found for event ${eventId}`);
      }
    }

    if (shouldUpdate.typing) {
      const dialogId = (context.dialogId || dialogPayload.dialogId || entityId) as string | undefined;
      const typingUserId = (typingPayload.userId || memberPayload.userId || eventData.actorId) as string | undefined;

      if (dialogId && typingUserId) {
        await updateUtils.createTypingUpdate(tenantId, dialogId, typingUserId, eventId as string, eventType, data);
        console.log(`✅ Created TypingUpdate for dialog ${dialogId}`);
      } else {
        console.warn(`⚠️ Missing dialogId or userId for typing event ${eventId}`);
      }
    }

    if (shouldUpdate.user) {
      const userPayload = (data.user || {}) as Record<string, unknown>;
      const userId = (userPayload.userId || eventData.actorId || entityId) as string | undefined;

      if (userId) {
        await updateUtils.createUserUpdate(tenantId, userId, eventId as string, eventType, data);
        console.log(`✅ Created UserUpdate for user ${userId} from event ${eventId}`);
      } else {
        console.warn(`⚠️ No userId found for user event ${eventId}`);
      }
    }

    if (!shouldUpdate.dialog && !shouldUpdate.dialogMember && !shouldUpdate.message && !shouldUpdate.typing && !shouldUpdate.user) {
      console.log(`ℹ️ Event ${eventType} does not require update creation`);
    }
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
      processEvent as (eventData: unknown) => Promise<void>
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
