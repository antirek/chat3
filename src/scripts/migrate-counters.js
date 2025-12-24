import connectDB from '../config/database.js';
import { 
  DialogMember, 
  Message, 
  MessageReaction, 
  MessageStatus,
  UserStats,
  UserDialogStats,
  MessageReactionStats,
  MessageStatusStats,
  CounterHistory
} from '../models/index.js';
import { generateTimestamp } from '../utils/timestampUtils.js';

/**
 * Скрипт миграции счетчиков из старых моделей в новые коллекции
 * 
 * Мигрирует:
 * 1. unreadCount из dialogmembers в userdialogstats
 * 2. Пересчитывает все счетчики с нуля
 * 3. Создает записи в userstats для всех пользователей
 * 4. Создает записи в messagereactionstats для всех реакций
 * 5. Создает записи в messagestatusstats для всех статусов
 */
async function migrateCounters() {
  try {
    console.log('🚀 Starting counters migration...\n');
    
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Шаг 1: Миграция unreadCount из DialogMember в UserDialogStats
    console.log('📦 Step 1: Migrating unreadCount from DialogMember to UserDialogStats...');
    const dialogMembers = await DialogMember.find({}).lean();
    let migratedCount = 0;
    
    for (const member of dialogMembers) {
      try {
        await UserDialogStats.findOneAndUpdate(
          { tenantId: member.tenantId, userId: member.userId, dialogId: member.dialogId },
          {
            $set: {
              unreadCount: member.unreadCount || 0,
              lastUpdatedAt: generateTimestamp()
            },
            $setOnInsert: {
              createdAt: generateTimestamp()
            }
          },
          { upsert: true, setDefaultsOnInsert: true }
        );
        migratedCount++;
      } catch (error) {
        console.error(`Error migrating unreadCount for ${member.userId}:${member.dialogId}:`, error.message);
      }
    }
    console.log(`✅ Migrated ${migratedCount} unreadCount records\n`);

    // Шаг 2: Пересчет UserStats для всех пользователей
    console.log('📊 Step 2: Recalculating UserStats for all users...');
    const tenantIds = await DialogMember.distinct('tenantId');
    let statsCount = 0;
    
    for (const tenantId of tenantIds) {
      const users = await DialogMember.distinct('userId', { tenantId });
      
      for (const userId of users) {
        try {
          // Получаем все диалоги пользователя для этого тенанта
          const userDialogs = await UserDialogStats.find({ tenantId, userId }).lean();
          
          // Подсчитываем dialogCount (количество уникальных dialogId)
          const dialogCount = new Set(userDialogs.map(d => d.dialogId)).size;
          
          // Подсчитываем unreadDialogsCount (количество диалогов с unreadCount > 0)
          const unreadDialogsCount = userDialogs.filter(d => (d.unreadCount || 0) > 0).length;
          
          // Подсчитываем totalUnreadCount (сумма всех unreadCount)
          const totalUnreadCount = userDialogs.reduce((sum, d) => sum + (d.unreadCount || 0), 0);
          
          // Подсчитываем totalMessagesCount из сообщений
          const messages = await Message.find({ tenantId, senderId: userId }).lean();
          const totalMessagesCount = messages.length;
          
          await UserStats.findOneAndUpdate(
            { tenantId, userId },
            {
              $set: {
                dialogCount,
                unreadDialogsCount,
                totalUnreadCount,
                totalMessagesCount,
                lastUpdatedAt: generateTimestamp()
              },
              $setOnInsert: {
                createdAt: generateTimestamp()
              }
            },
            { upsert: true, setDefaultsOnInsert: true }
          );
          statsCount++;
        } catch (error) {
          console.error(`Error recalculating stats for user ${userId} in tenant ${tenantId}:`, error.message);
        }
      }
    }
    console.log(`✅ Recalculated UserStats for ${statsCount} users\n`);

    // Шаг 3: Миграция реакций в MessageReactionStats
    console.log('👍 Step 3: Migrating reactions to MessageReactionStats...');
    const reactions = await MessageReaction.aggregate([
      {
        $group: {
          _id: {
            tenantId: '$tenantId',
            messageId: '$messageId',
            reaction: '$reaction'
          },
          count: { $sum: 1 }
        }
      }
    ]);
    
    let reactionStatsCount = 0;
    for (const reaction of reactions) {
      try {
        await MessageReactionStats.findOneAndUpdate(
          {
            tenantId: reaction._id.tenantId,
            messageId: reaction._id.messageId,
            reaction: reaction._id.reaction
          },
          {
            $set: {
              count: reaction.count,
              lastUpdatedAt: generateTimestamp()
            },
            $setOnInsert: {
              createdAt: generateTimestamp()
            }
          },
          { upsert: true, setDefaultsOnInsert: true }
        );
        reactionStatsCount++;
      } catch (error) {
        console.error(`Error migrating reaction ${reaction._id.reaction} for ${reaction._id.messageId}:`, error.message);
      }
    }
    console.log(`✅ Migrated ${reactionStatsCount} reaction stats\n`);

    // Шаг 4: Миграция статусов в MessageStatusStats
    console.log('📋 Step 4: Migrating statuses to MessageStatusStats...');
    const statuses = await MessageStatus.aggregate([
      {
        $group: {
          _id: {
            tenantId: '$tenantId',
            messageId: '$messageId',
            status: '$status'
          },
          count: { $sum: 1 }
        }
      }
    ]);
    
    let statusStatsCount = 0;
    for (const status of statuses) {
      try {
        await MessageStatusStats.findOneAndUpdate(
          {
            tenantId: status._id.tenantId,
            messageId: status._id.messageId,
            status: status._id.status
          },
          {
            $set: {
              count: status.count,
              lastUpdatedAt: generateTimestamp()
            },
            $setOnInsert: {
              createdAt: generateTimestamp()
            }
          },
          { upsert: true, setDefaultsOnInsert: true }
        );
        statusStatsCount++;
      } catch (error) {
        console.error(`Error migrating status ${status._id.status} for ${status._id.messageId}:`, error.message);
      }
    }
    console.log(`✅ Migrated ${statusStatsCount} status stats\n`);

    // Шаг 5: Валидация миграции
    console.log('🔍 Step 5: Validating migration...');
    
    const dialogMembersCount = await DialogMember.countDocuments({});
    const userDialogStatsCount = await UserDialogStats.countDocuments({});
    
    console.log(`   DialogMember records: ${dialogMembersCount}`);
    console.log(`   UserDialogStats records: ${userDialogStatsCount}`);
    
    if (dialogMembersCount !== userDialogStatsCount) {
      console.warn(`⚠️  Warning: Count mismatch! DialogMember: ${dialogMembersCount}, UserDialogStats: ${userDialogStatsCount}`);
    } else {
      console.log('✅ UserDialogStats count matches DialogMember count');
    }
    
    // Проверяем консистентность UserStats
    const userStatsCount = await UserStats.countDocuments({});
    console.log(`   UserStats records: ${userStatsCount}`);
    
    // Проверяем консистентность реакций
    const reactionsCount = await MessageReaction.countDocuments({});
    const reactionStatsTotal = await MessageReactionStats.aggregate([
      { $group: { _id: null, total: { $sum: '$count' } } }
    ]);
    const reactionStatsTotalCount = reactionStatsTotal[0]?.total || 0;
    
    console.log(`   MessageReaction records: ${reactionsCount}`);
    console.log(`   MessageReactionStats total count: ${reactionStatsTotalCount}`);
    
    if (reactionsCount !== reactionStatsTotalCount) {
      console.warn(`⚠️  Warning: Reaction count mismatch! MessageReaction: ${reactionsCount}, MessageReactionStats total: ${reactionStatsTotalCount}`);
    } else {
      console.log('✅ MessageReactionStats count matches MessageReaction count');
    }
    
    // Проверяем консистентность статусов
    const statusesCount = await MessageStatus.countDocuments({});
    const statusStatsTotal = await MessageStatusStats.aggregate([
      { $group: { _id: null, total: { $sum: '$count' } } }
    ]);
    const statusStatsTotalCount = statusStatsTotal[0]?.total || 0;
    
    console.log(`   MessageStatus records: ${statusesCount}`);
    console.log(`   MessageStatusStats total count: ${statusStatsTotalCount}`);
    
    if (statusesCount !== statusStatsTotalCount) {
      console.warn(`⚠️  Warning: Status count mismatch! MessageStatus: ${statusesCount}, MessageStatusStats total: ${statusStatsTotalCount}`);
    } else {
      console.log('✅ MessageStatusStats count matches MessageStatus count');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n⚠️  IMPORTANT: After verifying the migration, you can remove the unreadCount field from DialogMember schema.');
    console.log('   This should be done in a separate step after thorough testing.\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Запускаем миграцию
migrateCounters();

