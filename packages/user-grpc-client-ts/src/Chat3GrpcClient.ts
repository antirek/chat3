/**
 * TypeScript клиент для Chat3 gRPC User Service
 */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Chat3GrpcClientOptions {
  url: string;
  apiKey: string;
  tenantId: string;
  userId: string;
}

export interface GetUserDialogsOptions {
  page?: number;
  limit?: number;
  filter?: string;
  sort?: string;
  includeLastMessage?: boolean;
}

export interface GetDialogMessagesOptions {
  page?: number;
  limit?: number;
  filter?: string;
  sort?: string;
}

export interface SendMessageOptions {
  content: string;
  type?: string;
  meta?: Record<string, any>;
  idempotencyKey?: string;
}

// Загрузка proto файла (используем общий proto пакет)
// __dirname указывает на dist/, поэтому используем ../../../packages-shared
const PROTO_PATH = path.join(__dirname, '../../../packages-shared/proto/src/chat3_user.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const chat3Proto = grpc.loadPackageDefinition(packageDefinition) as any;
const Chat3UserService = chat3Proto.chat3.user.Chat3UserService;

export class Chat3GrpcClient {
  private client: any;
  private metadata: grpc.Metadata;

  constructor(options: Chat3GrpcClientOptions) {
    this.client = new Chat3UserService(
      options.url,
      grpc.credentials.createInsecure()
    );

    // Создаем метаданные
    this.metadata = new grpc.Metadata();
    this.metadata.add('x-api-key', options.apiKey);
    this.metadata.add('x-tenant-id', options.tenantId);
    this.metadata.add('x-user-id', options.userId);
  }

  /**
   * Получить диалоги пользователя
   */
  async getUserDialogs(options: GetUserDialogsOptions = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetUserDialogs(
        {
          page: options.page || 1,
          limit: options.limit || 10,
          filter: options.filter || '',
          sort: options.sort || '',
          include_last_message: options.includeLastMessage || false
        },
        this.metadata,
        (error: grpc.ServiceError | null, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  /**
   * Получить сообщения диалога
   */
  async getDialogMessages(
    dialogId: string,
    options: GetDialogMessagesOptions = {}
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetDialogMessages(
        {
          dialog_id: dialogId,
          page: options.page || 1,
          limit: options.limit || 10,
          filter: options.filter || '',
          sort: options.sort || ''
        },
        this.metadata,
        (error: grpc.ServiceError | null, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  /**
   * Отправить сообщение
   */
  async sendMessage(
    dialogId: string,
    senderId: string,
    options: SendMessageOptions
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Преобразуем meta в Struct формат
      const meta = options.meta ? this.convertToStruct(options.meta) : undefined;

      this.client.SendMessage(
        {
          dialog_id: dialogId,
          sender_id: senderId,
          content: options.content,
          type: options.type || 'internal.text',
          meta: meta,
          idempotency_key: options.idempotencyKey || ''
        },
        this.metadata,
        (error: grpc.ServiceError | null, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  /**
   * Подписаться на обновления (server streaming)
   */
  subscribeUpdates(callback: (update: any) => void): () => void {
    const call = this.client.SubscribeUpdates({}, this.metadata);

    call.on('data', (data: any) => {
      callback(data);
    });

    call.on('error', (error: grpc.ServiceError) => {
      console.error('[Chat3GrpcClient] Stream error:', error);
    });

    call.on('end', () => {
      console.log('[Chat3GrpcClient] Stream ended');
    });

    // Возвращаем функцию для отмены подписки
    return () => {
      call.cancel();
    };
  }

  /**
   * Преобразует объект в Struct формат (для meta)
   */
  private convertToStruct(obj: Record<string, any>): any {
    // @grpc/proto-loader автоматически преобразует объекты в Struct
    // Если нужно более точное преобразование, можно использовать @grpc/grpc-js.Struct
    return obj;
  }
}
