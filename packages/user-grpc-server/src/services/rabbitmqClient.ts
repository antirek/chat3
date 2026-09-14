/**
 * RabbitMQ client for SubscribeUpdates (per-connection queues).
 */
import * as amqp from 'amqplib';

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

function formatUserQueueName(tenantId: string, userId: string, connId: string): string {
  return `user_${tenantId}_${userId}_conn_${connId}_updates`;
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
    if (!this.channel) {
      throw new Error('RabbitMQ not connected');
    }
    if (!tenantId) {
      throw new Error('tenantId is required for updates subscription');
    }

    const connId = generateConnectionId();
    const queueName = formatUserQueueName(tenantId, userId, connId);
    // Matches publish: update.{category}.{tenantId}.{userType}.{userId}.{segment}
    const routingKey = `update.*.${tenantId}.${userType}.${userId}.*`;

    await this.channel.assertQueue(queueName, {
      exclusive: true,
      autoDelete: true,
      arguments: {
        'x-message-ttl': 3600000
      }
    });
    await this.channel.bindQueue(queueName, this.exchange, routingKey);

    const consumeResult = await this.channel.consume(queueName, (msg: amqp.ConsumeMessage | null) => {
      if (!msg) return;
      try {
        const update = JSON.parse(msg.content.toString());
        // Defense-in-depth: drop cross-tenant deliveries
        if (update?.tenantId && update.tenantId !== tenantId) {
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

    console.log(`[user-grpc-server][RabbitMQ] Subscribed ${queueName} (${routingKey})`);

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
