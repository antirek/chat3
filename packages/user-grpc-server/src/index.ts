/**
 * gRPC сервер для пользователей
 */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './config/index.js';
import { TenantApiClient } from './services/tenantApiClient.js';
import { RabbitMQClient } from './services/rabbitmqClient.js';
import { getUserDialogsHandler } from './handlers/getUserDialogs.js';
import { getDialogMessagesHandler } from './handlers/getDialogMessages.js';
import { sendMessageHandler } from './handlers/sendMessage.js';
import { subscribeUpdatesHandler } from './handlers/subscribeUpdates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загрузка конфигурации
const config = loadConfig();
console.log('[Config] Loaded configuration:', {
  grpc: `${config.grpc.host}:${config.grpc.port}`,
  tenantApi: config.tenantApi.url,
  rabbitmq: config.rabbitmq.url
});

// Загрузка proto файла
const PROTO_PATH = path.join(__dirname, '../proto/chat3_user.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, // Сохраняем имена полей как в proto (snake_case)
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const chat3Proto = grpc.loadPackageDefinition(packageDefinition) as any;
const chat3UserService = chat3Proto.chat3.user.Chat3UserService;

// Инициализация клиентов
const tenantApiClient = new TenantApiClient({
  baseURL: config.tenantApi.url,
  apiKey: '', // API ключ будет передаваться в метаданных каждого запроса
  tenantId: '' // Tenant ID будет передаваться в метаданных каждого запроса
});

const rabbitmqClient = new RabbitMQClient({
  url: config.rabbitmq.url
});

// Создание gRPC сервера
const server = new grpc.Server();

// Функция для создания обернутого handler с обновлением API ключа
function wrapHandler(
  handler: (call: any, callback: any, client: TenantApiClient) => Promise<void>
) {
  return (call: any, callback: any) => {
    const metadata = call.metadata;
    const apiKey = metadata.get('x-api-key')[0] as string;
    const tenantId = metadata.get('x-tenant-id')[0] as string;

    // Создаем новый клиент с правильными credentials для этого запроса
    const requestClient = new TenantApiClient({
      baseURL: config.tenantApi.url,
      apiKey: apiKey || '',
      tenantId: tenantId || ''
    });

    handler(call, callback, requestClient);
  };
}

// Функция для создания обернутого streaming handler
function wrapStreamingHandler(
  handler: (call: any, client: TenantApiClient, rabbitmqClient: RabbitMQClient) => Promise<void>
) {
  return (call: any) => {
    const metadata = call.metadata;
    const apiKey = metadata.get('x-api-key')[0] as string;
    const tenantId = metadata.get('x-tenant-id')[0] as string;

    // Создаем новый клиент с правильными credentials для этого запроса
    const requestClient = new TenantApiClient({
      baseURL: config.tenantApi.url,
      apiKey: apiKey || '',
      tenantId: tenantId || ''
    });

    handler(call, requestClient, rabbitmqClient);
  };
}

// Регистрация сервиса
server.addService(chat3UserService.service, {
  GetUserDialogs: wrapHandler(getUserDialogsHandler),
  GetDialogMessages: wrapHandler(getDialogMessagesHandler),
  SendMessage: wrapHandler(sendMessageHandler),
  SubscribeUpdates: wrapStreamingHandler(subscribeUpdatesHandler)
});

// Запуск сервера
async function startServer() {
  try {
    // Подключаемся к RabbitMQ
    await rabbitmqClient.connect();

    // Запускаем gRPC сервер
    const address = `${config.grpc.host}:${config.grpc.port}`;
    server.bindAsync(
      address,
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          console.error('[Server] Failed to start:', error);
          process.exit(1);
        }
        server.start();
        console.log(`[Server] gRPC server started on ${address}`);
      }
    );
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[Server] Shutting down...');
  server.forceShutdown();
  await rabbitmqClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Server] Shutting down...');
  server.forceShutdown();
  await rabbitmqClient.disconnect();
  process.exit(0);
});

// Запуск
startServer();
