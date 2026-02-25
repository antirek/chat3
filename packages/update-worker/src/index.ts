import connectDB from '@chat3/utils/databaseUtils.js';
import * as updateUtils from '@chat3/utils/updateUtils.js';
import * as rabbitmqUtils from '@chat3/utils/rabbitmqUtils.js';
import {
  updateDialogTopicCount,
  updateDialogMemberCount,
  updateDialogMessageCount
} from '@chat3/utils/counterUtils.js';
import {
  getPackIdsForDialog,
  recalculatePackStats,
  recalculateUserPackUnreadBySenderType
} from '@chat3/utils/packStatsUtils.js';

const WORKER_QUEUE = 'update_worker_queue';

interface ConsumerObject {
  consumerTag: string;
  cancel: () => Promise<void>;
  restart: () => Promise<void>;
}

let consumer: ConsumerObject | null = null;

interface EventData {
  _id: any;
  tenantId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  data?: any; // Гибкий тип, так как структура data зависит от типа события
  [key: string]: any;
}

async function updatePackCountersForDialog(
  tenantId: string,
  dialogId: string,
  sourceEventId: string,
  sourceEventType: string,
  sourceEntityId: string,
  actorId?: string
): Promise<void> {
  const packIds = await getPackIdsForDialog(tenantId, dialogId);
  if (!packIds.length) {
    return;
  }

  for (const packId of packIds) {
    const options = {
      sourceOperation: sourceEventType,
      sourceEntityId,
      actorId: actorId || 'system',
      actorType: 'system'
    };

    const packStatsDoc = await recalculatePackStats(tenantId, packId, options);
    const userPackMap = await recalculateUserPackUnreadBySenderType(tenantId, packId, options);

    if (packStatsDoc) {
      await updateUtils.createPackStatsUpdate(
        tenantId,
        packId,
        sourceEventId,
        sourceEventType,
        {
          messageCount: packStatsDoc.messageCount,
          uniqueMemberCount: packStatsDoc.uniqueMemberCount,
          sumMemberCount: packStatsDoc.sumMemberCount,
          uniqueTopicCount: packStatsDoc.uniqueTopicCount,
          sumTopicCount: packStatsDoc.sumTopicCount,
          lastUpdatedAt: packStatsDoc.lastUpdatedAt ?? null
        }
      );
    }

    const userIds = Object.keys(userPackMap);
    for (const userId of userIds) {
      const userStats = userPackMap[userId];
      await updateUtils.createUserPackStatsUpdate(
        tenantId,
        userId,
        packId,
        sourceEventId,
        sourceEventType,
        {
          unreadCount: userStats?.unreadCount ?? 0,
          lastUpdatedAt: userStats?.lastUpdatedAt ?? null,
          unreadBySenderType: userStats?.unreadBySenderType ?? null
        }
      );
    }

    console.log(`📦 Updated pack stats for pack ${packId} (dialog ${dialogId})`);
  }
}

