import { Response } from 'express';
import { isMetaIndexError, metaIndexErrorResponse } from '@chat3/utils/metaIndexErrors.js';

export function handleMetaIndexError(res: Response, error: unknown): boolean {
  if (!isMetaIndexError(error)) {
    return false;
  }
  res.status(error.statusCode).json(metaIndexErrorResponse(error));
  return true;
}
