import { Update } from '@chat3/models';
import { dedupeUpdates } from '../dedupeUpdates.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '@chat3/tenant-api/src/utils/__tests__/setup.js';

const UNIQUE_INDEX = 'tenantId_1_eventId_1_userId_1_updateType_1_entityId_1';

function updateDoc(overrides) {
  return {
    tenantId: 'tnt_dedupe',
    userId: 'user_1',
    entityId: 'dlg_1',
    eventId: 'evt_1',
    sourceEventType: 'message.create',
    updateType: 'update.dialog',
    data: { ok: true },
    published: false,
    createdAt: 100,
    ...overrides
  };
}

async function dropUniqueIndex() {
  try {
    const indexes = await Update.collection.indexes();
    for (const index of indexes) {
      const key = index.key || {};
      const isTarget =
        index.name === UNIQUE_INDEX ||
        (Boolean(index.unique) &&
          key.tenantId === 1 &&
          key.eventId === 1 &&
          key.userId === 1 &&
          key.updateType === 1 &&
          key.entityId === 1);
      if (isTarget) {
        await Update.collection.dropIndex(index.name);
      }
    }
  } catch (err) {
    // Collection may not exist yet in a fresh DB.
    if (err?.code !== 26 && err?.codeName !== 'NamespaceNotFound') {
      throw err;
    }
  }
}

/** Seed intentional duplicates; unique index must be absent (mongoose autoIndex may recreate it). */
async function insertDuplicateUpdates(docs) {
  Update.schema.set('autoIndex', false);
  await dropUniqueIndex();
  try {
    await Update.collection.insertMany(docs);
  } catch (err) {
    if (err?.code !== 11000) {
      throw err;
    }
    await dropUniqueIndex();
    await Update.collection.insertMany(docs);
  }
}

describe('dedupeUpdates', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
    Update.schema.set('autoIndex', false);
    await dropUniqueIndex();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
    await dropUniqueIndex();
  });

  test('keeps published document and drops the rest of the key', async () => {
    await insertDuplicateUpdates([
      updateDoc({ published: false, createdAt: 10, data: { keep: false } }),
      updateDoc({ published: true, createdAt: 50, data: { keep: true } }),
      updateDoc({ published: false, createdAt: 5, data: { keep: false } }),
      updateDoc({
        eventId: 'evt_solo',
        published: false,
        createdAt: 1,
        data: { keep: true }
      })
    ]);

    const result = await dedupeUpdates();

    expect(result.duplicateGroups).toBe(1);
    expect(result.deleted).toBe(2);
    expect(result.indexCreated).toBe(true);
    expect(result.indexError).toBeNull();

    const left = await Update.find({ tenantId: 'tnt_dedupe' }).lean();
    expect(left).toHaveLength(2);
    const grouped = left.find((doc) => doc.eventId === 'evt_1');
    expect(grouped.published).toBe(true);
    expect(grouped.data.keep).toBe(true);
  });

  test('keeps the earliest createdAt when none are published', async () => {
    await insertDuplicateUpdates([
      updateDoc({ createdAt: 30, data: { n: 30 } }),
      updateDoc({ createdAt: 10, data: { n: 10 } })
    ]);

    const result = await dedupeUpdates();

    expect(result.deleted).toBe(1);
    const left = await Update.find({ tenantId: 'tnt_dedupe' }).lean();
    expect(left).toHaveLength(1);
    expect(left[0].data.n).toBe(10);
  });
});
