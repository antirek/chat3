import * as grpc from '@grpc/grpc-js';
import {
  AppServiceError,
  isAppServiceError,
  type AppServiceErrorCode
} from '@chat3/app-services';

export function mapAppErrorCodeToGrpc(code: AppServiceErrorCode): grpc.status {
  switch (code) {
    case 'VALIDATION':
      return grpc.status.INVALID_ARGUMENT;
    case 'UNAUTHORIZED':
      return grpc.status.UNAUTHENTICATED;
    case 'FORBIDDEN':
      return grpc.status.PERMISSION_DENIED;
    case 'NOT_FOUND':
      return grpc.status.NOT_FOUND;
    case 'CONFLICT':
      return grpc.status.ALREADY_EXISTS;
    case 'INTERNAL':
    default:
      return grpc.status.INTERNAL;
  }
}

export function toGrpcServiceError(error: unknown): grpc.ServiceError {
  if (isAppServiceError(error)) {
    return {
      code: mapAppErrorCodeToGrpc(error.code),
      message: error.message,
      name: error.code,
      details: error.message,
      metadata: new grpc.Metadata()
    } as grpc.ServiceError;
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error('[user-grpc-server]', error);
  return {
    code: grpc.status.INTERNAL,
    message,
    name: 'INTERNAL',
    details: message,
    metadata: new grpc.Metadata()
  } as grpc.ServiceError;
}

export function unimplemented(method: string): grpc.ServiceError {
  return {
    code: grpc.status.UNIMPLEMENTED,
    message: `${method} is not implemented yet`,
    name: 'UNIMPLEMENTED',
    details: method,
    metadata: new grpc.Metadata()
  } as grpc.ServiceError;
}
