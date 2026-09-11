export type AppServiceErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INTERNAL';

export class AppServiceError extends Error {
  readonly code: AppServiceErrorCode;

  constructor(code: AppServiceErrorCode, message: string) {
    super(message);
    this.name = 'AppServiceError';
    this.code = code;
  }
}

export function isAppServiceError(error: unknown): error is AppServiceError {
  return error instanceof AppServiceError;
}

/** HTTP status for REST adapters (keeps HTTP API contract stable). */
export function appServiceErrorToHttpStatus(error: AppServiceError): number {
  switch (error.code) {
    case 'VALIDATION':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    case 'INTERNAL':
    default:
      return 500;
  }
}

export function appServiceErrorToHttpBody(error: AppServiceError): {
  error: string;
  message: string;
} {
  const titles: Record<AppServiceErrorCode, string> = {
    VALIDATION: 'Bad Request',
    UNAUTHORIZED: 'Unauthorized',
    FORBIDDEN: 'Forbidden',
    NOT_FOUND: 'Not Found',
    CONFLICT: 'Conflict',
    INTERNAL: 'Internal Server Error'
  };
  return {
    error: titles[error.code] || 'Internal Server Error',
    message: error.message
  };
}
