import connectDB from '@chat3/config';
import { MessageStatus, User } from '@chat3/models';

async function fillMessageStatusUserType() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Находим все MessageStatus без userType или с userType = null/undefined
    const statusesWithoutUserType = await MessageStatus.find({
      $or: [
        { userType: { $exists: false } },
        { userType: null },
        { userType: undefined }
      ]
    }).lean();

    console.log(`Found ${statusesWithoutUserType.length} MessageStatus records without userType`);

    if (statusesWithoutUserType.length === 0) {
      console.log('✅ All MessageStatus records already have userType');
      process.exit(0);
    }

    let updated = 0;
    let notFound = 0;

    // Группируем по tenantId для оптимизации
    const statusesByTenant = {};
    for (const status of statusesWithoutUserType) {
      if (!statusesByTenant[status.tenantId]) {
        statusesByTenant[status.tenantId] = [];
      }
      statusesByTenant[status.tenantId].push(status);
    }

    // Обрабатываем каждый tenant
    for (const [tenantId, statuses] of Object.entries(statusesByTenant)) {
      console.log(`\nProcessing tenant: ${tenantId} (${statuses.length} records)`);

      // Получаем уникальные userId из статусов
      const userIds = [...new Set(statuses.map(s => s.userId))];
      
      // Загружаем пользователей для этого tenant
      const users = await User.find({
        tenantId: tenantId,
        userId: { $in: userIds }
      }).select('userId type').lean();

      // Создаем Map для быстрого поиска типа пользователя
      const userTypeMap = new Map();
      users.forEach(user => {
        userTypeMap.set(user.userId, user.type || 'user');
      });

      // Обновляем статусы
      for (const status of statuses) {
        const userType = userTypeMap.get(status.userId) || 'user';
        
        await MessageStatus.updateOne(
          {
            _id: status._id
          },
          {
            $set: {
              userType: userType
            }
          }
        );

        updated++;
      }

      // Подсчитываем сколько пользователей не найдено
      const foundUserIds = new Set(users.map(u => u.userId));
      const notFoundUserIds = userIds.filter(id => !foundUserIds.has(id));
      notFound += notFoundUserIds.length;

      if (notFoundUserIds.length > 0) {
        console.log(`  ⚠️  ${notFoundUserIds.length} users not found, set userType='user' for them`);
      }
    }

    console.log(`\n✅ Successfully updated ${updated} MessageStatus records`);
    if (notFound > 0) {
      console.log(`   (${notFound} records set to 'user' because users were not found)`);
    }

    // Проверяем результат
    const remainingWithoutUserType = await MessageStatus.countDocuments({
      $or: [
        { userType: { $exists: false } },
        { userType: null },
        { userType: undefined }
      ]
    });

    if (remainingWithoutUserType > 0) {
      console.log(`\n⚠️  Warning: ${remainingWithoutUserType} records still without userType`);
    } else {
      console.log(`\n✅ All MessageStatus records now have userType`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error filling userType:', error);
    process.exit(1);
  }
}

fillMessageStatusUserType();

