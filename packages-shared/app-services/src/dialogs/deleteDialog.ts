import {
  Dialog,
  DialogMember,
  DialogStats,
  PackLink,
  UserDialogActivity,
  UserDialogStats,
  UserDialogUnreadBySenderType
} from '@chat3/models';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';
import { normalizeUserId } from './dialogHelpers.js';

export interface DeleteDialogInput {
  tenantId: string;
  dialogId: string;
  /** Actor for dialog.delete event (optional). */
  userId?: string;
}

export interface DeleteDialogResult {
  dialogId: string;
  deleted: boolean;
}

/**
 * Hard-delete a dialog with cascade cleanup (members, stats, meta, pack links).
 * Parity with REST DELETE /api/dialogs/:id.
 */
export async function deleteDialog(input: DeleteDialogInput): Promise<DeleteDialogResult> {
  const tenantId = input.tenantId;
  const dialogId = String(input.dialogId || '').trim();
  const actorId = input.userId ? normalizeUserId(input.userId) : 'api';

  if (!tenantId || !dialogId) {
    throw new AppServiceError('VALIDATION', 'tenantId and dialogId are required');
  }

  const dialog = await Dialog.findOneAndDelete({ tenantId, dialogId });
  if (!dialog) {
    throw new AppServiceError('NOT_FOUND', 'Dialog not found');
  }

  const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialog.dialogId);
  const dialogSection = eventUtils.buildDialogSection({
    dialogId: dialog.dialogId,
    tenantId: dialog.tenantId,
    createdAt: dialog.createdAt,
    meta: dialogMeta || {}
  });

  const eventContext = eventUtils.buildEventContext({
    eventType: 'dialog.delete',
    dialogId: dialog.dialogId,
    entityId: dialog.dialogId,
    includedSections: ['dialog'],
    updatedFields: ['dialog']
  });

  await eventUtils.createEvent({
    tenantId,
    eventType: 'dialog.delete',
    entityType: 'dialog',
    entityId: dialog.dialogId,
    actorId,
    actorType: input.userId ? 'user' : 'api',
    data: eventUtils.composeEventData({
      context: eventContext,
      dialog: dialogSection
    })
  });

  await metaUtils.deleteAllMetaForEntity(tenantId, 'dialog', dialog.dialogId);
  await PackLink.deleteMany({ dialogId: dialog.dialogId, tenantId });

  await Promise.all([
    DialogMember.deleteMany({ dialogId: dialog.dialogId, tenantId }),
    UserDialogStats.deleteMany({ dialogId: dialog.dialogId, tenantId }),
    UserDialogActivity.deleteMany({ dialogId: dialog.dialogId, tenantId }),
    UserDialogUnreadBySenderType.deleteMany({ dialogId: dialog.dialogId, tenantId }),
    DialogStats.deleteMany({ dialogId: dialog.dialogId, tenantId })
  ]);

  return {
    dialogId: dialog.dialogId,
    deleted: true
  };
}
