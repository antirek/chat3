import mongoose from 'mongoose';
import connectDB from '@chat3/config';
import { DialogMember, UserDialogActivity } from '@chat3/models';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

/**
 * Миграция данных: перенос lastSeenAt и lastMessageAt из DialogMember в UserDialogActivity
 */
async function migrateDialogActivity() {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB');

    // Получаем все DialogMember записи с lastSeenAt или lastMessageAt
    const members = await DialogMember.find({
      $or: [
        { lastSeenAt: { $exists: true, $ne: null } },
        { lastMessageAt: { $exists: true, $ne: null } }
      ]
    }).lean();

    console.log(`📊 Found ${members.length} DialogMember records to migrate`);

    let migrated = 0;
    let errors = 0;

    for (const member of members) {
      try {
        // Создаем или обновляем запись в UserDialogActivity
        await UserDialogActivity.findOneAndUpdate(
          {
            tenantId: member.tenantId,
            userId: member.userId,
            dialogId: member.dialogId
          },
          {
            tenantId: member.tenantId,
            userId: member.userId,
            dialogId: member.dialogId,
            lastSeenAt: member.lastSeenAt || generateTimestamp(),
            lastMessageAt: member.lastMessageAt || generateTimestamp()
          },
          { upsert: true, new: true }
        );

        migrated++;
        if (migrated % 100 === 0) {
          console.log(`  Progress: ${migrated}/${members.length} records migrated`);
        }
      } catch (error) {
        console.error(`  Error migrating member ${member.userId} in dialog ${member.dialogId}:`, error.message);
        errors++;
      }
    }

    console.log(`✅ Successfully migrated ${migrated} records`);
    if (errors > 0) {
      console.log(`⚠️  ${errors} errors occurred`);
    }

    // Проверяем, что все данные мигрированы
    const activityCount = await UserDialogActivity.countDocuments();
    console.log(`📊 Total UserDialogActivity records: ${activityCount}`);

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

migrateDialogActivity().catch(console.error);

