import { Dialog } from '@chat3/models';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';
import { loadDialogResult, normalizeUserId } from './dialogHelpers.js';

export interface UpdateDialogMetaInput {
  tenantId: string;
  userId: string;
  dialogId: string;
  /** Keys merged into existing dialog meta (per-key upsert). */
  meta: Record<string, unknown>;
}

export interface UpdateDialogMetaResult {
  dialog: {
    dialogId: string;
    tenantId: string;
    createdAt: number;
    meta: Record<string, unknown>;
    memberUserIds: string[];
  };
}

/**
 * Merge opaque meta keys onto a dialog and emit dialog.changed.
 */
export async function updateDialogMeta(
  input: UpdateDialogMetaInput
): Promise<UpdateDialogMetaResult> {
  const tenantId = input.tenantId;
  const actorId = normalizeUserId(input.userId);
  const dialogId = String(input.dialogId || '').trim();
  const metaPayload =
    input.meta && typeof input.meta === 'object' ? { ...input.meta } : {};

  if (!tenantId || !actorId || !dialogId) {
    throw new AppServiceError('VALIDATION', 'tenantId, userId and dialogId are required');
  }
  if (Object.keys(metaPayload).length === 0) {
    throw new AppServiceError('VALIDATION', 'meta must contain at least one key');
  }

  const dialog = await Dialog.findOne({ tenantId, dialogId }).lean();
  if (!dialog) {
    throw new AppServiceError('NOT_FOUND', `Dialog '${dialogId}' not found`);
  }

  await metaUtils.setEntityMetaBulk(tenantId, 'dialog', dialogId, metaPayload, {
    createdBy: actorId
  });

  const dialogMeta = (await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId)) || {};
  const dialogSection = eventUtils.buildDialogSection({
    dialogId: dialog.dialogId,
    tenantId: dialog.tenantId,
    createdAt: dialog.createdAt,
    meta: dialogMeta
  });

  const eventContext = eventUtils.buildEventContext({
    eventType: 'dialog.changed',
    dialogId: dialog.dialogId,
    entityId: dialog.dialogId,
    includedSections: ['dialog'],
    updatedFields: ['dialog.meta']
  });

  await eventUtils.createEvent({
    tenantId,
    eventType: 'dialog.changed',
    entityType: 'dialog',
    entityId: dialog.dialogId,
    actorId,
    actorType: 'user',
    data: eventUtils.composeEventData({
      context: eventContext,
      dialog: dialogSection
    })
  });

  const result = await loadDialogResult(tenantId, dialogId);
  return {
    dialog: sanitizeResponse(result) as UpdateDialogMetaResult['dialog']
  };
}
