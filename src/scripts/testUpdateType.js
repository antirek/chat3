import connectDB from '../config/database.js';
import { User } from '../models/index.js';

async function testUpdateType() {
  try {
    await connectDB();
    console.log('🔍 Testing type update...\n');

    const userId = 'usr_phvbef1n';
    const tenantId = 'tnt_default';

    // Проверяем текущее состояние
    const before = await User.findOne({ userId, tenantId }).lean();
    console.log('Before update:', JSON.stringify(before, null, 2));

    // Пробуем обновить напрямую через MongoDB
    const result = await User.updateOne(
      { userId, tenantId },
      { $set: { type: 'bot' } }
    );

    console.log(`\nUpdate result:`, result);

    // Проверяем после обновления
    const after = await User.findOne({ userId, tenantId }).lean();
    console.log('\nAfter update:', JSON.stringify(after, null, 2));
    console.log(`\nType changed: ${before?.type} -> ${after?.type}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testUpdateType();

