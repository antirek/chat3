import { Chat3GrpcClient, Chat3GrpcClientOptions } from '@chat3/user-grpc-client-ts';

/**
 * Wrapper для gRPC клиента с управлением соединениями
 */
export class GrpcClientService {
  private clients: Map<string, Chat3GrpcClient> = new Map();

  /**
   * Получить или создать gRPC клиент для пользователя
   */
  getClient(apiKey: string, tenantId: string, userId: string): Chat3GrpcClient {
    const key = `${apiKey}:${tenantId}:${userId}`;
    
    if (!this.clients.has(key)) {
      const grpcServerUrl = process.env.GRPC_SERVER_URL || 'localhost:50051';
      const client = new Chat3GrpcClient({
        url: grpcServerUrl,
        apiKey,
        tenantId,
        userId,
      });
      this.clients.set(key, client);
    }

    return this.clients.get(key)!;
  }

  /**
   * Удалить клиент из кеша
   */
  removeClient(apiKey: string, tenantId: string, userId: string): void {
    const key = `${apiKey}:${tenantId}:${userId}`;
    this.clients.delete(key);
  }

  /**
   * Очистить все клиенты
   */
  clear(): void {
    this.clients.clear();
  }
}

export const grpcClientService = new GrpcClientService();
