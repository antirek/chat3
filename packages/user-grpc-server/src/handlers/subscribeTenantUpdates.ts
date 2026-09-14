import * as grpc from '@grpc/grpc-js';
import {
  authenticateApiKey,
  assertPermission
} from '@chat3/app-services';
import type { RabbitMQClient, Subscription } from '../services/rabbitmqClient.js';
import { toGrpcServiceError } from '../utils/errorMapper.js';
import { convertToGrpcUpdate } from './updateConverters.js';

function metadataValue(metadata: grpc.Metadata, key: string): string | undefined {
  const values = metadata.get(key);
  if (!values || values.length === 0) return undefined;
  const value = values[0];
  return typeof value === 'string' ? value : value.toString();
}

/**
 * Firehose SubscribeTenantUpdates.
 * - tenant_ids non-empty → bind each tenant
 * - empty tenant_ids → wildcard (all tenants)
 * Auth: x-api-key only (tenant header optional / ignored for scope).
 */
export async function subscribeTenantUpdatesHandler(
  call: grpc.ServerWritableStream<any, any>,
  rabbitmqClient: RabbitMQClient
): Promise<void> {
  let subscription: Subscription | null = null;

  try {
    const ctx = await authenticateApiKey({
      apiKey: metadataValue(call.metadata, 'x-api-key'),
      skipTenant: true
    });
    assertPermission(ctx.apiKey, 'read');

    const tenantIds = Array.isArray(call.request.tenant_ids)
      ? call.request.tenant_ids.map((id: string) => String(id || '').trim()).filter(Boolean)
      : [];

    const { connId, subscription: sub } = await rabbitmqClient.subscribeToTenantUpdates(
      tenantIds,
      (update) => {
        try {
          call.write(convertToGrpcUpdate(update));
        } catch (error) {
          console.error('[SubscribeTenantUpdates] write error:', error);
        }
      }
    );
    subscription = sub;

    call.write({
      update_id: '',
      tenant_id: '',
      user_id: '',
      entity_id: '',
      event_id: '',
      source_event_type: 'connection.established',
      update_type: '',
      data: {
        conn_id: connId,
        scope: tenantIds.length === 0 ? 'all' : 'tenants',
        tenant_ids: tenantIds
      },
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
