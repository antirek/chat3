/**
 * Скрипт для обновления индекса MessageReaction
 * Удаляет старый уникальный индекс { tenantId, messageId, userId }
 * и создает новый { tenantId, messageId, userId, reaction }
 * 
 * Запуск: node src/scripts/update-message-reaction-index.js
 */

import connectDB from '../config/database.js';
import mongoose from 'mongoose';

async function updateIndex() {
  try {
    await connectDB();
    console.log('✅ Подключение к базе данных установлено\n');

    const db = mongoose.connection.db;
    const collection = db.collection('messagereactions');

    console.log('📋 Текущие индексы:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });
    console.log('');

    // Удаляем старый уникальный индекс
    const oldIndexName = 'tenantId_1_messageId_1_userId_1';
    try {
      await collection.dropIndex(oldIndexName);
      console.log(`✅ Старый индекс "${oldIndexName}" удален`);
    } catch (error) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log(`ℹ️  Старый индекс "${oldIndexName}" не найден (возможно, уже удален)`);
      } else {
        throw error;
      }
    }

    // Создаем новый уникальный индекс
    const newIndex = { tenantId: 1, messageId: 1, userId: 1, reaction: 1 };
    try {
      await collection.createIndex(newIndex, { unique: true, name: 'tenantId_1_messageId_1_userId_1_reaction_1' });
      console.log(`✅ Новый уникальный индекс создан:`, JSON.stringify(newIndex));
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log(`ℹ️  Новый индекс уже существует`);
      } else {
        throw error;
      }
    }

    console.log('\n📋 Обновленные индексы:');
    const updatedIndexes = await collection.indexes();
    updatedIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(unique)' : '');
    });

    console.log('\n✅ Обновление индексов завершено успешно');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при обновлении индексов:', error);
    process.exit(1);
  }
}

updateIndex();

