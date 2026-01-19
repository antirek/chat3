/**
 * ConnectRPC сервер для пользователей
 */
import express from 'express';
import cors from 'cors';
import { expressConnectMiddleware } from '@connectrpc/connect-express';
import type { ConnectRouter } from '@connectrpc/connect';
import { Chat3UserService } from './generated/chat3_user_connect.js';
import { loadConfig } from './config/index.js';
import { RabbitMQClient } from './services/rabbitmqClient.js';
import { getUserDialogsHandler } from './handlers/getUserDialogs.js';
import { getDialogMessagesHandler } from './handlers/getDialogMessages.js';
import { sendMessageHandler } from './handlers/sendMessage.js';
import { subscribeUpdatesHandler } from './handlers/subscribeUpdates.js';
import { setupSwaggerUI } from './swagger.js';

// Загрузка конфигурации
const config = loadConfig();
console.log('[Config] Loaded configuration:', {
  http: `${config.http.host}:${config.http.port}`,
  tenantApi: config.tenantApi.url,
  rabbitmq: config.rabbitmq.url
});

// Инициализация RabbitMQ клиента
const rabbitmqClient = new RabbitMQClient({
  url: config.rabbitmq.url
});

// Временно передаем RabbitMQ клиент через global для использования в handlers
// TODO: Использовать interceptors для передачи через context
(global as any).rabbitmqClient = rabbitmqClient;

// Создание ConnectRPC роутера
// Функция регистрации routes для connectNodeAdapter
function registerRoutes(router: ConnectRouter) {
  console.log('[Router] registerRoutes called');
  
  // В Protobuf-ES v1 с protoc-gen-connect-es v1.7.0, используем router.rpc() для каждого метода
  // Это совместимо с @connectrpc/connect-node@1.7.0
  router.rpc(Chat3UserService, Chat3UserService.methods.getUserDialogs, async (request, context) => {
    console.log('[Handler] GetUserDialogs called');
    return await getUserDialogsHandler(request, context);
  });
  
  router.rpc(Chat3UserService, Chat3UserService.methods.getDialogMessages, async (request, context) => {
    console.log('[Handler] GetDialogMessages called');
    return await getDialogMessagesHandler(request, context);
  });
  
  router.rpc(Chat3UserService, Chat3UserService.methods.sendMessage, async (request, context) => {
    console.log('[Handler] SendMessage called');
    return await sendMessageHandler(request, context);
  });
  
  router.rpc(Chat3UserService, Chat3UserService.methods.subscribeUpdates, async function* (request: any, context: any) {
    console.log('[Handler] SubscribeUpdates called');
    yield* subscribeUpdatesHandler(request, context);
  });
  
  const handlers = (router as any).handlers as any[];
  console.log('[Router] Registered', handlers?.length || 0, 'handlers for service:', Chat3UserService.typeName);
  handlers?.forEach((h, i) => {
    console.log(`[Router] Handler ${i}: ${h.method?.service?.typeName}/${h.method?.name} (kind=${h.method?.kind})`);
  });
}

// Создание Express приложения
const app = express();

// CORS middleware для браузерных запросов
app.use(cors({
  origin: '*', // В продакшене указать конкретные origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Tenant-ID',
    'X-User-ID',
    'x-api-key',
    'x-tenant-id',
    'x-user-id',
    'Connect-Protocol-Version',
    'Connect-Timeout-Ms',
    'Connect-Content-Encoding'
  ],
  exposedHeaders: [
    'Content-Type',
    'Connect-Protocol-Version',
    'Connect-Timeout-Ms',
    'Connect-Content-Encoding'
  ]
}));

// Body parser для JSON (может понадобиться для других роутов)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (ПЕРЕД другими роутами)
app.use((req, res, next) => {
  console.log(`[Express] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint (ПЕРЕД ConnectRPC middleware)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'chat3-user-connectrpc-server' });
});

// Swagger UI для просмотра API (ПЕРЕД ConnectRPC middleware)
setupSwaggerUI(app);

// Подключение ConnectRPC middleware (В КОНЦЕ, чтобы не перехватывал другие роуты)
// ConnectRPC будет обрабатывать запросы по пути /chat3.user.Chat3UserService/*
// Используем expressConnectMiddleware для Express с ConnectRPC v1.7.0
app.use(expressConnectMiddleware({
  routes: registerRoutes
}));

// Запуск сервера
async function startServer() {
  try {
    // Подключаемся к RabbitMQ (попытка подключения, но не критично для запуска)
    try {
      await rabbitmqClient.connect();
      console.log('[RabbitMQ] Connected successfully');
    } catch (error: any) {
      console.warn('[RabbitMQ] Connection failed (server will start anyway):', error.message);
      console.warn('[RabbitMQ] SubscribeUpdates method may not work until RabbitMQ is available');
    }

    // Запускаем Express сервер
    const address = `${config.http.host}:${config.http.port}`;
    app.listen(config.http.port, config.http.host, () => {
      console.log(`[Server] ConnectRPC server started on http://${address}`);
      console.log(`[Server] Health check: http://${address}/health`);
      console.log(`[Server] ConnectRPC endpoint: http://${address}/chat3.user.Chat3UserService/`);
      console.log(`[Server] CORS enabled for browser requests`);
      console.log(`[Server] You can use the following tools to explore the API:`);
      console.log(`[Server]   - Browser: Direct calls from frontend via @connectrpc/connect-web`);
      console.log(`[Server]   - curl: POST http://${address}/chat3.user.Chat3UserService/GetUserDialogs`);
      console.log(`[Server]   - Postman: Import ConnectRPC server at http://${address}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[Server] Shutting down...');
  await rabbitmqClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Server] Shutting down...');
  await rabbitmqClient.disconnect();
  process.exit(0);
});

// Запуск
startServer();
