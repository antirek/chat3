/**
 * RabbitMQ multiplex session: one queue, dynamic bind/unbind.
 */
import * as amqp from 'amqplib';
import {
  DEFAULT_MULTIPLEX_LIMITS,
  MultiplexActiveSet,
  type MultiplexLimits,
  type WatchBatchResult
} from '../multiplexActiveSet.js';

export type MultiplexSubscription = {
  connId: string;
  queueName: string;
  watch: (
    tenantId: string,
    userIds: string[],
    userType?: string
  ) => Promise<WatchBatchResult>;
  unwatch: (
    tenantId: string,
    userIds: string[],
    userType?: string
  ) => Promise<WatchBatchResult>;
  watchedCount: () => number;
  cancel: () => Promise<void>;
};

function generateConnectionId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'conn_';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create exclusive queue + consumer; binds applied via watch/unwatch.
 */
export async function createMultiplexSubscription(
  channel: amqp.Channel,
  exchange: string,
  onMessage: (update: any) => void,
  limits: MultiplexLimits = DEFAULT_MULTIPLEX_LIMITS
): Promise<MultiplexSubscription> {
  const active = new MultiplexActiveSet(limits);
  const connId = generateConnectionId();
  const queueName = `mux_conn_${connId}_updates`;

  // Serialize bind/unbind ops on this session
  let chain: Promise<void> = Promise.resolve();
  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };

  await channel.assertQueue(queueName, {
    exclusive: true,
    autoDelete: true,
    arguments: {
      'x-message-ttl': 3600000
    }
  });

  const consumeResult = await channel.consume(queueName, (msg: amqp.ConsumeMessage | null) => {
    if (!msg) return;
    try {
      const update = JSON.parse(msg.content.toString());
      const tenantId = update?.tenantId || update?.tenant_id || '';
      const userId = update?.userId || update?.user_id || '';
      const userType = update?.userType || update?.user_type;
      if (!active.acceptsUpdate(tenantId, userId, userType)) {
        channel.ack(msg);
        return;
      }
      onMessage(update);
      channel.ack(msg);
    } catch (error) {
      console.error('[user-grpc-server][RabbitMQ] multiplex process error:', error);
      channel.nack(msg, false, false);
    }
  });

  console.log(`[user-grpc-server][RabbitMQ] Multiplex queue ${queueName}`);

  return {
    connId,
    queueName,
    watchedCount: () => active.size,
    watch: (tenantId, userIds, userType) =>
      enqueue(async () => {
        const result = active.watch(tenantId, userIds, userType);
        if (!result.ok) return result;
        for (const bindKey of result.bindKeys) {
          await channel.bindQueue(queueName, exchange, bindKey);
        }
        return result;
      }),
    unwatch: (tenantId, userIds, userType) =>
      enqueue(async () => {
        const result = active.unwatch(tenantId, userIds, userType);
        if (!result.ok) return result;
        for (const bindKey of result.bindKeys) {
          await channel.unbindQueue(queueName, exchange, bindKey);
        }
        return result;
      }),
    cancel: async () => {
      try {
        await channel.cancel(consumeResult.consumerTag);
        await channel.deleteQueue(queueName);
      } catch (error) {
        console.error('[user-grpc-server][RabbitMQ] multiplex cancel error:', error);
      }
    }
  };
}
