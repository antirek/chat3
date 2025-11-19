import connectDB from '../config/database.js';
import { User } from '../models/index.js';

async function checkUser() {
  try {
    await connectDB();
    console.log('🔍 Checking for user...\n');

    const userName = 'Тестов210084 Пользователь210084';
    const userType = 'bot';

    // Ищем пользователя по имени
    const userByName = await User.findOne({
      name: userName
    }).lean();

    if (userByName) {
      console.log('✅ User found by name:');
      console.log(JSON.stringify(userByName, null, 2));
      console.log(`\nType in DB: "${userByName.type}"`);
      console.log(`Expected type: "${userType}"`);
      console.log(`Match: ${userByName.type === userType ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log('❌ User not found by name');
    }

    // Ищем всех пользователей с типом bot
    const botUsers = await User.find({
      type: 'bot'
    }).lean();

    console.log(`\n📊 Total users with type='bot': ${botUsers.length}`);
    if (botUsers.length > 0) {
      console.log('\nFirst 5 bot users:');
      botUsers.slice(0, 5).forEach((u, i) => {
        console.log(`${i + 1}. ${u.name} (${u.userId}) - type: ${u.type}`);
      });
    }

    // Ищем пользователей с похожим именем
    const similarUsers = await User.find({
      name: { $regex: 'Тестов210084', $options: 'i' }
    }).lean();

    console.log(`\n📊 Users with name containing "Тестов210084": ${similarUsers.length}`);
    if (similarUsers.length > 0) {
      similarUsers.forEach((u, i) => {
        console.log(`${i + 1}. ${u.name} (${u.userId}) - type: ${u.type || 'undefined'}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUser();

