import { User } from '@chat3/models';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';
import { normalizeUserId } from '../dialogs/dialogHelpers.js';

export interface UpsertUserInput {
  tenantId: string;
  userId: string;
  name?: string;
  type?: string;
  meta?: Record<string, unknown>;
  actorId?: string;
}

export interface UpsertUserResult {
  user: {
    userId: string;
    tenantId: string;
    type: string;
    createdAt: number;
    meta: Record<string, unknown>;
  };
  created: boolean;
}

export async function upsertUser(input: UpsertUserInput): Promise<UpsertUserResult> {
  const tenantId = input.tenantId;
  const userId = normalizeUserId(input.userId);
  if (!tenantId || !userId) {
    throw new AppServiceError('VALIDATION', 'tenantId and userId are required');
  }

  const actorId = input.actorId || userId;
  const userType = input.type || 'user';
  const metaPayload: Record<string, unknown> = {
    ...(input.meta && typeof input.meta === 'object' ? input.meta : {})
  };
  if (typeof input.name === 'string' && input.name.trim()) {
    metaPayload.name = input.name.trim();
  }

  let user = await User.findOne({ tenantId, userId });
  let created = false;

  if (!user) {
    user = await User.create({
      tenantId,
      userId,
      type: userType,
      createdAt: generateTimestamp()
    });
    created = true;
  } else if (input.type !== undefined && user.type !== input.type) {
    await User.updateOne({ tenantId, userId }, { $set: { type: input.type } });
    user.type = input.type;
  }

  if (Object.keys(metaPayload).length > 0) {
    await metaUtils.setEntityMetaBulk(tenantId, 'user', userId, metaPayload, {
      createdBy: actorId
    });
  }

  const userMeta = (await metaUtils.getEntityMeta(tenantId, 'user', userId)) || {};
  const userSection = eventUtils.buildUserSection({
    userId,
    type: user.type,
    meta: userMeta
  });

  const eventType = created ? 'user.add' : 'user.changed';
  const userContext = eventUtils.buildEventContext({
    eventType,
    entityId: userId,
    includedSections: ['user'],
    updatedFields: created ? ['user'] : ['user', 'user.meta']
  });

  await eventUtils.createEvent({
    tenantId,
    eventType,
    entityType: 'user',
    entityId: userId,
    actorId,
    actorType: 'user',
    data: eventUtils.composeEventData({
      context: userContext,
      user: userSection
    })
  });

  return {
    created,
    user: sanitizeResponse({
      userId: user.userId,
      tenantId: user.tenantId,
      type: user.type,
      createdAt: user.createdAt,
      meta: userMeta
    }) as UpsertUserResult["user"]
  };
}
