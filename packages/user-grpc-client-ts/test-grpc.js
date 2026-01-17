/**
 * Тестовый скрипт для проверки gRPC клиента
 * 
 * Тестирует:
 * 1. Подключение двух пользователей
 * 2. Подписка обоих на updates
 * 3. Отправка сообщений одним пользователем
 * 4. Получение updates обоими пользователями
 */

import { Chat3GrpcClient } from './dist/index.js';

// Конфигурация
const GRPC_SERVER_URL = process.env.GRPC_SERVER_URL || 'localhost:50051';
const API_KEY = process.env.API_KEY || '';
const TENANT_ID = process.env.TENANT_ID || 'tnt_default';
const USER_1_ID = process.env.USER_1_ID || 'user_1';
const USER_2_ID = process.env.USER_2_ID || 'user_2';
const DIALOG_ID = process.env.DIALOG_ID || '';

if (!API_KEY) {
  console.error('❌ API_KEY is required. Set it via environment variable or .env file');
  process.exit(1);
}

if (!DIALOG_ID) {
  console.error('❌ DIALOG_ID is required. Set it via environment variable or .env file');
  console.error('💡 Create a dialog first and set DIALOG_ID to its ID');
  process.exit(1);
}

console.log('🚀 Starting gRPC test...');
console.log(`📡 gRPC Server: ${GRPC_SERVER_URL}`);
console.log(`👤 User 1: ${USER_1_ID}`);
console.log(`👤 User 2: ${USER_2_ID}`);
console.log(`💬 Dialog ID: ${DIALOG_ID}`);
console.log('');

// Создаем клиенты для двух пользователей
const client1 = new Chat3GrpcClient({
  url: GRPC_SERVER_URL,
  apiKey: API_KEY,
  tenantId: TENANT_ID,
  userId: USER_1_ID
});

const client2 = new Chat3GrpcClient({
  url: GRPC_SERVER_URL,
  apiKey: API_KEY,
  tenantId: TENANT_ID,
  userId: USER_2_ID
});

// Переменные для отслеживания состояния
let client1ConnId = null;
let client2ConnId = null;
let messagesSent = 0;
let client1UpdatesReceived = 0;
let client2UpdatesReceived = 0;

// Подписка User 1 на updates
console.log(`📡 [${USER_1_ID}] Subscribing to updates...`);
const unsubscribe1 = client1.subscribeUpdates((update) => {
  client1UpdatesReceived++;
  
  // Логируем весь update для отладки
  if (client1UpdatesReceived === 1) {
    console.log(`📩 [${USER_1_ID}] First update received:`, JSON.stringify(update, null, 2));
  }
  
  const eventType = update.event_type || update.eventType || '';
  if (eventType === 'connection.established') {
    // Получаем connId из data (Struct формат в gRPC)
    let data = {};
    if (update.data && update.data.fields) {
      // Struct формат - поля имеют структуру { stringValue, numberValue, boolValue, listValue, structValue }
      data = Object.fromEntries(
        Object.entries(update.data.fields).map(([key, value]) => [
          key,
          value.stringValue !== undefined ? value.stringValue :
          value.numberValue !== undefined ? value.numberValue :
          value.boolValue !== undefined ? value.boolValue :
          value.listValue !== undefined ? value.listValue :
          value.structValue !== undefined ? value.structValue :
          value
        ])
      );
    } else if (update.data) {
      // Простой объект
      data = update.data;
    }
    client1ConnId = data.conn_id || null;
    console.log(`✅ [${USER_1_ID}] Connected! connId: ${client1ConnId}, data:`, JSON.stringify(data, null, 2));
  } else if (eventType) {
    console.log(`📩 [${USER_1_ID}] Update #${client1UpdatesReceived}: ${eventType}`);
    let data = {};
    if (update.data && update.data.fields) {
      data = Object.fromEntries(
        Object.entries(update.data.fields).map(([key, value]) => [
          key,
          value.stringValue || value.numberValue || value.boolValue || value.listValue || value.structValue || value
        ])
      );
    } else {
      data = update.data || {};
    }
    if (data.message) {
        const msg = data.message.fields ? Object.fromEntries(
          Object.entries(data.message.fields).map(([key, value]) => [
            key,
            value.stringValue || value.numberValue || value.boolValue || value.listValue || value.structValue || value
          ])
        ) : data.message;
      console.log(`   💬 Message: ${(msg.content || '').substring(0, 50)}...`);
      console.log(`   👤 From: ${msg.sender_id || ''}`);
    }
  } else {
    console.log(`📩 [${USER_1_ID}] Update #${client1UpdatesReceived}: (no event_type), update keys:`, Object.keys(update || {}));
  }
});

