import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import {
  Dialog,
  DialogMember,
  Event,
  Pack,
  PackLink,
  Update
} from '@chat3/models';
import { createDialogUpdatesForPackChanged } from '../updateUtils.js';
import { resolveUiTargetForEvent } from '../eventUtils.js';
import { generateTimestamp } from '../timestampUtils.js';

const tenantId = 'tnt_pack_changed';

function createPackId(seed) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let value = 'pck_';
  for (let i = 0; i < 20; i++) {
    value += chars.charAt((seed + i) % chars.length);
  }
  return value;
}

describe('pack.changed DialogUpdate fan-out', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Update.syncIndexes();
  });

  test('resolveUiTargetForEvent(pack.changed) is dialogs.list', () => {
    expect(resolveUiTargetForEvent('pack.changed')).toBe('dialogs.list');
  });

  test('fan-out: 2 dialogs × 2 members → 4 DialogUpdates, shared user gets 2', async () => {
    const packId = createPackId(1);
    const d1 = 'dlg_aaaaaaaaaaaaaaaaaaaa';
    const d2 = 'dlg_bbbbbbbbbbbbbbbbbbbb';
    const now = generateTimestamp();

    await Pack.create({ tenantId, packId, createdAt: now });
    await PackLink.insertMany([
      { tenantId, packId, dialogId: d1 },
      { tenantId, packId, dialogId: d2 }
    ]);
    await Dialog.insertMany([
      { tenantId, dialogId: d1, createdAt: now },
      { tenantId, dialogId: d2, createdAt: now }
    ]);
    await DialogMember.insertMany([
      { tenantId, dialogId: d1, userId: 'alice', createdAt: now },
      { tenantId, dialogId: d1, userId: 'bob', createdAt: now },
      { tenantId, dialogId: d2, userId: 'alice', createdAt: now },
      { tenantId, dialogId: d2, userId: 'carl', createdAt: now }
    ]);

    const event = await Event.create({
      tenantId,
      eventType: 'pack.changed',
      entityType: 'pack',
      entityId: packId,
      actorId: 'api',
      data: {
        context: { packId, eventType: 'pack.changed', updatedFields: ['pack.meta'] },
        pack: { packId, tenantId, meta: { channel: 'telegram' }, stats: { dialogCount: 2 } }
      }
    });

    await createDialogUpdatesForPackChanged(tenantId, packId, event.eventId, event.data);

    const updates = await Update.find({ tenantId, eventId: event.eventId }).lean();
    expect(updates).toHaveLength(4);
    expect(updates.every((u) => u.updateType === 'update.dialog')).toBe(true);
    expect(updates.every((u) => u.sourceEventType === 'pack.changed')).toBe(true);
    expect(updates.every((u) => u.data?.context?.uiTarget === 'dialogs.list')).toBe(true);
    expect(updates.every((u) => u.data?.pack?.meta?.channel === 'telegram')).toBe(true);

    const aliceUpdates = updates.filter((u) => u.userId === 'alice');
    expect(aliceUpdates).toHaveLength(2);
    expect(new Set(aliceUpdates.map((u) => u.entityId))).toEqual(new Set([d1, d2]));
  });

  test('empty pack (no PackLink) creates no Updates', async () => {
    const packId = createPackId(2);
    const now = generateTimestamp();
    await Pack.create({ tenantId, packId, createdAt: now });

    const event = await Event.create({
      tenantId,
      eventType: 'pack.changed',
      entityType: 'pack',
      entityId: packId,
      data: { pack: { packId, meta: {} } }
    });

    await createDialogUpdatesForPackChanged(tenantId, packId, event.eventId, event.data);
    expect(await Update.countDocuments({ tenantId, eventId: event.eventId })).toBe(0);
  });

  test('createDialogUpdatesForPackChanged deduplicates on second run', async () => {
    const packId = createPackId(3);
    const dialogId = 'dlg_cccccccccccccccccccc';
    const now = generateTimestamp();

    await Pack.create({ tenantId, packId, createdAt: now });
    await PackLink.create({ tenantId, packId, dialogId });
    await Dialog.create({ tenantId, dialogId, createdAt: now });
    await DialogMember.create({ tenantId, dialogId, userId: 'alice', createdAt: now });

    const event = await Event.create({
      tenantId,
      eventType: 'pack.changed',
      entityType: 'pack',
      entityId: packId,
      actorId: 'api',
      data: {
        context: { packId },
        pack: { packId, meta: { label: 'x' } }
      }
    });

    await createDialogUpdatesForPackChanged(tenantId, packId, event.eventId, event.data);
    expect(await Update.countDocuments({ tenantId, eventId: event.eventId })).toBe(1);

    await createDialogUpdatesForPackChanged(tenantId, packId, event.eventId, event.data);
    expect(await Update.countDocuments({ tenantId, eventId: event.eventId })).toBe(1);
  });
});