/**
 * Обработка события из RabbitMQ
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

    const context = data.context || {};
    const dialogPayload = data.dialog || {};
    const memberPayload = data.member || {};
    const messagePayload = data.message || {};
    const typingPayload = data.typing || {};
    const _topicPayload = data.topic || {};

    console.log(`📩 Processing event: ${eventType} (${entityId})`);

    // Обновление DialogStats при событиях
    let dialogIdForPackUpdate: string | null = null;

    if (eventType === 'dialog.topic.create') {
      const dialogId = context.dialogId || dialogPayload.dialogId;
      if (dialogId) {
        await updateDialogTopicCount(tenantId, dialogId, 1);
        console.log(`✅ Updated DialogStats.topicCount for dialog ${dialogId}`);
        dialogIdForPackUpdate = dialogId;
      }
    } else if (eventType === 'dialog.member.add') {
      const dialogId = context.dialogId || dialogPayload.dialogId;
      if (dialogId) {
        await updateDialogMemberCount(tenantId, dialogId, 1);
        console.log(`✅ Updated DialogStats.memberCount for dialog ${dialogId}`);
        dialogIdForPackUpdate = dialogId;
      }
    } else if (eventType === 'dialog.member.remove') {
      const dialogId = context.dialogId || dialogPayload.dialogId;
      if (dialogId) {
        await updateDialogMemberCount(tenantId, dialogId, -1);
        console.log(`✅ Updated DialogStats.memberCount for dialog ${dialogId}`);
        dialogIdForPackUpdate = dialogId;
      }
    } else if (eventType === 'message.create') {
      const dialogId = context.dialogId || dialogPayload.dialogId || messagePayload.dialogId;
      if (dialogId) {
        await updateDialogMessageCount(tenantId, dialogId, 1);
        console.log(`✅ Updated DialogStats.messageCount for dialog ${dialogId}`);
        dialogIdForPackUpdate = dialogId;
      }
    } else if (eventType === 'message.status.update') {
      // UserDialogStats уже обновлён в MessageStatus.post('save'); пересчитываем счётчики пака и шлём update
      const dialogId = context.dialogId || dialogPayload.dialogId || messagePayload.dialogId;
      if (dialogId) {
        dialogIdForPackUpdate = dialogId;
      }
    }

    if (dialogIdForPackUpdate) {
      await updatePackCountersForDialog(
        tenantId,
        dialogIdForPackUpdate,
        String(eventId),
        eventType,
        String(entityId),
        eventData.actorId
      );
    }

    // Определяем, нужно ли создавать update
    const shouldUpdate = updateUtils.shouldCreateUpdate(eventType);
    
    if (shouldUpdate.dialog) {
      // Для диалоговых событий нужен dialogId
      let dialogId = context.dialogId || dialogPayload.dialogId;
      
      if (!dialogId && entityType === 'dialog') {
        dialogId = entityId;
      } else if (!dialogId && entityType === 'dialogMember') {
        dialogId = entityId;
      }
      
      if (dialogId) {
        // Передаем весь объект data из события (содержит dialog, member, message, typing, context)
        // updateUtils.createDialogUpdate использует eventData.dialog напрямую из этого объекта
        await updateUtils.createDialogUpdate(tenantId, dialogId, eventId, eventType, data);
        console.log(`✅ Created DialogUpdate for event ${eventId}`);
        
        // ВАЖНО: user.stats.update для dialog.member.add/remove создается синхронно в контроллере
        // через finalizeCounterUpdateContext, поэтому здесь не создаем дубликаты
      } else {
        console.warn(`⚠️ No dialogId found for event ${eventId}`);
      }
    }
    
    if (shouldUpdate.dialogMember) {
      // Для событий dialog.member.update создаем update только для конкретного участника
      const dialogId = context.dialogId || dialogPayload.dialogId;
      const userId = memberPayload.userId || data.userId;
      
      if (dialogId && userId) {
        // Передаем весь объект data из события (содержит dialog, member, message, typing, context)
        // updateUtils.createDialogMemberUpdate использует eventData.dialog и eventData.member напрямую из этого объекта
        await updateUtils.createDialogMemberUpdate(tenantId, dialogId, userId, eventId, eventType, data);
        console.log(`✅ Created DialogMemberUpdate for user ${userId} in event ${eventId}`);
        
        // ВАЖНО: user.stats.update для изменения unreadCount создается синхронно 
        // в dialogMemberController.setUnreadCount через finalizeCounterUpdateContext
      } else {
        console.warn(`⚠️ No dialogId or userId found for event ${eventId}`);
      }
    }
    
    if (shouldUpdate.message) {
      // Для событий сообщений нужен dialogId из data
      let dialogId = context.dialogId || dialogPayload.dialogId || messagePayload.dialogId;
      let messageId = context.messageId || messagePayload.messageId;
      
      if (!dialogId && entityType === 'message') {
        dialogId = entityId;
      }
      if (!messageId && entityType === 'message') {
        messageId = entityId;
      }
      
      if (dialogId && messageId) {
        await updateUtils.createMessageUpdate(tenantId, dialogId, messageId, eventId, eventType, data);
        console.log(`✅ Created MessageUpdate for event ${eventId}`);
        
        // ВАЖНО: user.stats.update для message.create создается синхронно
        // в messageController.create через finalizeCounterUpdateContext:
        // - для получателей (unreadCount изменился)
        // - для отправителя (totalMessagesCount увеличился)
      } else {
        console.warn(`⚠️ No dialogId or messageId found for event ${eventId}`);
      }
    }

    if (shouldUpdate.typing) {
      const dialogId = context.dialogId || dialogPayload.dialogId || entityId;
      const typingUserId = typingPayload.userId || memberPayload.userId || eventData.actorId;

      if (dialogId && typingUserId) {
        await updateUtils.createTypingUpdate(tenantId, dialogId, typingUserId, eventId, eventType, data);
        console.log(`✅ Created TypingUpdate for dialog ${dialogId}`);
      } else {
        console.warn(`⚠️ Missing dialogId or userId for typing event ${eventId}`);
      }
    }

    if (shouldUpdate.user) {
      // Для событий user.* создаем update только для конкретного пользователя
      const userPayload = data.user || {};
      const userId = userPayload.userId || eventData.actorId || entityId;

      if (userId) {
        await updateUtils.createUserUpdate(tenantId, userId, eventId, eventType, data);
        console.log(`✅ Created UserUpdate for user ${userId} from event ${eventId}`);
      } else {
        console.warn(`⚠️ No userId found for user event ${eventId}`);
      }
    }

    if (!shouldUpdate.dialog && !shouldUpdate.dialogMember && !shouldUpdate.message && !shouldUpdate.typing && !shouldUpdate.user) {
      console.log(`ℹ️ Event ${eventType} does not require update creation`);
    }

  } catch (error: any) {
    console.error('❌ Error processing event:', error);
    console.error('   Event data:', JSON.stringify(eventData, null, 2));
    // Не выбрасываем ошибку, чтобы не завершать процесс
    // Сообщение будет обработано как успешное (ack), чтобы избежать бесконечных повторов
    // Если нужно повторить обработку, это должно быть реализовано через retry механизм
  }
}

/**
 * Запуск воркера
 */
