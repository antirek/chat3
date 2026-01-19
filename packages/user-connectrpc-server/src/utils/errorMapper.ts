/**
 * Утилиты для маппинга HTTP ошибок в ConnectRPC ошибки
 * (адаптировано из gRPC версии)
 */
import { Code } from '@connectrpc/connect';

/**
 * Маппит HTTP статус код в ConnectRPC статус код
 */
export function mapHttpStatusToConnect(httpStatus: number): Code {
  switch (httpStatus) {
    case 400:
      return Code.InvalidArgument;
    case 401:
      return Code.Unauthenticated;
    case 403:
      return Code.PermissionDenied;
    case 404:
      return Code.NotFound;
    case 409:
      return Code.AlreadyExists;
    case 429:
      return Code.ResourceExhausted;
    case 500:
    case 502:
    case 503:
      return Code.Internal;
    default:
      return Code.Unknown;
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
