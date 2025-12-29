import connectDB from '../config/database.js';
import { Dialog, DialogMember, Message, Topic, DialogStats } from '../models/index.js';
import { recalculateDialogStats } from '../utils/counterUtils.js';

/**
 * Скрипт миграции для создания DialogStats для всех существующих диалогов
 * Скрипт идемпотентный - можно запускать несколько раз без дублирования
 */
async function migrateDialogStats() {
  try {
    console.log('🔄 Starting DialogStats migration...');
    
    // Подключаемся к БД
    await connectDB();
    console.log('✅ Connected to database');

    // Получаем все уникальные tenantId
    const tenants = await Dialog.distinct('tenantId');
    console.log(`📊 Found ${tenants.length} tenants`);

    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    // Обрабатываем каждый tenant
    for (const tenantId of tenants) {
      console.log(`\n📦 Processing tenant: ${tenantId}`);
      
      // Получаем все диалоги для этого tenant
      const dialogs = await Dialog.find({ tenantId }).select('dialogId').lean();
      console.log(`   Found ${dialogs.length} dialogs`);

      // Обрабатываем диалоги батчами по 50
      const BATCH_SIZE = 50;
      for (let i = 0; i < dialogs.length; i += BATCH_SIZE) {
        const batch = dialogs.slice(i, i + BATCH_SIZE);
        
        await Promise.all(
          batch.map(async (dialog) => {
            try {
              const dialogId = dialog.dialogId;
              
              // Проверяем, существует ли уже DialogStats
              const existingStats = await DialogStats.findOne({
                tenantId,
                dialogId
              }).lean();

              if (existingStats) {
                // Если уже существует, пересчитываем для консистентности
                const recalculated = await recalculateDialogStats(tenantId, dialogId);
                totalUpdated++;
                if (totalUpdated % 100 === 0) {
                  console.log(`   ✅ Updated ${totalUpdated} DialogStats records`);
                }
              } else {
                // Если не существует, создаем с пересчитанными значениями
                const stats = await recalculateDialogStats(tenantId, dialogId);
                totalCreated++;
                if (totalCreated % 100 === 0) {
                  console.log(`   ✅ Created ${totalCreated} DialogStats records`);
                }
              }
              
              totalProcessed++;
            } catch (error) {
              console.error(`   ❌ Error processing dialog ${dialog.dialogId}:`, error.message);
              totalErrors++;
            }
          })
        );

        // Логируем прогресс
        if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= dialogs.length) {
          console.log(`   📊 Progress: ${Math.min(i + BATCH_SIZE, dialogs.length)}/${dialogs.length} dialogs processed`);
        }
      }
    }

    console.log('\n✅ Migration completed!');
    console.log(`   Total processed: ${totalProcessed}`);
    console.log(`   Total created: ${totalCreated}`);
    console.log(`   Total updated: ${totalUpdated}`);
    console.log(`   Total errors: ${totalErrors}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Запускаем миграцию
migrateDialogStats();
