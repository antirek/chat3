/**
 * Скрипт создания паков и привязки к ним диалогов.
 * Использует только диалоги, в которых участвует alice_default (или другой указанный пользователь).
 * Запуск из корня репозитория: node packages-control/controlo-backend/scripts/seed-packs.js
 * Или из packages-control/controlo-backend: node scripts/seed-packs.js
 */
import connectDB from '@chat3/utils/databaseUtils.js';
import { Pack, PackLink, DialogMember } from '@chat3/models';

const TENANT_ID = process.env.SEED_PACKS_TENANT || 'tnt_default';
const USER_ID = process.env.SEED_PACKS_USER || 'alice_default';
const PACKS_COUNT = parseInt(process.env.SEED_PACKS_COUNT || '4', 10);
const DIALOGS_PER_PACK_MIN = 2;
const DIALOGS_PER_PACK_MAX = 5;

async function seedPacks() {
  try {
    await connectDB();
    console.log('📦 Seed packs: start\n');
    console.log(`   Tenant: ${TENANT_ID}, user: ${USER_ID}, packs to create: ${PACKS_COUNT}\n`);

    const dialogIds = await DialogMember.find({
      tenantId: TENANT_ID,
      userId: USER_ID
    })
      .distinct('dialogId')
      .exec();

    if (dialogIds.length === 0) {
      console.log(`❌ No dialogs found for user ${USER_ID} in tenant ${TENANT_ID}.`);
      console.log('   Run seed.js first (npm run seed or node scripts/seed.js) and ensure the user is a member of some dialogs.');
      process.exit(1);
    }

    console.log(`✅ Found ${dialogIds.length} dialogs where ${USER_ID} is a member.\n`);

    const packs = await Pack.create(
      Array.from({ length: PACKS_COUNT }, () => ({ tenantId: TENANT_ID }))
    );
    console.log(`✅ Created ${packs.length} packs: ${packs.map((p) => p.packId).join(', ')}\n`);

    const linksToCreate = [];
    for (let i = 0; i < packs.length; i++) {
      const pack = packs[i];
      const numDialogs = Math.min(
        dialogIds.length,
        DIALOGS_PER_PACK_MIN +
          Math.floor(
            Math.random() * (DIALOGS_PER_PACK_MAX - DIALOGS_PER_PACK_MIN + 1)
          )
      );
      const start = (i * 3) % dialogIds.length;
      const selected = new Set();
      for (let j = 0; j < numDialogs; j++) {
        selected.add(dialogIds[(start + j) % dialogIds.length]);
      }
      for (const dialogId of selected) {
        linksToCreate.push({ tenantId: TENANT_ID, packId: pack.packId, dialogId });
      }
      console.log(`   Pack ${pack.packId}: ${selected.size} dialogs`);
    }

    await PackLink.insertMany(linksToCreate);
    console.log(`\n✅ Created ${linksToCreate.length} pack–dialog links.`);

    console.log('\n🎉 Seed packs completed. You can open /user-dialogs, select ' + USER_ID + ', and switch to the "Паки пользователя" tab.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed packs error:', error);
    process.exit(1);
  }
}

seedPacks();
