import connectDB from '@chat3/config';
import { User } from '@chat3/models';

async function updateUsersType() {
  try {
    await connectDB();
    console.log('🔧 Updating user types...\n');

    // Находим всех пользователей без поля type или с type === undefined/null
    const usersToUpdate = await User.find({
      $or: [
        { type: { $exists: false } },
        { type: null },
        { type: undefined }
      ]
    });

    console.log(`Found ${usersToUpdate.length} users without type field`);

    if (usersToUpdate.length === 0) {
      console.log('✅ All users already have type field set');
      process.exit(0);
    }

    // Обновляем всех пользователей, устанавливая type = 'user'
    const result = await User.updateMany(
      {
        $or: [
          { type: { $exists: false } },
          { type: null },
          { type: undefined }
        ]
      },
      {
        $set: { type: 'user' }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} users with type='user'`);

    // Проверяем результат
    const remaining = await User.countDocuments({
      $or: [
        { type: { $exists: false } },
        { type: null },
        { type: undefined }
      ]
    });

    if (remaining === 0) {
      console.log('✅ All users now have type field set');
    } else {
      console.log(`⚠️  Warning: ${remaining} users still don't have type field`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating user types:', error);
    process.exit(1);
  }
}

updateUsersType();

