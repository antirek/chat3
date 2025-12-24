import connectDB from '../../config/database.js';
import * as updateUtils from '../../utils/updateUtils.js';
import * as rabbitmqUtils from '../../utils/rabbitmqUtils.js';
import { DialogMember, UserDialogStats, UserStats } from '../../models/index.js';

const WORKER_QUEUE = 'update_worker_queue';

let consumer = null;


/**
 * Обработка события из RabbitMQ
 */
async function processEvent(eventData) {
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

    console.log(`📩 Processing event: ${eventType} (${entityId})`);

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
        
        // Для dialog.member.add создаем UserStatsUpdate для добавленного пользователя
        if (eventType === 'dialog.member.add') {
          const memberPayload = data.member || {};
          const userId = memberPayload.userId;
          if (userId) {
            try {
              await updateUtils.createUserStatsUpdate(
                tenantId,
                userId,
                eventId,
                eventType,
                ['user.stats.dialogCount']
              );
              console.log(`✅ Created UserStatsUpdate for user ${userId} (dialogCount increased)`);
            } catch (error) {
              // Если пользователь не найден или другая ошибка - логируем, но не прерываем обработку
              console.warn(`⚠️  Failed to create UserStatsUpdate for user ${userId}:`, error.message);
            }
          }
        }
        
        // Для dialog.member.remove создаем UserStatsUpdate для удаленного пользователя
        if (eventType === 'dialog.member.remove') {
          const memberPayload = data.member || {};
          const userId = memberPayload.userId;
          if (userId) {
            try {
              await updateUtils.createUserStatsUpdate(
                tenantId,
                userId,
                eventId,
                eventType,
                ['user.stats.dialogCount']
              );
              console.log(`✅ Created UserStatsUpdate for user ${userId} (dialogCount decreased)`);
            } catch (error) {
              // Если пользователь не найден или другая ошибка - логируем, но не прерываем обработку
              console.warn(`⚠️  Failed to create UserStatsUpdate for user ${userId}:`, error.message);
            }
          }
        }
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
        
        // Проверяем, изменился ли unreadCount (статус диалога)
        // Если в updatedFields есть 'member.state.unreadCount', значит unreadCount изменился
        const updatedFields = context.updatedFields || [];
        if (updatedFields.includes('member.state.unreadCount')) {
          // Получаем текущее значение unreadCount из UserDialogStats
          const currentUserDialogStats = await UserDialogStats.findOne({
            tenantId,
            dialogId,
            userId
          }).lean();
          const currentUnreadCount = currentUserDialogStats?.unreadCount ?? 0;
          const _newUnreadCount = memberPayload.state?.unreadCount ?? currentUnreadCount;
          
          // Проверяем, изменился ли статус диалога (переход через 0)
          // Если currentUnreadCount = 0 и newUnreadCount > 0, значит диалог стал непрочитанным
          // Если currentUnreadCount > 0 и newUnreadCount = 0, значит диалог стал прочитанным
          // Если unreadCount изменился (есть в updatedFields), создаем UserStatsUpdate
          // Статистика будет пересчитана в createUserStatsUpdate
          await updateUtils.createUserStatsUpdate(
            tenantId,
            userId,
            eventId,
            eventType,
            ['user.stats.unreadDialogsCount', 'user.stats.totalUnreadCount']
          );
          console.log(`✅ Created UserStatsUpdate for user ${userId} (unreadCount changed)`);
        }
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
        
        // Для message.create проверяем, у каких пользователей диалог стал непрочитанным
        if (eventType === 'message.create') {
          const senderId = messagePayload.senderId;
          // Получаем всех участников диалога
          const members = await DialogMember.find({
            tenantId,
            dialogId
          }).select('userId').lean();
          
          // Получаем unreadCount из UserDialogStats для всех участников
          const userIds = members.map(m => m.userId).filter(id => id !== senderId);
          if (userIds.length > 0) {
            const userDialogStats = await UserDialogStats.find({
              tenantId,
              dialogId,
              userId: { $in: userIds }
            }).select('userId unreadCount').lean();
            
            // Для каждого участника (кроме отправителя) проверяем, стал ли диалог непрочитанным
            for (const stat of userDialogStats) {
              const unreadCount = stat.unreadCount ?? 0;
              // Если unreadCount = 1 (только что созданное сообщение), значит диалог стал непрочитанным
              if (unreadCount === 1) {
                await updateUtils.createUserStatsUpdate(
                  tenantId,
                  stat.userId,
                  eventId,
                  eventType,
                  ['user.stats.unreadDialogsCount', 'user.stats.totalUnreadCount']
                );
                console.log(`✅ Created UserStatsUpdate for user ${stat.userId} (dialog became unread)`);
              }
            }
          }
          
          // Создаем UserStatsUpdate для отправителя (обновление totalMessagesCount)
          await updateUtils.createUserStatsUpdate(
            tenantId,
            senderId,
            eventId,
            eventType,
            ['user.stats.totalMessagesCount']
          );
          console.log(`✅ Created UserStatsUpdate for sender ${senderId} (totalMessagesCount increased)`);
        }
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

  } catch (error) {
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
async function startWorker() {
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
  
  try {
    // Отменяем consumer
    if (consumer) {
      await consumer.cancel();
      console.log('✅ Consumer cancelled');
    }
    
    // Закрываем RabbitMQ connection (закроет все consumer'ы)
    // closeRabbitMQ() уже выводит сообщение о закрытии
    await rabbitmqUtils.closeRabbitMQ();
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
  
  process.exit(0);
}

// Обработка сигналов завершения
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Обработка необработанных ошибок
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
  // Не завершаем процесс, только логируем ошибку
  // Это позволяет воркеру продолжать работу даже при ошибках в отдельных событиях
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  // Для критических ошибок все еще завершаем процесс
  // Но это должно происходить только в крайних случаях
  console.error('⚠️  Critical error detected, shutting down...');
  shutdown();
});

// Запускаем воркер
startWorker();

