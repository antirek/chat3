/**
 * Синхронизация UserPackStats из UserDialogStats для всех тенантов.
 * Запуск: npm run sync-pack-stats --workspace=@chat3/controlo-backend
 * Требует MONGODB_URI в окружении (как при start-all.sh).
 */
import connectDB from '@chat3/utils/databaseUtils.js';
import { syncAllUserPackStats } from '@chat3/utils/packStatsUtils.js';
import { Tenant } from '@chat3/models';

async function run() {
  try {
    await connectDB();
    console.log('📦 Sync pack stats: start\n');

    const tenants = await Tenant.find({}).select('tenantId').lean();
    if (!tenants.length) {
      console.log('Нет тенантов в базе.');
      process.exit(0);
      return;
    }

    let totalPacks = 0;
    const allErrors = [];
    for (const t of tenants) {
      console.log(`🔄 Tenant ${t.tenantId}...`);
      const { packsProcessed, errors } = await syncAllUserPackStats(t.tenantId);
      totalPacks += packsProcessed;
      allErrors.push(...errors);
      console.log(`   ✅ ${packsProcessed} packs synced`);
    }

    console.log(`\n✅ Sync completed: ${totalPacks} packs, ${allErrors.length} errors`);
    if (allErrors.length) {
      allErrors.forEach((e) => console.error('   ❌', e));
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Sync pack stats error:', error);
    process.exit(1);
  }
}

run();
