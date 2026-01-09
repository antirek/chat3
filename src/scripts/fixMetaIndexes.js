import connectDB from '@chat3/config';
import { Meta } from '@chat3/models';

async function fixMetaIndexes() {
  try {
    await connectDB();
    console.log('🔧 Fixing Meta collection indexes...\n');

    const collection = Meta.collection;

    // Получаем список всех индексов
    const indexes = await collection.indexes();
    console.log('Current indexes:');
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    console.log('');

    // Удаляем старый индекс без scope (если существует)
    const oldIndexName = 'tenantId_1_entityType_1_entityId_1_key_1';
    try {
      await collection.dropIndex(oldIndexName);
      console.log(`✅ Dropped old index: ${oldIndexName}`);
    } catch (error) {
      if (error.code === 27 || error.message.includes('index not found')) {
        console.log(`ℹ️  Old index ${oldIndexName} not found (already removed)`);
      } else {
        throw error;
      }
    }

    // Удаляем старый уникальный индекс без scope (если существует)
    const oldUniqueIndexName = 'tenantId_1_entityType_1_entityId_1_key_1_scope_1';
    try {
      // Проверяем, существует ли индекс с таким именем, но без unique
      const existingIndex = indexes.find(idx => 
        idx.name === oldUniqueIndexName && !idx.unique
      );
      if (existingIndex) {
        await collection.dropIndex(oldUniqueIndexName);
        console.log(`✅ Dropped non-unique index: ${oldUniqueIndexName}`);
      }
    } catch (error) {
      if (error.code === 27 || error.message.includes('index not found')) {
        console.log(`ℹ️  Index ${oldUniqueIndexName} not found or already correct`);
      } else {
        throw error;
      }
    }

    // Создаем правильный уникальный индекс с scope
    // Mongoose автоматически создаст индекс при следующем подключении,
    // но мы можем создать его вручную для уверенности
    try {
      await collection.createIndex(
        { tenantId: 1, entityType: 1, entityId: 1, key: 1, scope: 1 },
        { unique: true, name: 'tenantId_1_entityType_1_entityId_1_key_1_scope_1' }
      );
      console.log('✅ Created unique index: tenantId_1_entityType_1_entityId_1_key_1_scope_1');
    } catch (error) {
      if (error.code === 85 || error.message.includes('already exists')) {
        console.log('ℹ️  Unique index already exists');
      } else {
        throw error;
      }
    }

    // Проверяем дубликаты в базе данных
    console.log('\n🔍 Checking for duplicate entries...');
    const duplicates = await collection.aggregate([
      {
        $group: {
          _id: {
            tenantId: '$tenantId',
            entityType: '$entityType',
            entityId: '$entityId',
            key: '$key',
            scope: { $ifNull: ['$scope', null] }
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} duplicate entries:`);
      duplicates.forEach((dup, idx) => {
        console.log(`  ${idx + 1}. ${JSON.stringify(dup._id)} - ${dup.count} entries`);
      });
      console.log('\n💡 You may need to manually clean up duplicates before creating the unique index.');
    } else {
      console.log('✅ No duplicate entries found');
    }

    // Показываем финальные индексы
    console.log('\n📋 Final indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      const unique = index.unique ? ' (unique)' : '';
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}${unique}`);
    });

    console.log('\n✅ Index fix completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing indexes:', error);
    process.exit(1);
  }
}

fixMetaIndexes();

