import * as grpc from '@grpc/grpc-js';
import {
  authenticateApiKey,
  assertPermission
} from '@chat3/app-services';
import type { RabbitMQClient } from '../services/rabbitmqClient.js';
import type { MultiplexSubscription } from '../services/multiplexSubscription.js';
import { toGrpcServiceError } from '../utils/errorMapper.js';
import { convertToGrpcUpdate } from './updateConverters.js';
import { DEFAULT_MULTIPLEX_LIMITS } from '../multiplexActiveSet.js';

function metadataValue(metadata: grpc.Metadata, key: string): string | undefined {
  const values = metadata.get(key);
  if (!values || values.length === 0) return undefined;
  const value = values[0];
  return typeof value === 'string' ? value : value.toString();
}

function controlUpdate(
  sourceEventType: string,
  data: Record<string, unknown>
): any {
  return {
    update_id: '',
    tenant_id: typeof data.tenant_id === 'string' ? data.tenant_id : '',
    user_id: '',
    entity_id: '',
    event_id: '',
    source_event_type: sourceEventType,
    update_type: '',
    data,
    created_at: Date.now()
  };
}

/**
 * Bidi WatchUpdates: dynamic personal binds on one AMQP queue.
 * Auth: x-api-key only. Idle (empty active) keeps stream open.
 */
export async function watchUpdatesHandler(
  call: grpc.ServerDuplexStream<any, any>,
  rabbitmqClient: RabbitMQClient
): Promise<void> {
  let subscription: MultiplexSubscription | null = null;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (subscription) {
      subscription.cancel().catch(() => {});
      subscription = null;
    }
  };

  try {
    const ctx = await authenticateApiKey({
      apiKey: metadataValue(call.metadata, 'x-api-key'),
      skipTenant: true
    });
    assertPermission(ctx.apiKey, 'read');

    const maxKeys = parseInt(
      process.env.CHAT3_WATCH_MAX_KEYS || String(DEFAULT_MULTIPLEX_LIMITS.maxWatchedKeys),
      10
    );
    const maxPerMsg = parseInt(
      process.env.CHAT3_WATCH_MAX_USER_IDS_PER_MSG ||
        String(DEFAULT_MULTIPLEX_LIMITS.maxUserIdsPerMessage),
      10
    );

    subscription = await rabbitmqClient.createMultiplexWatch(
      (update) => {
        try {
          call.write(convertToGrpcUpdate(update));
        } catch (error) {
          console.error('[WatchUpdates] write error:', error);
        }
      },
      {
        maxWatchedKeys: Number.isFinite(maxKeys) ? maxKeys : DEFAULT_MULTIPLEX_LIMITS.maxWatchedKeys,
        maxUserIdsPerMessage: Number.isFinite(maxPerMsg)
          ? maxPerMsg
          : DEFAULT_MULTIPLEX_LIMITS.maxUserIdsPerMessage
      }
    );

    call.write(
      controlUpdate('connection.established', {
        conn_id: subscription.connId,
        scope: 'multiplex',
        watched_count: 0
      })
    );

    call.on('data', (msg: any) => {
      void (async () => {
        if (!subscription || closed) return;
        try {
          const op = msg?.op || (msg?.watch ? 'watch' : msg?.unwatch ? 'unwatch' : '');
          const payload = msg?.watch || msg?.unwatch;
          if (!payload || (op !== 'watch' && op !== 'unwatch')) {
            call.write(
              controlUpdate('watch.error', {
                error: 'expected watch or unwatch',
                watched_count: subscription.watchedCount()
              })
            );
            return;
          }

          const tenantId = payload.tenant_id || '';
          const userIds = payload.user_ids || [];
          const userType = payload.user_type || 'user';

          const result =
            op === 'watch'
              ? await subscription.watch(tenantId, userIds, userType)
              : await subscription.unwatch(tenantId, userIds, userType);

          if (result.ok === false) {
            call.write(
              controlUpdate('watch.error', {
                error: result.error,
                op,
                tenant_id: tenantId,
                watched_count: result.watchedCount
              })
            );
            return;
          }

          call.write(
            controlUpdate(op === 'watch' ? 'watch.ack' : 'unwatch.ack', {
              tenant_id: tenantId,
              user_ids: result.userIds,
              watched_count: result.watchedCount
            })
          );
        } catch (error: any) {
          console.error('[WatchUpdates] command error:', error);
          try {
            call.write(
              controlUpdate('watch.error', {
                error: error?.message || 'command failed',
                watched_count: subscription?.watchedCount() ?? 0
              })
            );
          } catch {
            /* ignore */
          }
        }
      })();
    });

    call.on('cancelled', cleanup);
    call.on('error', cleanup);
    call.on('end', cleanup);
    call.on('close', cleanup);
  } catch (error) {
    cleanup();
    call.destroy(toGrpcServiceError(error));
  }
}
