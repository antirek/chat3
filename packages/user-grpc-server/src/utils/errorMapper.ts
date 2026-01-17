/**
 * Утилиты для маппинга HTTP ошибок в gRPC статусы
 */
import * as grpc from '@grpc/grpc-js';

/**
 * Маппит HTTP статус код в gRPC статус код
 */
export function mapHttpStatusToGrpc(httpStatus: number): grpc.status {
  switch (httpStatus) {
    case 400:
      return grpc.status.INVALID_ARGUMENT;
    case 401:
      return grpc.status.UNAUTHENTICATED;
    case 403:
      return grpc.status.PERMISSION_DENIED;
    case 404:
      return grpc.status.NOT_FOUND;
    case 409:
      return grpc.status.ALREADY_EXISTS;
    case 429:
      return grpc.status.RESOURCE_EXHAUSTED;
    case 500:
    case 502:
    case 503:
      return grpc.status.INTERNAL;
    default:
      return grpc.status.UNKNOWN;
  }
}

/**
 * Логирует ошибку в console.log
 */
export function logError(message: string, error: any, metadata?: Record<string, any>): void {
  const errorInfo: any = {
    message,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...metadata
  };
  console.log('[ERROR]', JSON.stringify(errorInfo, null, 2));
}

/**
 * Создает gRPC ошибку с логированием
 */
export function createGrpcError(
  status: grpc.status,
  message: string,
  error?: any,
  metadata?: Record<string, any>
): grpc.ServiceError {
  logError(message, error, metadata);
  
  const serviceError = {
    code: status,
    message: message,
    name: grpc.status[status] || 'UNKNOWN',
    details: error instanceof Error ? error.message : String(error),
    metadata: new grpc.Metadata()
  } as grpc.ServiceError;
  
  return serviceError;
}
