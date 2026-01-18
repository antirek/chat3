/**
 * gRPC сервер для пользователей
 */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as reflection from '@grpc/reflection';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './config/index.js';
import { Chat3Client } from '@chottodev/chat3-tenant-api-client';
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

// Загрузка proto файла (используем общий proto пакет)
// __dirname указывает на dist/, поэтому используем ../../../packages-shared
const PROTO_PATH = path.join(__dirname, '../../../packages-shared/proto/src/chat3_user.proto');
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
// Chat3Client будет создаваться для каждого запроса с правильными credentials

const rabbitmqClient = new RabbitMQClient({
  url: config.rabbitmq.url
});

// Создание gRPC сервера
const server = new grpc.Server();

// Функция для создания обернутого handler с обновлением API ключа
function wrapHandler(
  handler: (call: any, callback: any, client: Chat3Client) => Promise<void>
) {
  return (call: any, callback: any) => {
    const metadata = call.metadata;
    const apiKey = metadata.get('x-api-key')[0] as string;
    const tenantId = metadata.get('x-tenant-id')[0] as string;

    // Создаем новый клиент с правильными credentials для этого запроса
    const requestClient = new Chat3Client({
      baseURL: config.tenantApi.url,
      apiKey: apiKey || '',
      tenantId: tenantId || ''
    });

    handler(call, callback, requestClient);
  };
}

// Функция для создания обернутого streaming handler
function wrapStreamingHandler(
  handler: (call: any, client: Chat3Client, rabbitmqClient: RabbitMQClient) => Promise<void>
) {
  return (call: any) => {
    const metadata = call.metadata;
    const apiKey = metadata.get('x-api-key')[0] as string;
    const tenantId = metadata.get('x-tenant-id')[0] as string;

    // Создаем новый клиент с правильными credentials для этого запроса
    const requestClient = new Chat3Client({
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

// Включение gRPC Server Reflection для поддержки инструментов (Kreya, Postman, grpcurl, grpcui)
// Reflection позволяет клиентам динамически получать информацию о доступных сервисах и методах
try {
  const reflectionService = new reflection.ReflectionService(packageDefinition);
  reflectionService.addToServer(server);
} catch (error) {
  console.warn('[Server] Failed to enable gRPC Server Reflection:', error);
  console.warn('[Server] Some tools (Kreya, grpcurl, grpcui) may not work without reflection');
}

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
        console.log(`[Server] gRPC Server Reflection enabled - clients can discover services dynamically`);
        console.log(`[Server] You can use the following tools to explore the API:`);
        console.log(`[Server]   - Kreya: Connect to ${address} with reflection enabled`);
        console.log(`[Server]   - grpcurl: grpcurl -plaintext ${address} list`);
        console.log(`[Server]   - Postman: Import gRPC server at ${address}`);
        console.log(`[Server]   - grpcui: grpcui -plaintext ${address}`);
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
