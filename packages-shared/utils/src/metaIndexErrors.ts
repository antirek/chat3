export type MetaIndexErrorCode =
  | 'DUPLICATE_INDEX'
  | 'INDEX_KEYS_REQUIRED'
  | 'INDEX_VALUE_TYPE_NOT_ALLOWED'
  | 'INVALID_INDEX_SPEC'
  | 'INDEX_DEFINITION_CONFLICT'
  | 'INDEX_CONFLICT_EXISTING_DATA'
  | 'META_KEY_NOT_ALLOWED';

export class MetaIndexError extends Error {
  statusCode: number;
  code: MetaIndexErrorCode;
  details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: MetaIndexErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MetaIndexError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function isMetaIndexError(error: unknown): error is MetaIndexError {
  return error instanceof MetaIndexError;
}

export function metaIndexErrorResponse(error: MetaIndexError): {
  error: string;
  code: MetaIndexErrorCode;
  message: string;
  details?: Record<string, unknown>;
} {
  const httpError = error.statusCode === 400 ? 'Bad Request' : 'Conflict';
  return {
    error: httpError,
    code: error.code,
    message: error.message,
    ...(error.details ? { details: error.details } : {})
  };
}
