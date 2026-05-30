import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import {
  DialogMember,
  Message,
  MessageStatus,
  MessageStatusStats,
  Update,
  User,
  UserDialogStats,
  UserDialogUnreadBySenderType
} from '@chat3/models';
import { processCounterEvent } from '../counterProcessor/processCounterEvent.js';
import { generateTimestamp } from '../timestampUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, 'fixtures');

function loadJson(relativePath) {
  return JSON.parse(readFileSync(join(fixturesDir, relativePath), 'utf8'));
}

async function applySeed(seedKey) {
  const raw = loadJson(`seed/${seedKey}.json`);
  const seed = raw.extends
    ? { ...loadJson(`seed/${raw.extends}.json`), ...raw, extends: undefined }
    : raw;

  const { tenantId, dialogId, messageId, senderId, members } = seed;
  const now = generateTimestamp();

  await DialogMember.insertMany(
    members.map((userId) => ({ tenantId, dialogId, userId, createdAt: now }))
  );

  await User.insertMany(
    members.map((userId) => ({
      tenantId,
      userId,
      type: 'user',
      createdAt: now
    }))
  );

  await Message.create({
    tenantId,
    dialogId,
    messageId,
    senderId,
    type: 'internal.text',
    content: 'golden fixture',
    createdAt: now
  });

  for (const row of seed.messageStatuses ?? []) {
    await MessageStatus.create({
      tenantId,
      dialogId,
      messageId,
      userId: row.userId,
      status: row.status,
      createdAt: now + (row.offsetMs ?? 0)
    });
  }

  return { tenantId, seedKey };
}

async function assertExpectedStats(tenantId, fixtureKey) {
  const expected = loadJson('expected-stats.json')[fixtureKey];
  expect(expected).toBeDefined();

  for (const row of expected.userDialogStats ?? []) {
    const doc = await UserDialogStats.findOne({
      tenantId,
      userId: row.userId,
      dialogId: row.dialogId
    }).lean();
    expect(doc?.unreadCount).toBe(row.unreadCount);
  }

  for (const row of expected.userDialogUnreadBySenderType ?? []) {
    const doc = await UserDialogUnreadBySenderType.findOne({
      tenantId,
      userId: row.userId,
      dialogId: row.dialogId,
      fromType: row.fromType
    }).lean();
    expect(doc?.countUnread).toBe(row.countUnread);
  }

  for (const row of expected.messageStatusStats ?? []) {
    const doc = await MessageStatusStats.findOne({
      tenantId,
      messageId: row.messageId,
      status: row.status
    }).lean();
    expect(doc?.count).toBe(row.count);
  }

  if ((expected.messageStatusStats ?? []).length === 0) {
    expect(await MessageStatusStats.countDocuments({ tenantId })).toBe(0);
  }
}

async function assertExpectedUpdates(tenantId, fixtureKey, sourceEventId) {
  const expected = loadJson('expected-updates.json')[fixtureKey];
  expect(expected).toBeDefined();

  for (const row of expected.dialogMemberUpdates ?? []) {
    const update = await Update.findOne({
      tenantId,
      userId: row.userId,
      entityId: row.entityId,
      eventId: sourceEventId
    }).lean();
    expect(update).toBeTruthy();
    expect(update?.data?.member?.state?.unreadCount).toBe(row.unreadCount);
  }

  for (const userId of expected.userStatsUpdateUserIds ?? []) {
    const update = await Update.findOne({
      tenantId,
      userId,
      eventId: sourceEventId,
      eventType: 'user.stats.update'
    }).lean();
    expect(update).toBeTruthy();
  }
}

describe('counter golden fixtures (I.15)', () => {
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
  });

  test.each([
    ['message.create', 'events/message.create.json', 'message.create'],
    ['message.status.changed.read', 'events/message.status.changed.read.json', 'message.status.changed.read']
  ])('%s matches expected-stats and expected-updates', async (seedKey, eventPath, fixtureKey) => {
    const { tenantId } = await applySeed(seedKey);
    const event = loadJson(eventPath);

    await processCounterEvent(event);

    await assertExpectedStats(tenantId, fixtureKey);
    await assertExpectedUpdates(tenantId, fixtureKey, event.eventId);
  });
});
