/**
 * Тестовый сервер для интеграционных тестов Chat3Client
 * Использует mongodb-memory-server и @onify/fake-amqplib
 * 
 * Использует динамические импорты для работы с ES modules из основного проекта
 */

const express = require('express');
const cors = require('cors');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const fakeAmqp = require('@onify/fake-amqplib');
const amqp = require('amqplib');

let mongoServer;
let testServer;
let serverUrl;
let testApiKey;

/**
 * Запуск тестового сервера
 */
async function startTestServer() {
  // Динамически импортируем ES modules из основного проекта
  const { default: connectDB } = await import('@chat3/utils/databaseUtils.js');
  const rabbitmqUtils = await import('@chat3/utils/rabbitmqUtils.js');
  const tenantRoutes = (await import('@chat3/tenant-api/dist/routes/tenantRoutes.js')).default;
  const userRoutes = (await import('@chat3/tenant-api/dist/routes/userRoutes.js')).default;
  const dialogRoutes = (await import('@chat3/tenant-api/dist/routes/dialogRoutes.js')).default;
  const messageRoutes = (await import('@chat3/tenant-api/dist/routes/messageRoutes.js')).default;
  const messageInfoRoutes = (await import('@chat3/tenant-api/dist/routes/messageInfoRoutes.js')).default;
  const dialogMemberRoutes = (await import('@chat3/tenant-api/dist/routes/dialogMemberRoutes.js')).default;
  const userDialogRoutes = (await import('@chat3/tenant-api/dist/routes/userDialogRoutes.js')).default;
  const metaRoutes = (await import('@chat3/tenant-api/dist/routes/metaRoutes.js')).default;
  const idempotencyGuard = (await import('@chat3/tenant-api/dist/middleware/idempotencyGuard.js')).default;
  const { apiJournalMiddleware } = await import('@chat3/tenant-api/dist/middleware/apiJournal.js');
  const { ApiKey } = await import('@chat3/models');
  
  // 1. Настройка MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Переопределяем MONGODB_URI для connectDB
  process.env.MONGODB_URI = mongoUri;
  
  // Подключаемся к БД
  await connectDB();
  
  // 2. Настройка fake RabbitMQ
  amqp.connect = fakeAmqp.connect;
  await rabbitmqUtils.initRabbitMQ();
  
  // 3. Создание тестового tenant'а
  const { Tenant } = await import('@chat3/models');
  await Tenant.create({
    tenantId: 'tnt_default',
    name: 'Test Tenant',
    domain: 'test.chat3.com',
    type: 'client',
    isActive: true
  });
  
  // 4. Создание тестового API ключа
  testApiKey = ApiKey.generateKey();
  await ApiKey.create({
    key: testApiKey,
    name: 'Test API Key',
    description: 'API key for integration tests',
    permissions: ['read', 'write', 'delete'],
    isActive: true
  });
  
  // 5. Создание Express приложения
  const app = express();
  
  // Trust proxy
  app.set('trust proxy', true);
  
  // CORS
  app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Idempotency-Key', 'X-Tenant-Id', 'x-tenant-id']
  }));
  
  // Body parser
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Middleware
  app.use(apiJournalMiddleware);
  app.use(idempotencyGuard);
  
  // API Routes
  app.use('/api/tenants', tenantRoutes);
  app.use('/api/users', userDialogRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/dialogs', dialogRoutes);
  app.use('/api/dialogs', messageRoutes);
  app.use('/api/messages', messageInfoRoutes);
  app.use('/api/dialogs', dialogMemberRoutes);
  app.use('/api/meta', metaRoutes);
  
  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      message: 'Test server is running',
      timestamp: new Date().toISOString()
    });
  });
  
  // 6. Запуск сервера на случайном порту
  return new Promise((resolve, reject) => {
    testServer = app.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      serverUrl = `http://127.0.0.1:${port}`;
      console.log(`✅ Test server started on ${serverUrl}`);
      console.log(`🔑 Test API Key: ${testApiKey}`);
      resolve({
        url: serverUrl,
        apiKey: testApiKey
      });
    });
    
    testServer.on('error', reject);
  });
}

/**
 * Остановка тестового сервера
 */
async function stopTestServer() {
  const rabbitmqUtils = await import('@chat3/utils/rabbitmqUtils.js');
  
  return new Promise((resolve) => {
    if (testServer) {
      testServer.close(() => {
        console.log('🛑 Test server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  }).then(async () => {
    // Закрываем RabbitMQ
    await rabbitmqUtils.closeRabbitMQ();
    
    // Закрываем MongoDB
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
    
    // Останавливаем MongoDB Memory Server
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    // Сбрасываем fake RabbitMQ
    fakeAmqp.resetMock();
  });
}

/**
 * Получить URL тестового сервера
 */
function getServerUrl() {
  return serverUrl;
}

/**
 * Получить тестовый API ключ
 */
function getApiKey() {
  return testApiKey;
}

module.exports = {
  startTestServer,
  stopTestServer,
  getServerUrl,
  getApiKey
};

