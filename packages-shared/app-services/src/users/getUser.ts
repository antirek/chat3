import { User } from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';
import { normalizeUserId } from '../dialogs/dialogHelpers.js';

export interface GetUserInput {
  tenantId: string;
  userId: string;
}

export interface GetUserResult {
  user: {
    userId: string;
    tenantId: string;
    type: string;
    createdAt: number;
    meta: Record<string, unknown>;
  };
}

export async function getUser(input: GetUserInput): Promise<GetUserResult> {
  const tenantId = input.tenantId;
  const userId = normalizeUserId(input.userId);
  if (!tenantId || !userId) {
    throw new AppServiceError('VALIDATION', 'tenantId and userId are required');
  }

  const user = await User.findOne({ tenantId, userId }).lean();
  if (!user) {
    throw new AppServiceError('NOT_FOUND', 'User not found');
  }

  const meta = (await metaUtils.getEntityMeta(tenantId, 'user', userId)) || {};

  return {
    user: sanitizeResponse({
      userId: user.userId,
      tenantId: user.tenantId,
      type: user.type,
      createdAt: user.createdAt,
      meta
    }) as GetUserResult["user"]
  };
}
