import * as grpc from '@grpc/grpc-js';
import { User } from '@chat3/models';
import { AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import type { RabbitMQClient, Subscription } from '../services/rabbitmqClient.js';
import { toGrpcServiceError } from '../utils/errorMapper.js';
import { convertToGrpcUpdate } from './updateConverters.js';

export async function subscribeUpdatesHandler(
  call: grpc.ServerWritableStream<any, any>,
  auth: AuthenticatedContext,
  rabbitmqClient: RabbitMQClient
): Promise<void> {
  let subscription: Subscription | null = null;

  try {
    const userId = call.request.user_id;
    if (!userId) {
      throw new AppServiceError('VALIDATION', 'user_id is required');
    }
    if (!auth.tenantId) {
      throw new AppServiceError('VALIDATION', 'tenantId is required');
    }

    let userType = 'user';
    const user = await User.findOne({ userId, tenantId: auth.tenantId }).select('type').lean();
    if (user?.type) {
      userType = user.type;
    }

    const { connId, subscription: sub } = await rabbitmqClient.subscribeToUserUpdates(
      auth.tenantId,
      userId,
      userType,
      (update) => {
        try {
          call.write(convertToGrpcUpdate(update));
        } catch (error) {
          console.error('[SubscribeUpdates] write error:', error);
        }
      }
    );
    subscription = sub;

    call.write({
      update_id: '',
      tenant_id: auth.tenantId,
      user_id: userId,
      entity_id: '',
      event_id: '',
      source_event_type: 'connection.established',
      update_type: '',
      data: { conn_id: connId, scope: 'user' },
      created_at: Date.now()
    });

    const cleanup = () => {
      if (subscription) {
        subscription.cancel().catch(() => {});
        subscription = null;
      }
    };

    call.on('cancelled', cleanup);
    call.on('error', cleanup);
    call.on('close', cleanup);
  } catch (error) {
    if (subscription) {
      await subscription.cancel().catch(() => {});
    }
    call.destroy(toGrpcServiceError(error));
  }
}
