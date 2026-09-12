import { Dialog } from '@chat3/models';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';
import {
  addMemberWithEvent,
  loadDialogResult,
  normalizeUserId
} from './dialogHelpers.js';

export interface CreateDialogInput {
  tenantId: string;
  /** Actor performing the create (usually JWT user). */
  userId: string;
  memberUserIds?: string[];
  meta?: Record<string, unknown>;
}

export interface CreateDialogResult {
  dialog: {
    dialogId: string;
    tenantId: string;
    createdAt: number;
    meta: Record<string, unknown>;
    memberUserIds: string[];
  };
  created: boolean;
}

/**
 * Create a dialog with optional members and arbitrary meta.
 * Product conventions (DM keys, group titles, etc.) live outside Chat3.
 */
export async function createDialog(input: CreateDialogInput): Promise<CreateDialogResult> {
  const tenantId = input.tenantId;
  const actorId = normalizeUserId(input.userId);
  if (!tenantId || !actorId) {
    throw new AppServiceError('VALIDATION', 'tenantId and userId are required');
  }

  const metaPayload: Record<string, unknown> = {
    ...(input.meta && typeof input.meta === 'object' ? { ...input.meta } : {})
  };

  const memberIds = Array.from(
    new Set(
      (input.memberUserIds || [])
        .map(normalizeUserId)
        .filter(Boolean)
        .concat([actorId])
    )
  );

  if (memberIds.length < 1) {
    throw new AppServiceError('VALIDATION', 'At least one member is required');
  }

  const created = await Dialog.create([{ tenantId }]);
  const dialog = created[0];

  if (Object.keys(metaPayload).length > 0) {
    await metaUtils.setEntityMetaBulk(tenantId, 'dialog', dialog.dialogId, metaPayload, {
      createdBy: actorId
    });
  }

  for (const memberUserId of memberIds) {
    await addMemberWithEvent({
      tenantId,
      dialogId: dialog.dialogId,
      memberUserId,
      actorId,
      actorType: 'user'
    });
  }

  const dialogMeta = (await metaUtils.getEntityMeta(tenantId, 'dialog', dialog.dialogId)) || {};
  const dialogSection = eventUtils.buildDialogSection({
    dialogId: dialog.dialogId,
    tenantId: dialog.tenantId,
    createdAt: dialog.createdAt,
    meta: dialogMeta
  });

  const eventContext = eventUtils.buildEventContext({
    eventType: 'dialog.create',
    dialogId: dialog.dialogId,
    entityId: dialog.dialogId,
    includedSections: ['dialog'],
    updatedFields: ['dialog']
  });

  await eventUtils.createEvent({
    tenantId,
    eventType: 'dialog.create',
    entityType: 'dialog',
    entityId: dialog.dialogId,
    actorId,
    actorType: 'user',
    data: eventUtils.composeEventData({
      context: eventContext,
      dialog: dialogSection
    })
  });

  const result = await loadDialogResult(tenantId, dialog.dialogId);
  return {
    created: true,
    dialog: sanitizeResponse(result) as CreateDialogResult['dialog']
  };
}
