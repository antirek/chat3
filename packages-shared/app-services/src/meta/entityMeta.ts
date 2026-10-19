import { Dialog, DialogMember, Message, Pack, Tenant, Topic, User } from '@chat3/models';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { isMetaIndexError } from '@chat3/utils/metaIndexErrors.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';
import { normalizeUserId } from '../dialogs/dialogHelpers.js';

const VALID_ENTITY_TYPES = [
  'user',
  'dialog',
  'message',
  'tenant',
  'system',
  'dialogMember',
  'topic',
  'pack'
] as const;

export type MetaEntityTypeName = (typeof VALID_ENTITY_TYPES)[number];

const VALID_DATA_TYPES = ['string', 'number', 'boolean', 'object', 'array'] as const;
export type MetaDataType = (typeof VALID_DATA_TYPES)[number];

function assertEntityType(entityType: string): MetaEntityTypeName {
  if (!VALID_ENTITY_TYPES.includes(entityType as MetaEntityTypeName)) {
    throw new AppServiceError(
      'VALIDATION',
      `Invalid entityType. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`
    );
  }
  return entityType as MetaEntityTypeName;
}

function inferDataType(value: unknown): MetaDataType {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
  if (value !== null && typeof value === 'object') return 'object';
  return 'string';
}

async function verifyEntityExists(
  entityType: MetaEntityTypeName,
  entityId: string,
  tenantId: string
): Promise<void> {
  let exists = false;
  switch (entityType) {
    case 'user':
      exists = !!(await User.findOne({ tenantId, userId: entityId }).select('userId').lean());
      break;
    case 'dialog':
      exists = !!(await Dialog.findOne({ tenantId, dialogId: entityId }).select('dialogId').lean());
      break;
    case 'message':
      exists = !!(await Message.findOne({ tenantId, messageId: entityId }).select('messageId').lean());
      break;
    case 'tenant':
      exists = !!(await Tenant.findOne({ tenantId: entityId }).select('tenantId').lean());
      break;
    case 'system':
      exists = true;
      break;
    case 'dialogMember': {
      const [dialogId, userId] = String(entityId).split(':');
      if (!dialogId || !userId) {
        throw new AppServiceError(
          'VALIDATION',
          'dialogMember entityId must be dialogId:userId'
        );
      }
      exists = !!(await DialogMember.findOne({ tenantId, dialogId, userId })
        .select('userId')
        .lean());
      break;
    }
    case 'topic':
      exists = !!(await Topic.findOne({ tenantId, topicId: entityId }).select('topicId').lean());
      break;
    case 'pack':
      exists = !!(await Pack.findOne({ tenantId, packId: entityId }).select('packId').lean());
      break;
    default:
      exists = false;
  }
  if (!exists) {
    throw new AppServiceError('NOT_FOUND', `${entityType} '${entityId}' not found`);
  }
}

async function emitMetaSideEffects(
  tenantId: string,
  entityType: MetaEntityTypeName,
  entityId: string,
  actorId: string
): Promise<void> {
  try {
    if (entityType === 'dialog') {
      const dialog = await Dialog.findOne({ tenantId, dialogId: entityId }).lean();
      if (!dialog) return;
      const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', entityId);
      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });
      await eventUtils.createEvent({
        tenantId,
        eventType: 'dialog.changed',
        entityType: 'dialog',
        entityId,
        actorId,
        actorType: 'user',
        data: eventUtils.composeEventData({
          context: eventUtils.buildEventContext({
            eventType: 'dialog.changed',
            dialogId: entityId,
            entityId,
            includedSections: ['dialog'],
            updatedFields: ['dialog.meta']
          }),
          dialog: dialogSection
        })
      });
    } else if (entityType === 'message') {
      const message = await Message.findOne({ tenantId, messageId: entityId }).lean();
      if (!message) return;
      const messageMeta = await metaUtils.getEntityMeta(tenantId, 'message', entityId);
      const messageSection = eventUtils.buildMessageSection({
        messageId: message.messageId,
        dialogId: message.dialogId,
        senderId: message.senderId,
        type: message.type,
        content: message.content,
        meta: messageMeta
      });
      await eventUtils.createEvent({
        tenantId,
        eventType: 'message.changed',
        entityType: 'message',
        entityId,
        actorId,
        actorType: 'user',
        data: eventUtils.composeEventData({
          context: eventUtils.buildEventContext({
            eventType: 'message.changed',
            dialogId: message.dialogId,
            entityId,
            messageId: entityId,
            includedSections: ['message'],
            updatedFields: ['message.meta']
          }),
          message: messageSection
        })
      });
    }
  } catch (err) {
    console.error('entityMeta side-effect event failed:', err);
  }
}

