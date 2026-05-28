/**
 * Пересчёт UserPackUnreadBySenderType из UserDialogUnreadBySenderType для всех паков тенантов.
 * Запуск: npm run sync-pack-stats --workspace=@chat3/controlo-backend
 * Требует MONGODB_URI в окружении (как при start-all.sh).
 */
import connectDB from '@chat3/utils/databaseUtils.js';
import { recalculateUserPackUnreadBySenderType } from '@chat3/utils/packStatsUtils.js';
import { Tenant, Pack } from '@chat3/models';

async function run() {
  try {
    await connectDB();
    console.log('📦 Sync pack unread-by-sender: start\n');

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
      const packIds = await Pack.find({ tenantId: t.tenantId }).distinct('packId').exec();
      for (const packId of packIds) {
        try {
          await recalculateUserPackUnreadBySenderType(t.tenantId, packId, {
            sourceOperation: 'sync-pack-stats',
            sourceEntityId: packId
          });
          totalPacks++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          allErrors.push(`Pack ${packId}: ${message}`);
        }
      }
      console.log(`   ✅ ${packIds.length} packs synced`);
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
