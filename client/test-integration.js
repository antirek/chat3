/**
 * Простой скрипт для проверки работы клиента с реальным tenant-api
 * 
 * Использование:
 * 1. Запустите tenant-api: npm run start:tenant-api (в корне проекта)
 * 2. Сгенерируйте API ключ: npm run generate-key (в корне проекта)
 * 3. Запустите скрипт: node test-integration.js
 * 
 * Или с переменными окружения:
 * CHAT3_API_KEY=your-key CHAT3_BASE_URL=http://localhost:3000/api node test-integration.js
 */

const { Chat3Client } = require('./src/Chat3Client.js');

const API_KEY = process.env.CHAT3_API_KEY || 'chat3_91b81eff6a450427e9e8f7e9bcd8431e02982871623301321890736ab97d55d7';
const BASE_URL = process.env.CHAT3_BASE_URL || 'http://localhost:3000/api';
const TENANT_ID = process.env.CHAT3_TENANT_ID || 'tnt_default';

const client = new Chat3Client({
  baseURL: BASE_URL,
  apiKey: API_KEY,
  tenantId: TENANT_ID,
  debug: false
});

async function testClient() {
  console.log('🧪 Тестирование Chat3Client с реальным API...\n');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 20)}...`);
  console.log(`🏢 Tenant ID: ${TENANT_ID}\n`);

  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };

  // Тест 1: Получение пользователей
  try {
    console.log('1️⃣  Тест: getUsers()');
    const users = await client.getUsers({ limit: 5 });
    console.log(`   ✅ Успешно. Получено пользователей: ${users.data?.length || 0}`);
    results.passed++;
  } catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`);
    if (error.response) {
      console.log(`      Status: ${error.response.status}`);
      console.log(`      Data: ${JSON.stringify(error.response.data)}`);
    }
    results.failed++;
    results.errors.push({ test: 'getUsers', error: error.message });
  }

  // Тест 2: Получение диалогов
  try {
    console.log('\n2️⃣  Тест: getDialogs()');
    const dialogs = await client.getDialogs({ limit: 5 });
    console.log(`   ✅ Успешно. Получено диалогов: ${dialogs.data?.length || 0}`);
    results.passed++;
  } catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`);
    if (error.response) {
      console.log(`      Status: ${error.response.status}`);
      console.log(`      Data: ${JSON.stringify(error.response.data)}`);
    }
    results.failed++;
    results.errors.push({ test: 'getDialogs', error: error.message });
  }

  // Тест 3: Создание пользователя и установка мета-тега
  try {
    console.log('\n3️⃣  Тест: createUser() + setMeta()');
    const testUserId = `test_user_${Date.now()}`;
    
    // Создаем пользователя
    await client.createUser(testUserId, { name: 'Test User' });
    console.log(`   ✅ Пользователь создан: ${testUserId}`);
    
    // Устанавливаем мета-тег
    const metaResult = await client.setMeta('user', testUserId, 'testTheme', 'dark');
    console.log(`   ✅ Мета-тег установлен: testTheme = dark`);
    console.log(`   ⚠️  Ответ setMeta: ${JSON.stringify(metaResult)}`);
    
    // Небольшая задержка для гарантии сохранения в БД
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Получаем мета-тег
    const meta = await client.getMeta('user', testUserId);
    console.log(`   ✅ Мета-тег получен: ${JSON.stringify(meta.data?.testTheme || 'не найден')}`);
    console.log(`   ⚠️  Все мета-теги: ${JSON.stringify(meta.data)}`);
    console.log(`   ⚠️  Полная структура getMeta: ${JSON.stringify(meta)}`);
    
    // Проверяем структуру ответа
    // getMeta возвращает { data: { key1: value1, key2: value2, ... } }
    if (meta && meta.data && typeof meta.data === 'object') {
      if (meta.data.testTheme === 'dark') {
        console.log(`   ✅ Значение корректно!`);
        results.passed++;
      } else {
        const availableKeys = Object.keys(meta.data).length > 0 ? Object.keys(meta.data).join(', ') : 'нет ключей';
        throw new Error(`Мета-тег testTheme не найден. Доступные ключи: ${availableKeys}. Полный ответ: ${JSON.stringify(meta)}`);
      }
    } else {
      throw new Error(`Неверная структура ответа getMeta: ${JSON.stringify(meta)}`);
    }
  } catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`);
    if (error.response) {
      console.log(`      Status: ${error.response.status}`);
      console.log(`      Data: ${JSON.stringify(error.response.data)}`);
    }
    results.failed++;
    results.errors.push({ test: 'createUser + setMeta', error: error.message });
  }

  // Тест 4: setMeta с dataType
  try {
    console.log('\n4️⃣  Тест: setMeta() с dataType');
    const testUserId = `test_user_${Date.now()}`;
    
    await client.createUser(testUserId, { name: 'Test User' });
    const metaResult = await client.setMeta('user', testUserId, 'testScore', 100, { dataType: 'number' });
    
    console.log(`   ✅ Мета-тег установлен с dataType=number`);
    console.log(`   ⚠️  Полная структура ответа setMeta: ${JSON.stringify(metaResult, null, 2)}`);
    
    // Проверяем структуру ответа от API
    // API возвращает { data: { entityId, entityType, key, value, dataType, ... }, message: '...' }
    // sanitizeResponse удаляет _id, но оставляет остальные поля
    if (metaResult) {
      // Проверяем что есть data в ответе
      if (metaResult.data) {
        const metaData = metaResult.data;
        // Проверяем что dataType и value установлены правильно
        if (metaData.dataType === 'number' && metaData.value === 100) {
          console.log(`   ✅ Значение и тип корректны!`);
          results.passed++;
        } else {
          throw new Error(`dataType или value неверны. Получено: dataType=${metaData.dataType}, value=${metaData.value}. Полный ответ: ${JSON.stringify(metaResult)}`);
        }
      } else {
        throw new Error(`Ответ setMeta не содержит data. Полный ответ: ${JSON.stringify(metaResult)}`);
      }
    } else {
      throw new Error(`setMeta вернул undefined или null`);
    }
  } catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`);
    if (error.response) {
      console.log(`      Status: ${error.response.status}`);
      console.log(`      Data: ${JSON.stringify(error.response.data)}`);
    }
    results.failed++;
    results.errors.push({ test: 'setMeta with dataType', error: error.message });
  }

  // Тест 5: setMeta для сообщения (ожидаем 404 если сообщение не существует)
  try {
    console.log('\n5️⃣  Тест: setMeta() для несуществующего сообщения');
    const testMessageId = `msg_test_${Date.now()}`;
    
    try {
      await client.setMeta('message', testMessageId, 'state', 'verified');
      console.log(`   ⚠️  Мета-тег установлен (сообщение существует)`);
      results.passed++;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`   ✅ Ожидаемая ошибка 404 (сообщение не найдено)`);
        results.passed++;
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.log(`   ❌ Неожиданная ошибка: ${error.message}`);
    results.failed++;
    results.errors.push({ test: 'setMeta for message', error: error.message });
  }

  // Итоги
  console.log('\n' + '='.repeat(50));
  console.log('📊 Итоги тестирования:');
  console.log(`   ✅ Успешно: ${results.passed}`);
  console.log(`   ❌ Ошибок: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Ошибки:');
    results.errors.forEach((err, i) => {
      console.log(`   ${i + 1}. ${err.test}: ${err.error}`);
    });
  }
  
  console.log('='.repeat(50));
  
  if (results.failed === 0) {
    console.log('🎉 Все тесты прошли успешно!');
    process.exit(0);
  } else {
    console.log('⚠️  Некоторые тесты не прошли. Проверьте настройки API.');
    process.exit(1);
  }
}

// Запуск тестов
testClient().catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});

