import connectDB from '@chat3/config';
import { User } from '@chat3/models';

async function updateBotUsersType() {
  try {
    await connectDB();
    console.log('🔧 Updating bot users type...\n');

    // Находим всех пользователей с userId начинающимся с "bot_"
    const botUsers = await User.find({
      userId: { $regex: /^bot_/i }
    });

    console.log(`Found ${botUsers.length} users with bot_ prefix`);

    if (botUsers.length === 0) {
      console.log('✅ No bot users found');
      process.exit(0);
    }

    // Обновляем всех пользователей с префиксом bot_, устанавливая type = 'bot'
    const result = await User.updateMany(
      {
        userId: { $regex: /^bot_/i }
      },
      {
        $set: { type: 'bot' }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} users with type='bot'`);

    // Проверяем результат
    const remaining = await User.countDocuments({
      userId: { $regex: /^bot_/i },
      type: { $ne: 'bot' }
    });

    if (remaining === 0) {
      console.log('✅ All bot users now have type=\'bot\'');
    } else {
      console.log(`⚠️  Warning: ${remaining} bot users still don't have type='bot'`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating bot users type:', error);
    process.exit(1);
  }
}

updateBotUsersType();

