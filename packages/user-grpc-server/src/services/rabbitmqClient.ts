/**
 * RabbitMQ client for SubscribeUpdates / SubscribeTenantUpdates / WatchUpdates.
 */
import * as amqp from 'amqplib';
import {
  allUpdatesBindKey,
  tenantUpdatesBindKey,
  userUpdatesBindKey
} from '../updateRoutingKeys.js';
import {
  createMultiplexSubscription,
  type MultiplexSubscription
} from './multiplexSubscription.js';
import type { MultiplexLimits } from '../multiplexActiveSet.js';
import { DEFAULT_MULTIPLEX_LIMITS } from '../multiplexActiveSet.js';

export interface RabbitMQClientOptions {
  url: string;
  exchange?: string;
}

export interface Subscription {
  queueName: string;
  cancel: () => Promise<void>;
}

function generateConnectionId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'conn_';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export class RabbitMQClient {
  private connection: any = null;
  private channel: any = null;
  private options: RabbitMQClientOptions;
  private exchange: string;

  constructor(options: RabbitMQClientOptions) {
    this.options = options;
    this.exchange = options.exchange || process.env.RABBITMQ_UPDATES_EXCHANGE || 'chat3_updates';
  }

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.options.url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
    console.log('[user-grpc-server][RabbitMQ] Connected');
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async subscribeToUserUpdates(
    tenantId: string,
    userId: string,
    userType: string,
    onMessage: (update: any) => void
  ): Promise<{ subscription: Subscription; connId: string }> {
    return this.subscribeWithBinds(
      `user_${tenantId}_${userId}`,
      [userUpdatesBindKey(tenantId, userType, userId)],
      onMessage,
      (update) => !update?.tenantId || update.tenantId === tenantId
    );
  }

  /**
   * Firehose: one or more tenants, or all (wildcard).
   * Empty tenantIds → wildcard bind (all tenants).
   */
  async subscribeToTenantUpdates(
    tenantIds: string[],
    onMessage: (update: any) => void
  ): Promise<{ subscription: Subscription; connId: string }> {
    const ids = Array.from(
      new Set(tenantIds.map((id) => String(id || '').trim()).filter(Boolean))
    );
    const binds =
      ids.length === 0
        ? [allUpdatesBindKey()]
        : ids.map(tenantUpdatesBindKey);
    const allow = ids.length === 0 ? null : new Set(ids);

    return this.subscribeWithBinds(
      ids.length === 0 ? 'all' : `tenants_${ids.sort().join('_')}`,
      binds,
      onMessage,
      (update) => {
        if (!allow) return true;
        if (!update?.tenantId) return true;
        return allow.has(update.tenantId);
      }
    );
  }

  /**
   * Multiplexed personal watches: one queue, dynamic bind/unbind.
   */
  async createMultiplexWatch(
    onMessage: (update: any) => void,
    limits: MultiplexLimits = DEFAULT_MULTIPLEX_LIMITS
  ): Promise<MultiplexSubscription> {
    if (!this.channel) {
      throw new Error('RabbitMQ not connected');
    }
    return createMultiplexSubscription(this.channel, this.exchange, onMessage, limits);
  }

  private async subscribeWithBinds(
    queuePrefix: string,
    routingKeys: string[],
    onMessage: (update: any) => void,
    accept: (update: any) => boolean
  ): Promise<{ subscription: Subscription; connId: string }> {
    if (!this.channel) {
      throw new Error('RabbitMQ not connected');
    }
    if (!routingKeys.length) {
      throw new Error('at least one routing key is required');
    }

    const connId = generateConnectionId();
    const queueName = `${queuePrefix}_conn_${connId}_updates`;

    await this.channel.assertQueue(queueName, {
      exclusive: true,
      autoDelete: true,
      arguments: {
        'x-message-ttl': 3600000
      }
    });

    for (const routingKey of routingKeys) {
      await this.channel.bindQueue(queueName, this.exchange, routingKey);
    }

    const consumeResult = await this.channel.consume(queueName, (msg: amqp.ConsumeMessage | null) => {
      if (!msg) return;
      try {
        const update = JSON.parse(msg.content.toString());
        if (!accept(update)) {
          this.channel!.ack(msg);
          return;
        }
        onMessage(update);
        this.channel!.ack(msg);
      } catch (error) {
        console.error('[user-grpc-server][RabbitMQ] Error processing message:', error);
        this.channel!.nack(msg, false, false);
      }
    });

    console.log(
      `[user-grpc-server][RabbitMQ] Subscribed ${queueName} (${routingKeys.join(', ')})`
    );

    return {
      connId,
      subscription: {
        queueName,
        cancel: async () => {
          try {
            await this.channel!.cancel(consumeResult.consumerTag);
            await this.channel!.deleteQueue(queueName);
          } catch (error) {
            console.error('[user-grpc-server][RabbitMQ] cancel error:', error);
          }
        }
      }
    };
  }
}

export type { WatchScope } from '../updateRoutingKeys.js';
export type { MultiplexSubscription } from './multiplexSubscription.js';
