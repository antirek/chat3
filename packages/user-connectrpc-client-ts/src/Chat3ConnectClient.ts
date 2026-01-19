/**
 * TypeScript клиент для Chat3 ConnectRPC User Service
 */
import { createPromiseClient, PromiseClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import type { Transport } from '@connectrpc/connect';
import { Chat3UserService } from './generated/chat3_user_connect.js';
import {
  GetUserDialogsRequest as GeneratedGetUserDialogsRequest,
  GetDialogMessagesRequest as GeneratedGetDialogMessagesRequest,
  SendMessageRequest as GeneratedSendMessageRequest,
  SubscribeUpdatesRequest as GeneratedSubscribeUpdatesRequest,
  Update as GeneratedUpdate
} from './generated/chat3_user_pb.js';

export interface Chat3ConnectClientOptions {
  baseUrl: string;
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

// Временные типы (заменятся на сгенерированные из proto)
export interface GetUserDialogsRequest {
  page?: number;
  limit?: number;
  filter?: string;
  sort?: string;
  includeLastMessage?: boolean;
}

export interface GetUserDialogsResponse {
  dialogs: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface GetDialogMessagesRequest {
  dialogId: string;
  page?: number;
  limit?: number;
  filter?: string;
  sort?: string;
}

export interface GetDialogMessagesResponse {
  messages: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface SendMessageRequest {
  dialogId: string;
  senderId: string;
  content: string;
  type?: string;
  meta?: any;
  idempotencyKey?: string;
}

export interface SendMessageResponse {
  message: any;
}

export interface SubscribeUpdatesRequest {
  // Пустой запрос
}

export interface Update {
  updateId: string;
  tenantId: string;
  userId: string;
  entityId: string;
  eventType: string;
  data?: any;
  createdAt: number;
}

export class Chat3ConnectClient {
  private client: PromiseClient<typeof Chat3UserService>;
  private transport: Transport;
  private baseUrl: string;
  private apiKey: string;
  private tenantId: string;
  private userId: string;

  constructor(options: Chat3ConnectClientOptions) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
    this.tenantId = options.tenantId;
    this.userId = options.userId;

    // Создаем транспорт для ConnectRPC с headers
    // Для браузерных клиентов ConnectRPC использует JSON формат по умолчанию
    // Binary формат может работать неправильно через HTTP/1.1 в браузере
    this.transport = createConnectTransport({
      baseUrl: options.baseUrl,
      useBinaryFormat: false, // JSON формат для браузерных клиентов
      // Добавляем custom headers для всех запросов
      interceptors: [
        (next) => async (req) => {
          req.header.set('x-api-key', options.apiKey);
          req.header.set('x-tenant-id', options.tenantId);
          req.header.set('x-user-id', options.userId);
          return await next(req);
        }
      ]
    });

    // Создаем типизированный клиент из сгенерированного сервиса
    this.client = createPromiseClient(Chat3UserService, this.transport);
  }

  /**
   * Получить диалоги пользователя
   */
  async getUserDialogs(options: GetUserDialogsOptions = {}): Promise<GetUserDialogsResponse> {
    const request = new GeneratedGetUserDialogsRequest({
      page: options.page || 1,
      limit: options.limit || 10,
      filter: options.filter,
      sort: options.sort,
      includeLastMessage: options.includeLastMessage
    });

    const response = await this.client.getUserDialogs(request);
    
    // Преобразуем сгенерированный тип в DTO для совместимости с существующим кодом
    return {
      dialogs: response.dialogs as any[],
      pagination: {
        page: response.pagination?.page || 1,
        limit: response.pagination?.limit || 10,
        total: response.pagination?.total || 0,
        pages: response.pagination?.pages || 0
      }
    };
  }

  /**
   * Получить сообщения диалога
   */
  async getDialogMessages(
    dialogId: string,
    options: GetDialogMessagesOptions = {}
  ): Promise<GetDialogMessagesResponse> {
    const request = new GeneratedGetDialogMessagesRequest({
      dialogId,
      page: options.page || 1,
      limit: options.limit || 10,
      filter: options.filter,
      sort: options.sort
    });

    const response = await this.client.getDialogMessages(request);
    
    return {
      messages: response.messages as any[],
      pagination: {
        page: response.pagination?.page || 1,
        limit: response.pagination?.limit || 10,
        total: response.pagination?.total || 0,
        pages: response.pagination?.pages || 0
      }
    };
  }

  /**
   * Отправить сообщение
   */
  async sendMessage(
    dialogId: string,
    senderId: string,
    options: SendMessageOptions
  ): Promise<SendMessageResponse> {
    const request = new GeneratedSendMessageRequest({
      dialogId,
      senderId,
      content: options.content,
      type: options.type || 'internal.text',
      meta: options.meta as any,
      idempotencyKey: options.idempotencyKey
    });

    const response = await this.client.sendMessage(request);
    
    return {
      message: response.message as any
    };
  }

  /**
   * Подписаться на обновления (server streaming)
   * Используем ConnectRPC client для server streaming
   */
  async* subscribeUpdates(): AsyncGenerator<Update, void, unknown> {
    const request = new GeneratedSubscribeUpdatesRequest({});

    try {
      // Для ConnectRPC v1.7.0 используем прямой вызов через client для server streaming
      // this.client.subscribeUpdates возвращает async iterable для streaming
      const stream = this.client.subscribeUpdates(request);

      // Итерируемся по stream и yield каждый Update
      for await (const response of stream) {
        // response уже является GeneratedUpdate (десериализованным из protobuf)
        const update = response as GeneratedUpdate;
        
        // Преобразуем GeneratedUpdate в Update DTO
        yield {
          updateId: update.updateId || '',
          tenantId: update.tenantId || '',
          userId: update.userId || '',
          entityId: update.entityId || '',
          eventType: update.eventType || '',
          data: update.data ? (update.data as any).toJson ? (update.data as any).toJson() : update.data : undefined,
          createdAt: update.createdAt ? Number(update.createdAt) : Date.now()
        } as Update;
      }
    } catch (error) {
      console.error('Error in subscribeUpdates:', error);
      throw error;
    }
  }
}