// Подписка User 2 на updates
console.log(`📡 [${USER_2_ID}] Subscribing to updates...`);
const unsubscribe2 = client2.subscribeUpdates((update) => {
  client2UpdatesReceived++;
  
  const eventType = update.event_type || update.eventType || '';
  if (eventType === 'connection.established') {
    // Получаем connId из data (Struct формат в gRPC)
    let data = {};
    if (update.data && update.data.fields) {
      // Struct формат - поля имеют структуру { stringValue, numberValue, boolValue, listValue, structValue }
      data = Object.fromEntries(
        Object.entries(update.data.fields).map(([key, value]) => [
          key,
          value.stringValue !== undefined ? value.stringValue :
          value.numberValue !== undefined ? value.numberValue :
          value.boolValue !== undefined ? value.boolValue :
          value.listValue !== undefined ? value.listValue :
          value.structValue !== undefined ? value.structValue :
          value
        ])
      );
    } else if (update.data) {
      // Простой объект
      data = update.data;
    }
    client2ConnId = data.conn_id || null;
    console.log(`✅ [${USER_2_ID}] Connected! connId: ${client2ConnId}, data:`, JSON.stringify(data, null, 2));
  } else if (eventType) {
    console.log(`📩 [${USER_2_ID}] Update #${client2UpdatesReceived}: ${eventType}`);
    let data = {};
    if (update.data && update.data.fields) {
      data = Object.fromEntries(
        Object.entries(update.data.fields).map(([key, value]) => [
          key,
          value.stringValue || value.numberValue || value.boolValue || value.listValue || value.structValue || value
        ])
      );
    } else {
      data = update.data || {};
    }
    if (data.message) {
        const msg = data.message.fields ? Object.fromEntries(
          Object.entries(data.message.fields).map(([key, value]) => [
            key,
            value.stringValue || value.numberValue || value.boolValue || value.listValue || value.structValue || value
          ])
        ) : data.message;
      console.log(`   💬 Message: ${(msg.content || '').substring(0, 50)}...`);
      console.log(`   👤 From: ${msg.sender_id || ''}`);
    }
  } else {
    console.log(`📩 [${USER_2_ID}] Update #${client2UpdatesReceived}: (no event_type), update keys:`, Object.keys(update || {}));
  }
});

// Ждем подключения обоих пользователей
await new Promise(resolve => setTimeout(resolve, 1000));

if (!client1ConnId || !client2ConnId) {
  console.error('❌ Failed to establish connections');
  process.exit(1);
}

console.log('');
console.log('✅ Both users connected!');
console.log('');

// Функция для отправки сообщений
async function sendMessages() {
  const messages = [
    'Привет! Это тестовое сообщение #1',
    'Тестовое сообщение #2',
    'Тестовое сообщение #3'
  ];

  for (let i = 0; i < messages.length; i++) {
    try {
      console.log(`📤 [${USER_1_ID}] Sending message #${i + 1}...`);
      const response = await client1.sendMessage(DIALOG_ID, USER_1_ID, {
        content: messages[i],
        type: 'internal.text',
        meta: { test: true, messageNumber: i + 1 }
      });
      
      messagesSent++;
      console.log(`✅ [${USER_1_ID}] Message sent! messageId: ${response.message?.message_id}`);
      
      // Ждем немного между сообщениями
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ [${USER_1_ID}] Error sending message:`, error.message);
    }
  }
}

// Функция для получения диалогов (для проверки)
async function testGetDialogs() {
  try {
    console.log('');
    console.log(`📋 [${USER_1_ID}] Getting dialogs...`);
    const response = await client1.getUserDialogs({
      page: 1,
      limit: 10,
      includeLastMessage: true
    });
    
    console.log(`✅ [${USER_1_ID}] Found ${response.dialogs?.length || 0} dialogs`);
    if (response.dialogs && response.dialogs.length > 0) {
      const dialog = response.dialogs[0];
      console.log(`   💬 First dialog: ${dialog.name || dialog.dialog_id}`);
    }
  } catch (error) {
    console.error(`❌ [${USER_1_ID}] Error getting dialogs:`, error.message);
  }
}

// Функция для получения сообщений (для проверки)
async function testGetMessages() {
  try {
    console.log('');
    console.log(`📋 [${USER_1_ID}] Getting messages from dialog ${DIALOG_ID}...`);
    const response = await client1.getDialogMessages(DIALOG_ID, {
      page: 1,
      limit: 10
    });
    
    console.log(`✅ [${USER_1_ID}] Found ${response.messages?.length || 0} messages`);
    if (response.messages && response.messages.length > 0) {
      const msg = response.messages[0];
      console.log(`   💬 Last message: ${msg.content?.substring(0, 50)}...`);
    }
  } catch (error) {
    console.error(`❌ [${USER_1_ID}] Error getting messages:`, error.message);
  }
}

// Запускаем тесты
async function runTests() {
  try {
    // Тест 1: Получение диалогов
    await testGetDialogs();
    
    // Тест 2: Получение сообщений
    await testGetMessages();
    
    // Ждем немного
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Тест 3: Отправка сообщений
    console.log('');
    console.log('📨 Starting message sending test...');
    console.log('');
    await sendMessages();
    
    // Ждем получения всех updates
    console.log('');
    console.log('⏳ Waiting for updates to be received...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Результаты
    console.log('');
    console.log('📊 Test Results:');
    console.log(`   📤 Messages sent: ${messagesSent}`);
    console.log(`   📩 [${USER_1_ID}] Updates received: ${client1UpdatesReceived}`);
    console.log(`   📩 [${USER_2_ID}] Updates received: ${client2UpdatesReceived}`);
    console.log('');
    
    if (messagesSent > 0 && client1UpdatesReceived > 1 && client2UpdatesReceived > 1) {
      console.log('✅ Test PASSED! Both users received updates.');
    } else {
      console.log('⚠️  Test completed, but some updates may have been missed.');
      console.log('   Check if update-worker is running and processing events.');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    // Отменяем подписки
    console.log('');
    console.log('🛑 Unsubscribing...');
    unsubscribe1();
    unsubscribe2();
    
    // Ждем немного перед завершением
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Done!');
    process.exit(0);
  }
}

// Обработка завершения
process.on('SIGINT', async () => {
  console.log('');
  console.log('🛑 Shutting down...');
  unsubscribe1();
  unsubscribe2();
  await new Promise(resolve => setTimeout(resolve, 500));
  process.exit(0);
});

// Запуск тестов
runTests().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
