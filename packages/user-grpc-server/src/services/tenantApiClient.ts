/**
 * HTTP клиент для tenant-api
 */
import axios, { AxiosInstance, AxiosError } from 'axios';

export interface TenantApiClientOptions {
  baseURL: string;
  apiKey: string;
  tenantId: string;
}

export class TenantApiClient {
  private client: AxiosInstance;

  constructor(options: TenantApiClientOptions) {
    this.client = axios.create({
      baseURL: options.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': options.apiKey,
        'X-Tenant-ID': options.tenantId
      }
    });
  }

  /**
   * Получить диалоги пользователя
   */
  async getUserDialogs(
    userId: string,
    params?: {
      page?: number;
      limit?: number;
      filter?: string;
      sort?: string;
      includeLastMessage?: boolean;
    }
  ): Promise<any> {
    try {
      const response = await this.client.get(`/api/users/${userId}/dialogs`, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получить сообщения диалога
   */
  async getDialogMessages(
    userId: string,
    dialogId: string,
    params?: {
      page?: number;
      limit?: number;
      filter?: string;
      sort?: string;
    }
  ): Promise<any> {
    try {
      const response = await this.client.get(
        `/api/users/${userId}/dialogs/${dialogId}/messages`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Отправить сообщение
   */
  async sendMessage(
    dialogId: string,
    data: {
      senderId: string;
      content: string;
      type?: string;
      meta?: Record<string, any>;
      idempotencyKey?: string;
    }
  ): Promise<any> {
    try {
      const headers: Record<string, string> = {};
      if (data.idempotencyKey) {
        headers['X-Idempotency-Key'] = data.idempotencyKey;
      }

      const response = await this.client.post(`/api/dialogs/${dialogId}/messages`, data, {
        headers
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получить информацию о пользователе
   */
  async getUser(userId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/users/${userId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Обработка ошибок HTTP
   */
  private handleError(error: unknown): AxiosError {
    if (axios.isAxiosError(error)) {
      return error;
    }
    throw error;
  }
}
