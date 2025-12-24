import connectDB from '../config/database.js';
import { 
  DialogMember, 
  Message, 
  MessageReaction, 
  MessageStatus,
  UserStats,
  UserDialogStats,
  MessageReactionStats,
  MessageStatusStats
} from '../models/index.js';

/**
 * Скрипт валидации консистентности счетчиков
 * 
 * Проверяет:
 * 1. Консистентность UserStats с UserDialogStats
 * 2. Консистентность MessageReactionStats с MessageReaction
 * 3. Консистентность MessageStatusStats с MessageStatus
 * 4. Выводит отчет о несоответствиях
 */
async function validateCounters() {
  try {
    console.log('🔍 Starting counters validation...\n');
    
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    const issues = [];
    const tenantIds = await DialogMember.distinct('tenantId');

    // Валидация 1: UserStats vs UserDialogStats
    console.log('📊 Validating UserStats...');
    for (const tenantId of tenantIds) {
      const users = await DialogMember.distinct('userId', { tenantId });
      
      for (const userId of users) {
        const stats = await UserStats.findOne({ tenantId, userId }).lean();
        if (!stats) {
          issues.push({
            type: 'missing_userstats',
            tenantId,
            userId,
            message: 'UserStats record not found'
          });
          continue;
        }

        // Проверяем dialogCount
        const realDialogCount = await UserDialogStats.countDocuments({ tenantId, userId });
        if (stats.dialogCount !== realDialogCount) {
          issues.push({
            type: 'dialogcount_mismatch',
            tenantId,
            userId,
            expected: realDialogCount,
            actual: stats.dialogCount,
            message: `dialogCount mismatch: expected ${realDialogCount}, got ${stats.dialogCount}`
          });
        }

        // Проверяем unreadDialogsCount
        const realUnreadDialogsCount = await UserDialogStats.countDocuments({
          tenantId,
          userId,
          unreadCount: { $gt: 0 }
        });
        if (stats.unreadDialogsCount !== realUnreadDialogsCount) {
          issues.push({
            type: 'unreaddialogs_mismatch',
            tenantId,
            userId,
            expected: realUnreadDialogsCount,
            actual: stats.unreadDialogsCount,
            message: `unreadDialogsCount mismatch: expected ${realUnreadDialogsCount}, got ${stats.unreadDialogsCount}`
          });
        }

        // Проверяем totalUnreadCount
        const realTotalUnreadCount = await UserDialogStats.aggregate([
          { $match: { tenantId, userId } },
          { $group: { _id: null, total: { $sum: '$unreadCount' } } }
        ]);
        const realTotal = realTotalUnreadCount[0]?.total || 0;
        if (stats.totalUnreadCount !== realTotal) {
          issues.push({
            type: 'totalunread_mismatch',
            tenantId,
            userId,
            expected: realTotal,
            actual: stats.totalUnreadCount,
            message: `totalUnreadCount mismatch: expected ${realTotal}, got ${stats.totalUnreadCount}`
          });
        }

        // Проверяем totalMessagesCount
        const realTotalMessagesCount = await Message.countDocuments({ tenantId, senderId: userId });
        if (stats.totalMessagesCount !== realTotalMessagesCount) {
          issues.push({
            type: 'totalmessages_mismatch',
            tenantId,
            userId,
            expected: realTotalMessagesCount,
            actual: stats.totalMessagesCount,
            message: `totalMessagesCount mismatch: expected ${realTotalMessagesCount}, got ${stats.totalMessagesCount}`
          });
        }
      }
    }
    console.log(`   Checked ${tenantIds.length} tenants\n`);

    // Валидация 2: MessageReactionStats vs MessageReaction
    console.log('👍 Validating MessageReactionStats...');
    const messages = await Message.distinct('messageId');
    let reactionIssues = 0;
    
    for (const messageId of messages) {
      const reactions = await MessageReaction.find({ messageId }).lean();
      const reactionStats = await MessageReactionStats.find({ messageId }).lean();
      
      // Группируем реакции по типу
      const reactionCounts = {};
      reactions.forEach(r => {
        reactionCounts[r.reaction] = (reactionCounts[r.reaction] || 0) + 1;
      });
      
      // Проверяем соответствие
      for (const [reaction, expectedCount] of Object.entries(reactionCounts)) {
        const stat = reactionStats.find(s => s.reaction === reaction);
        if (!stat) {
          reactionIssues++;
          issues.push({
            type: 'missing_reaction_stat',
            messageId,
            reaction,
            message: `MessageReactionStats record not found for reaction ${reaction}`
          });
        } else if (stat.count !== expectedCount) {
          reactionIssues++;
          issues.push({
            type: 'reaction_count_mismatch',
            messageId,
            reaction,
            expected: expectedCount,
            actual: stat.count,
            message: `Reaction count mismatch for ${reaction}: expected ${expectedCount}, got ${stat.count}`
          });
        }
      }
    }
    console.log(`   Checked ${messages.length} messages, found ${reactionIssues} issues\n`);

    // Валидация 3: MessageStatusStats vs MessageStatus
    console.log('📋 Validating MessageStatusStats...');
    let statusIssues = 0;
    
    for (const messageId of messages) {
      const statuses = await MessageStatus.find({ messageId }).lean();
      const statusStats = await MessageStatusStats.find({ messageId }).lean();
      
      // Группируем статусы по типу
      const statusCounts = {};
      statuses.forEach(s => {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      });
      
      // Проверяем соответствие
      for (const [status, expectedCount] of Object.entries(statusCounts)) {
        const stat = statusStats.find(s => s.status === status);
        if (!stat) {
          statusIssues++;
          issues.push({
            type: 'missing_status_stat',
            messageId,
            status,
            message: `MessageStatusStats record not found for status ${status}`
          });
        } else if (stat.count !== expectedCount) {
          statusIssues++;
          issues.push({
            type: 'status_count_mismatch',
            messageId,
            status,
            expected: expectedCount,
            actual: stat.count,
            message: `Status count mismatch for ${status}: expected ${expectedCount}, got ${stat.count}`
          });
        }
      }
    }
    console.log(`   Checked ${messages.length} messages, found ${statusIssues} issues\n`);

    // Выводим отчет
    console.log('\n📋 Validation Report:');
    console.log(`   Total issues found: ${issues.length}\n`);
    
    if (issues.length === 0) {
      console.log('✅ All counters are consistent!\n');
    } else {
      console.log('❌ Issues found:\n');
      
      // Группируем по типу
      const issuesByType = {};
      issues.forEach(issue => {
        if (!issuesByType[issue.type]) {
          issuesByType[issue.type] = [];
        }
        issuesByType[issue.type].push(issue);
      });
      
      for (const [type, typeIssues] of Object.entries(issuesByType)) {
        console.log(`   ${type}: ${typeIssues.length} issues`);
        // Показываем первые 5 примеров
        typeIssues.slice(0, 5).forEach(issue => {
          console.log(`     - ${issue.message}`);
        });
        if (typeIssues.length > 5) {
          console.log(`     ... and ${typeIssues.length - 5} more`);
        }
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Validation failed:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Запускаем валидацию
validateCounters();