async function startWorker(): Promise<void> {
  try {
    console.log('🚀 Starting Update Worker...\n');

    // Подключаемся к MongoDB
    await connectDB();
    console.log('✅ MongoDB connected\n');

    // Инициализируем RabbitMQ (для публикации updates)
    console.log('🐰 Initializing RabbitMQ...');
    const rabbitmqConnected = await rabbitmqUtils.initRabbitMQ();
    if (!rabbitmqConnected) {
      console.error('❌ Cannot start worker without RabbitMQ connection');
      process.exit(1);
    }
    console.log('✅ RabbitMQ initialized\n');

    // Создаем consumer для обработки событий
    console.log('👂 Creating consumer for events...\n');
    consumer = await rabbitmqUtils.createConsumer(
      WORKER_QUEUE,
      ['#'], // Привязываемся ко всем событиям
      {
        prefetch: 1,
        queueTTL: 3600000, // 1 час TTL для сообщений
        durable: true
      },
      processEvent // Обработчик сообщений
    );
    console.log('✅ Consumer created successfully\n');

    console.log('✅ Update Worker is running');
    console.log('   Press Ctrl+C to stop\n');

  } catch (error: any) {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  console.log('\n\n🛑 Shutting down worker...');
  
  try {
    // Отменяем consumer
    if (consumer) {
      await consumer.cancel();
      console.log('✅ Consumer cancelled');
    }
    
    // Закрываем RabbitMQ connection (закроет все consumer'ы)
    // closeRabbitMQ() уже выводит сообщение о закрытии
    await rabbitmqUtils.closeRabbitMQ();
  } catch (error: any) {
    console.error('❌ Error during shutdown:', error);
  }
  
  process.exit(0);
}

// Обработка сигналов завершения
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Обработка необработанных ошибок
process.on('unhandledRejection', (error: any) => {
  console.error('❌ Unhandled promise rejection:', error);
  // Не завершаем процесс, только логируем ошибку
  // Это позволяет воркеру продолжать работу даже при ошибках в отдельных событиях
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught exception:', error);
  // Для критических ошибок все еще завершаем процесс
  // Но это должно происходить только в крайних случаях
  console.error('⚠️  Critical error detected, shutting down...');
  shutdown();
});

// Запускаем воркер
startWorker();
