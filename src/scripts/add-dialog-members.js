import mongoose from 'mongoose';
import connectDB from '../config/database.js';
import { DialogMember, Dialog, User } from '../models/index.js';
import { addDialogMember } from '../apps/tenant-api/utils/dialogMemberUtils.js';

const TENANT_ID = 'tnt_default';
const DIALOG_ID = 'dlg_rg5ywcijezquc8jibyqs';
const NUM_MEMBERS = 300;

async function addDialogMembers() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Проверяем существование диалога
    const dialog = await Dialog.findOne({ dialogId: DIALOG_ID, tenantId: TENANT_ID });
    if (!dialog) {
      console.error(`❌ Dialog ${DIALOG_ID} not found`);
      process.exit(1);
    }
    console.log(`✅ Dialog ${DIALOG_ID} found`);

    // Получаем список пользователей
    const users = await User.find({ tenantId: TENANT_ID }).select('userId').lean();
    if (users.length < NUM_MEMBERS) {
      console.error(`❌ Not enough users. Found ${users.length}, need ${NUM_MEMBERS}`);
      process.exit(1);
    }
    console.log(`✅ Found ${users.length} users`);

    // Получаем существующих участников
    const existingMembers = await DialogMember.find({
      tenantId: TENANT_ID,
      dialogId: DIALOG_ID
    }).select('userId').lean();
    const existingUserIds = new Set(existingMembers.map(m => m.userId));
    console.log(`📊 Existing members: ${existingUserIds.size}`);

    // Фильтруем пользователей, которых еще нет в диалоге
    const usersToAdd = users
      .filter(u => !existingUserIds.has(u.userId))
      .slice(0, NUM_MEMBERS - existingUserIds.size);

    if (usersToAdd.length === 0) {
      console.log('✅ All requested members already exist in dialog');
      const totalMembers = await DialogMember.countDocuments({
        tenantId: TENANT_ID,
        dialogId: DIALOG_ID
      });
      console.log(`📊 Total members in dialog: ${totalMembers}`);
      await mongoose.connection.close();
      return;
    }

    console.log(`🔄 Adding ${usersToAdd.length} new members...`);

    // Добавляем участников по одному
    let added = 0;
    let errors = 0;

    for (const user of usersToAdd) {
      try {
        await addDialogMember(TENANT_ID, user.userId, DIALOG_ID);
        added++;
        if (added % 50 === 0) {
          console.log(`  Progress: ${added}/${usersToAdd.length} members added`);
        }
      } catch (error) {
        if (error.code === 11000) {
          // Дубликат - игнорируем
          added++;
        } else {
          console.error(`  Error adding ${user.userId}:`, error.message);
          errors++;
        }
      }
    }

    console.log(`✅ Successfully added ${added} members`);
    if (errors > 0) {
      console.log(`⚠️  ${errors} errors occurred`);
    }

    const totalMembers = await DialogMember.countDocuments({
      tenantId: TENANT_ID,
      dialogId: DIALOG_ID
    });
    console.log(`📊 Total members in dialog: ${totalMembers}`);

  } catch (error) {
    console.error('❌ Error adding members:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

addDialogMembers().catch(console.error);