export interface SetEntityMetaInput {
  tenantId: string;
  entityType: string;
  entityId: string;
  key: string;
  value: unknown;
  dataType?: string;
  userId?: string;
}

export interface SetEntityMetaResult {
  meta: Record<string, unknown>;
}

export async function setEntityMetaService(
  input: SetEntityMetaInput
): Promise<SetEntityMetaResult> {
  const tenantId = input.tenantId;
  const entityType = assertEntityType(String(input.entityType || '').trim());
  const entityId = decodeURIComponent(String(input.entityId || '').trim());
  const key = String(input.key || '').trim();
  const actorId = input.userId ? normalizeUserId(input.userId) : 'api';

  if (!tenantId || !entityId || !key) {
    throw new AppServiceError('VALIDATION', 'tenantId, entityId and key are required');
  }

  let dataType = (input.dataType || '').trim() as MetaDataType | '';
  if (dataType && !VALID_DATA_TYPES.includes(dataType as MetaDataType)) {
    throw new AppServiceError(
      'VALIDATION',
      `Invalid dataType. Must be one of: ${VALID_DATA_TYPES.join(', ')}`
    );
  }
  if (!dataType) {
    dataType = inferDataType(input.value);
  }

  await verifyEntityExists(entityType, entityId, tenantId);

  try {
    await metaUtils.setEntityMeta(
      tenantId,
      entityType as any,
      entityId,
      key,
      input.value,
      dataType,
      { createdBy: actorId }
    );
  } catch (err: unknown) {
    if (isMetaIndexError(err)) {
      throw new AppServiceError('VALIDATION', err.message || 'Meta index error');
    }
    throw err;
  }

  await emitMetaSideEffects(tenantId, entityType, entityId, actorId);

  const meta = (await metaUtils.getEntityMeta(tenantId, entityType as any, entityId)) || {};
  return { meta: sanitizeResponse(meta) as Record<string, unknown> };
}

export interface GetEntityMetaInput {
  tenantId: string;
  entityType: string;
  entityId: string;
  key?: string;
}

export interface GetEntityMetaResult {
  meta: Record<string, unknown>;
}

export async function getEntityMetaService(
  input: GetEntityMetaInput
): Promise<GetEntityMetaResult> {
  const tenantId = input.tenantId;
  const entityType = assertEntityType(String(input.entityType || '').trim());
  const entityId = decodeURIComponent(String(input.entityId || '').trim());
  const key = input.key ? String(input.key).trim() : '';

  if (!tenantId || !entityId) {
    throw new AppServiceError('VALIDATION', 'tenantId and entityId are required');
  }

  await verifyEntityExists(entityType, entityId, tenantId);

  const all = (await metaUtils.getEntityMeta(tenantId, entityType as any, entityId)) || {};
  if (key) {
    if (!(key in all)) {
      throw new AppServiceError('NOT_FOUND', `Meta key '${key}' not found`);
    }
    return { meta: sanitizeResponse({ [key]: all[key] }) as Record<string, unknown> };
  }
  return { meta: sanitizeResponse(all) as Record<string, unknown> };
}

export interface DeleteEntityMetaInput {
  tenantId: string;
  entityType: string;
  entityId: string;
  key: string;
  userId?: string;
}

export interface DeleteEntityMetaResult {
  deleted: boolean;
}

export async function deleteEntityMetaService(
  input: DeleteEntityMetaInput
): Promise<DeleteEntityMetaResult> {
  const tenantId = input.tenantId;
  const entityType = assertEntityType(String(input.entityType || '').trim());
  const entityId = decodeURIComponent(String(input.entityId || '').trim());
  const key = String(input.key || '').trim();
  const actorId = input.userId ? normalizeUserId(input.userId) : 'api';

  if (!tenantId || !entityId || !key) {
    throw new AppServiceError('VALIDATION', 'tenantId, entityId and key are required');
  }

  await verifyEntityExists(entityType, entityId, tenantId);

  let deleted = false;
  try {
    deleted = await metaUtils.deleteEntityMeta(tenantId, entityType as any, entityId, key);
  } catch (err: unknown) {
    if (isMetaIndexError(err)) {
      throw new AppServiceError('VALIDATION', err.message || 'Meta index error');
    }
    throw err;
  }

  if (deleted) {
    await emitMetaSideEffects(tenantId, entityType, entityId, actorId);
  }

  return { deleted };
}
