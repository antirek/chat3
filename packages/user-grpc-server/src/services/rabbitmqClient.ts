/**
 * RabbitMQ клиент для подписки на updates
 */
import * as amqp from 'amqplib';
import { formatUserQueueName } from '../utils/connectionId.js';

export interface RabbitMQClientOptions {
  url: string;
}

export interface Subscription {
  queueName: string;
  channel: any;
  consumerTag: string;
  cancel: () => Promise<void>;
}

export class RabbitMQClient {
  private connection: any = null;
  private channel: any = null;
  private options: RabbitMQClientOptions;

  constructor(options: RabbitMQClientOptions) {
    this.options = options;
  }

  /**
   * Подключение к RabbitMQ
   */
  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.options.url);
      this.channel = await this.connection.createChannel();

      // Убеждаемся, что exchange существует
      await this.channel.assertExchange('chat3_updates', 'topic', {
        durable: true
      });

      console.log('[RabbitMQ] Connected successfully');
    } catch (error) {
      console.error('[RabbitMQ] Connection error:', error);
      throw error;
    }
  }

  /**
   * Отключение от RabbitMQ
   */
  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      console.log('[RabbitMQ] Disconnected');
    } catch (error) {
      console.error('[RabbitMQ] Disconnect error:', error);
      throw error;
    }
  }

  /**
   * Создать подписку на updates для пользователя
   */
  async subscribeToUserUpdates(
    userId: string,
    userType: string,
    connId: string,
    onMessage: (update: any) => void
  ): Promise<Subscription> {
    if (!this.channel) {
      throw new Error('RabbitMQ not connected');
    }

    const queueName = formatUserQueueName(userId, connId);
    const routingKey = `update.*.${userType}.${userId}.*`;

    // Создаем очередь с TTL 1 час
    await this.channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-message-ttl': 3600000 // 1 час
      }
    });

    // Привязываем очередь к exchange
    await this.channel.bindQueue(queueName, 'chat3_updates', routingKey);

    // Подписываемся на сообщения
    const consumeResult = await this.channel.consume(queueName, (msg: amqp.ConsumeMessage | null) => {
      if (!msg) {
        return;
      }

      try {
        const update = JSON.parse(msg.content.toString());
        onMessage(update);
        this.channel!.ack(msg);
      } catch (error) {
        console.error('[RabbitMQ] Error processing message:', error);
        this.channel!.nack(msg, false, false);
      }
    });

    console.log(`[RabbitMQ] Subscribed to queue: ${queueName} with routing key: ${routingKey}`);

    return {
      queueName,
      channel: this.channel,
      consumerTag: consumeResult.consumerTag,
      cancel: async () => {
        await this.channel!.cancel(consumeResult.consumerTag);
        // Очередь будет автоматически удалена через TTL
      }
    };
  }

  /**
   * Удалить очередь (опционально, для graceful cleanup)
   */
  async deleteQueue(queueName: string): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ not connected');
    }

    try {
      await this.channel.deleteQueue(queueName);
      console.log(`[RabbitMQ] Deleted queue: ${queueName}`);
    } catch (error) {
      console.error(`[RabbitMQ] Error deleting queue ${queueName}:`, error);
    }
  }
}
