/**
 * TypeScript клиент для Chat3 gRPC User Service
 */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Опции для создания клиента Chat3 gRPC
 */
export interface Chat3GrpcClientOptions {
  /** URL gRPC сервера (например, `localhost:50051`) */
  url: string;
  /** API ключ для аутентификации */
  apiKey: string;
  /** ID тенанта */
  tenantId: string;
  /** ID пользователя */
  userId: string;
}

/**
 * Опции для получения диалогов пользователя
 */
export interface GetUserDialogsOptions {
  /** Номер страницы (по умолчанию: 1) */
  page?: number;
  /** Количество элементов на странице (по умолчанию: 10) */
  limit?: number;
  /** Фильтр в формате операторов (например, `(tenantId,eq,tnt_default)`) */
  filter?: string;
  /** Сортировка в формате JSON (например, `{"created_at": -1}`) */
  sort?: string;
  /** Включить последнее сообщение в каждый диалог */
  includeLastMessage?: boolean;
}

/**
 * Опции для получения сообщений диалога
 */
export interface GetDialogMessagesOptions {
  /** Номер страницы (по умолчанию: 1) */
  page?: number;
  /** Количество элементов на странице (по умолчанию: 10) */
  limit?: number;
  /** Фильтр в формате операторов */
  filter?: string;
  /** Сортировка в формате JSON */
  sort?: string;
}

/**
 * Опции для отправки сообщения
 */
export interface SendMessageOptions {
  /** Содержимое сообщения */
  content: string;
  /** Тип сообщения (по умолчанию: `internal.text`) */
  type?: string;
  /** Метаданные сообщения (произвольный объект) */
  meta?: Record<string, any>;
  /** Ключ идемпотентности для предотвращения дублирования сообщений */
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

/**
 * TypeScript клиент для Chat3 gRPC User Service
 * 
 * Предоставляет удобный интерфейс для работы с gRPC сервисом пользователей Chat3.
 * Поддерживает получение диалогов, сообщений, отправку сообщений и подписку на обновления.
 * 
 * @example
 * ```typescript
 * const client = new Chat3GrpcClient({
 *   url: 'localhost:50051',
 *   apiKey: 'your-api-key',
 *   tenantId: 'tnt_default',
 *   userId: 'user_123'
 * });
 * 
 * const dialogs = await client.getUserDialogs({ page: 1, limit: 10 });
 * ```
 */
export class Chat3GrpcClient {
  private client: any;
  private metadata: grpc.Metadata;

  /**
   * Создает новый экземпляр клиента Chat3 gRPC
   * 
   * @param options - Опции для создания клиента
   */
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
   * 
   * Выполняет запрос к gRPC серверу для получения списка диалогов пользователя
   * с поддержкой пагинации, фильтрации и сортировки.
   * 
   * @param options - Опции для получения диалогов
   * @returns Промис с ответом, содержащим массив диалогов и информацию о пагинации
   * 
   * @example
   * ```typescript
   * const response = await client.getUserDialogs({
   *   page: 1,
   *   limit: 20,
   *   includeLastMessage: true,
   *   filter: '(tenantId,eq,tnt_default)'
   * });
   * console.log(response.dialogs); // Массив диалогов
   * console.log(response.pagination); // Информация о пагинации
   * ```
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
   * 
   * Выполняет запрос к gRPC серверу для получения списка сообщений указанного диалога
   * с поддержкой пагинации, фильтрации и сортировки.
   * 
   * @param dialogId - ID диалога, сообщения которого нужно получить
   * @param options - Опции для получения сообщений
   * @returns Промис с ответом, содержащим массив сообщений и информацию о пагинации
   * 
   * @example
   * ```typescript
   * const response = await client.getDialogMessages('dlg_abc123', {
   *   page: 1,
   *   limit: 50,
   *   sort: '{"created_at": -1}'
   * });
   * console.log(response.messages); // Массив сообщений
   * ```
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
   * Отправить сообщение в диалог
   * 
   * Выполняет запрос к gRPC серверу для отправки нового сообщения в указанный диалог.
   * Поддерживает различные типы сообщений и метаданные.
   * 
   * @param dialogId - ID диалога, в который отправляется сообщение
   * @param senderId - ID пользователя-отправителя
   * @param options - Опции для отправки сообщения (содержимое, тип, метаданные)
   * @returns Промис с ответом, содержащим созданное сообщение
   * 
   * @example
   * ```typescript
   * const response = await client.sendMessage('dlg_abc123', 'user_123', {
   *   content: 'Hello, world!',
   *   type: 'internal.text',
   *   meta: { channel: 'whatsapp', priority: 'high' },
   *   idempotencyKey: 'msg_unique_key_123'
   * });
   * console.log(response.message); // Созданное сообщение
   * ```
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
   * Подписаться на обновления в реальном времени (server streaming)
   * 
   * Создает server streaming соединение с gRPC сервером для получения обновлений
   * в реальном времени (новые сообщения, изменения статусов и т.д.).
   * 
   * Первое сообщение в потоке содержит `event_type="connection.established"` и `conn_id`
   * в поле `data`, который можно использовать для идентификации соединения.
   * 
   * @param callback - Функция-обработчик, вызываемая при получении каждого обновления
   * @returns Функция для отмены подписки и закрытия потока
   * 
   * @example
   * ```typescript
   * const unsubscribe = client.subscribeUpdates((update) => {
   *   if (update.event_type === 'connection.established') {
   *     console.log('Connected with connId:', update.data.conn_id);
   *   } else if (update.event_type === 'message.created') {
   *     console.log('New message:', update.data);
   *   }
   * });
   * 
   * // Позже отменить подписку
   * unsubscribe();
   * ```
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
   * Преобразует объект в Struct формат для gRPC (для meta)
   * 
   * @internal
   * @param obj - Объект для преобразования
   * @returns Объект в формате Struct
   */
  private convertToStruct(obj: Record<string, any>): any {
    // @grpc/proto-loader автоматически преобразует объекты в Struct
    // Если нужно более точное преобразование, можно использовать @grpc/grpc-js.Struct
    return obj;
  }
}
