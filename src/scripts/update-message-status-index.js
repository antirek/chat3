import connectDB from '@chat3/config';
import mongoose from 'mongoose';

/**
 * Скрипт для обновления индексов MessageStatus
 * Удаляет старый уникальный индекс и создает новые индексы для истории статусов
 */
async function updateMessageStatusIndex() {
  try {
    await connectDB();
    console.log('✅ Connected to database');

    const db = mongoose.connection.db;
    const collection = db.collection('messagestatuses');

    console.log('\n📊 Current indexes:');
    const currentIndexes = await collection.indexes();
    currentIndexes.forEach(index => {
      console.log(`  - ${JSON.stringify(index.key)} (unique: ${index.unique || false})`);
    });

    // Удаляем старый уникальный индекс
    try {
      await collection.dropIndex('messageId_1_userId_1');
      console.log('\n✅ Dropped old unique index: messageId_1_userId_1');
    } catch (error) {
      if (error.code === 27 || error.message.includes('index not found')) {
        console.log('\n⚠️  Old unique index not found (may have been already removed)');
      } else {
        throw error;
      }
    }

    // Создаем новые индексы для истории
    console.log('\n📝 Creating new indexes for status history...');
    
    // Индекс для получения последнего статуса
    await collection.createIndex(
      { messageId: 1, userId: 1, createdAt: -1 },
      { name: 'messageId_1_userId_1_createdAt_-1' }
    );
    console.log('✅ Created index: messageId_1_userId_1_createdAt_-1');

    // Составной индекс для быстрого поиска последнего статуса
    await collection.createIndex(
      { tenantId: 1, messageId: 1, userId: 1, createdAt: -1 },
      { name: 'tenantId_1_messageId_1_userId_1_createdAt_-1' }
    );
    console.log('✅ Created index: tenantId_1_messageId_1_userId_1_createdAt_-1');

    console.log('\n📊 Updated indexes:');
    const updatedIndexes = await collection.indexes();
    updatedIndexes.forEach(index => {
      console.log(`  - ${JSON.stringify(index.key)} (unique: ${index.unique || false})`);
    });

    console.log('\n✅ Index update completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating indexes:', error);
    process.exit(1);
  }
}

updateMessageStatusIndex();

