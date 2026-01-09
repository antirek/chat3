import mongoose from 'mongoose';
import connectDB from '@chat3/config';
import { User } from '@chat3/models';

const TENANT_ID = 'tnt_default';
const NUM_USERS = 300;

async function addTestUsers() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    const users = [];
    for (let i = 1; i <= NUM_USERS; i++) {
      const userId = `test_user_${String(i).padStart(3, '0')}`;
      users.push({
        userId,
        tenantId: TENANT_ID,
        type: i % 3 === 0 ? 'bot' : i % 3 === 1 ? 'user' : 'contact',
        createdAt: Date.now() + i, // Небольшое смещение для уникальности
        updatedAt: Date.now() + i
      });
    }

    // Используем insertMany с ordered: false для игнорирования дубликатов
    const result = await User.insertMany(users, { ordered: false });
    console.log(`✅ Successfully added ${result.length} users`);

    // Подсчитываем сколько было добавлено (игнорируя дубликаты)
    const existingCount = await User.countDocuments({ tenantId: TENANT_ID });
    console.log(`📊 Total users in tenant ${TENANT_ID}: ${existingCount}`);

  } catch (error) {
    if (error.code === 11000) {
      console.log('⚠️  Some users already exist, continuing...');
      const existingCount = await User.countDocuments({ tenantId: TENANT_ID });
      console.log(`📊 Total users in tenant ${TENANT_ID}: ${existingCount}`);
    } else {
      console.error('❌ Error adding users:', error);
      throw error;
    }
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

addTestUsers().catch(console.error);

