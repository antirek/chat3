/**
 * Handler для подписки на обновления (server streaming)
 */
import * as grpc from '@grpc/grpc-js';
import { Chat3Client } from '@chottodev/chat3-tenant-api-client';
import { RabbitMQClient, Subscription } from '../services/rabbitmqClient.js';
import { generateConnectionId } from '../utils/connectionId.js';
import { mapHttpStatusToGrpc, logError, createGrpcError } from '../utils/errorMapper.js';
import { convertToGrpcUpdate } from '../utils/converter.js';

export async function subscribeUpdatesHandler(
  call: grpc.ServerWritableStream<any, any>,
  tenantApiClient: Chat3Client,
  rabbitmqClient: RabbitMQClient
): Promise<void> {
  let subscription: Subscription | null = null;

  try {
    // Извлекаем метаданные
    const metadata = call.metadata;
    const userId = metadata.get('x-user-id')[0] as string;
    const tenantId = metadata.get('x-tenant-id')[0] as string;

    if (!userId) {
      const error = createGrpcError(
        grpc.status.INVALID_ARGUMENT,
        'x-user-id is required in metadata',
        null,
        { metadata: metadata.getMap() }
      );
      logError('subscribeUpdates: missing userId', error, { metadata: metadata.getMap() });
      call.destroy(error);
      return;
    }

    if (!tenantId) {
      const error = createGrpcError(
        grpc.status.INVALID_ARGUMENT,
        'x-tenant-id is required in metadata',
        null,
        { metadata: metadata.getMap() }
      );
      logError('subscribeUpdates: missing tenantId', error, { metadata: metadata.getMap() });
      call.destroy(error);
      return;
    }

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
    const connectionUpdate = {
      _id: '',
      tenantId: tenantId,
      userId: userId,
      entityId: '',
      eventType: 'connection.established',
      data: {
        conn_id: connId
      },
      createdAt: Date.now()
    };
    console.log(`[subscribeUpdates] Sending connection update:`, JSON.stringify(connectionUpdate, null, 2));
    
    // Отправляем update напрямую в формате, который ожидает proto-loader
    // С keepCase: true нужно использовать snake_case
    // proto-loader автоматически преобразует объект в Struct, но попробуем явный формат
    const updateMessage = {
      update_id: '',
      tenant_id: tenantId,
      user_id: userId,
      entity_id: '',
      event_type: 'connection.established',
      data: {
        fields: {
          conn_id: {
            stringValue: connId
          }
        }
      },
      created_at: Date.now()
    };
    console.log(`[subscribeUpdates] Sending update message:`, JSON.stringify(updateMessage, null, 2));
    
    try {
      call.write(updateMessage);
    } catch (error: any) {
      console.error(`[subscribeUpdates] Error writing update:`, error);
      throw error;
    }

    // Подписываемся на RabbitMQ очередь
    subscription = await rabbitmqClient.subscribeToUserUpdates(
      userId,
      userType,
      connId,
      (update: any) => {
        try {
          const grpcUpdate = convertToGrpcUpdate(update);
          call.write(grpcUpdate);
        } catch (error: any) {
          logError('subscribeUpdates: error converting update', error, { update });
        }
      }
    );

    console.log(`[subscribeUpdates] Subscribed to updates: userId=${userId}, userType=${userType}, connId=${connId}`);

    // Обработка закрытия соединения
    call.on('cancelled', () => {
      console.log(`[subscribeUpdates] Client cancelled: userId=${userId}, connId=${connId}`);
      if (subscription) {
        subscription.cancel().catch((error) => {
          logError('subscribeUpdates: error cancelling subscription', error, { connId });
        });
      }
    });

    call.on('error', (error) => {
      logError('subscribeUpdates: stream error', error, { userId, connId });
      if (subscription) {
        subscription.cancel().catch((err) => {
          logError('subscribeUpdates: error cancelling subscription on stream error', err, { connId });
        });
      }
    });

  } catch (error: any) {
    logError('subscribeUpdates: setup error', error);
    const grpcError = createGrpcError(
      grpc.status.INTERNAL,
      error.message || 'Failed to setup subscription',
      error
    );
    call.destroy(grpcError);
    if (subscription) {
      subscription.cancel().catch((err) => {
        logError('subscribeUpdates: error cancelling subscription on setup error', err);
      });
    }
  }
}
