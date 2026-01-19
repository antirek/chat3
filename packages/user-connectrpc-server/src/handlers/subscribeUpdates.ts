/**
 * Handler для подписки на обновления (ConnectRPC server streaming)
 */
import { Code, ConnectError } from '@connectrpc/connect';
import type { HandlerContext } from '@connectrpc/connect';
import { Chat3Client } from '@chottodev/chat3-tenant-api-client';
import { RabbitMQClient, Subscription } from '../services/rabbitmqClient.js';
import { generateConnectionId } from '../utils/connectionId.js';
import { SubscribeUpdatesRequest, Update } from '../generated/chat3_user_pb.js';
import { mapHttpStatusToConnect, logError } from '../utils/errorMapper.js';
import { convertToConnectUpdate } from '../utils/converter.js';
import { Struct } from '@bufbuild/protobuf';

export async function* subscribeUpdatesHandler(
  request: SubscribeUpdatesRequest,
  context: HandlerContext
): AsyncGenerator<Update, void, unknown> {
  let subscription: Subscription | null = null;
  // TODO: Передавать RabbitMQ клиент через interceptors/context values
  // Пока используем глобальный экземпляр (передается из index.ts)
  const rabbitmqClient = (global as any).rabbitmqClient as RabbitMQClient | undefined;

  if (!rabbitmqClient) {
    throw new ConnectError('RabbitMQ client not available', Code.Internal);
  }

  try {
    // Извлекаем headers из context
    const headers = context.requestHeader;
    const userId = headers.get('x-user-id') || '';
    const tenantId = headers.get('x-tenant-id') || '';
    const apiKey = headers.get('x-api-key') || '';

    if (!userId) {
      logError('subscribeUpdates: missing userId', null, { headers: Object.fromEntries(headers.entries()) });
      throw new ConnectError('x-user-id is required in headers', Code.InvalidArgument);
    }

    if (!tenantId) {
      logError('subscribeUpdates: missing tenantId', null, { headers: Object.fromEntries(headers.entries()) });
      throw new ConnectError('x-tenant-id is required in headers', Code.InvalidArgument);
    }

    // Создаем клиент для tenant-api
    const tenantApiClient = new Chat3Client({
      baseURL: process.env.TENANT_API_URL || 'http://localhost:3000',
      apiKey: apiKey,
      tenantId: tenantId
    });

    // Генерируем connection ID
    const connId = generateConnectionId();
    console.log(`[subscribeUpdates] Connection established: userId=${userId}, connId=${connId}`);

    // Получаем userType через tenant-api
    let userType = 'user'; // дефолтное значение
    try {
      const userResponse = await tenantApiClient.getUser(userId);
      if (userResponse.data && userResponse.data.type) {
        userType = userResponse.data.type;
      }
    } catch (error: any) {
      logError('subscribeUpdates: failed to get userType', error, { userId });
      // Продолжаем с дефолтным типом
    }

    // Отправляем первый Update с connId в data
    const connectionUpdate = new Update({
      updateId: '',
      tenantId: tenantId,
      userId: userId,
      entityId: '',
      eventType: 'connection.established',
      data: Struct.fromJson({
        connId: connId
      }),
      createdAt: Date.now()
    });
    console.log(`[subscribeUpdates] Sending connection update:`, JSON.stringify(connectionUpdate.toJson(), null, 2));
    yield connectionUpdate;

    // Создаем очередь обновлений для отправки через async generator
    const updateQueue: Update[] = [];
    let resolveQueue: ((value: void) => void) | null = null;
    let isClosed = false;

    // Подписываемся на RabbitMQ очередь
    subscription = await rabbitmqClient.subscribeToUserUpdates(
      userId,
      userType,
      connId,
      (update: any) => {
        try {
          console.log(`[subscribeUpdates] Received update from RabbitMQ:`, JSON.stringify(update, null, 2));
          
          // Преобразуем обновление из RabbitMQ в ConnectRPC Update
          const updateData = convertToConnectUpdate(update);
          
          // Создаем Update объект из protobuf
          // createdAt должен быть number (Protobuf-ES v1 генерирует int64/double как number)
          const createdAtValue = updateData.createdAt 
            ? (typeof updateData.createdAt === 'bigint' 
                ? Number(updateData.createdAt)
                : Math.floor(Number(updateData.createdAt)))
            : Date.now();
          
          const connectUpdate = new Update({
            updateId: updateData.updateId || '',
            tenantId: updateData.tenantId || '',
            userId: updateData.userId || '',
            entityId: updateData.entityId || '',
            eventType: updateData.eventType || '',
            data: updateData.data ? Struct.fromJson(updateData.data) : undefined,
            createdAt: createdAtValue
          });
          
          // Добавляем в очередь обновлений
          updateQueue.push(connectUpdate);
          
          // Если есть ожидающий промис, резолвим его
          if (resolveQueue) {
            resolveQueue();
            resolveQueue = null;
          }
        } catch (error: any) {
          logError('subscribeUpdates: error processing update', error, { update });
        }
      }
    );

    console.log(`[subscribeUpdates] Subscribed to updates: userId=${userId}, userType=${userType}, connId=${connId}`);

    // Обработка закрытия соединения
    if (context.signal) {
      context.signal.addEventListener('abort', () => {
        console.log(`[subscribeUpdates] Client cancelled: userId=${userId}, connId=${connId}`);
        isClosed = true;
        if (subscription) {
          subscription.cancel().catch((error) => {
            logError('subscribeUpdates: error cancelling subscription', error, { connId });
          });
        }
        // Резолвим ожидающий промис, чтобы завершить цикл
        if (resolveQueue) {
          resolveQueue();
          resolveQueue = null;
        }
      });
    }

    // Отправляем обновления из очереди через async generator
    while (!context.signal?.aborted && !isClosed) {
      // Если очередь пуста, ждем новые обновления
      if (updateQueue.length === 0) {
        await new Promise<void>((resolve) => {
          resolveQueue = resolve;
          // Таймаут на случай, если не будет обновлений
          setTimeout(() => {
            if (resolveQueue === resolve) {
              resolveQueue = null;
              resolve();
            }
          }, 1000);
        });
        continue;
      }

      // Отправляем все обновления из очереди
      while (updateQueue.length > 0 && !context.signal?.aborted && !isClosed) {
        const update = updateQueue.shift();
        if (update) {
          console.log(`[subscribeUpdates] Sending update to client:`, JSON.stringify(update.toJson(), null, 2));
          yield update;
        }
      }
    }

  } catch (err: any) {
    logError('subscribeUpdates: setup error', err);

    // Если это уже ConnectError, пробрасываем дальше
    if (err instanceof ConnectError) {
      throw err;
    }

    const httpStatus = err.response?.status || 500;
    const connectStatus = mapHttpStatusToConnect(httpStatus);
    const message = err.response?.data?.message || err.message || 'Failed to setup subscription';

    const connectErr = new ConnectError(message, connectStatus);
    connectErr.metadata.set('http-status', httpStatus.toString());
    throw connectErr;
  } finally {
    // Cleanup
    if (subscription) {
      subscription.cancel().catch((err) => {
        logError('subscribeUpdates: error cancelling subscription in finally', err);
      });
    }
  }
}
