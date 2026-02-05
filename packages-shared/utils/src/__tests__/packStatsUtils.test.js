import {
  Pack,
  PackLink,
  DialogStats,
  DialogMember,
  Topic,
  UserDialogStats,
  UserPackStats,
  PackStats,
  CounterHistory,
  Message,
  MessageStatus
} from '@chat3/models';
import {
  calculatePackStats,
  recalculatePackStats,
  recalculateUserPackStats
} from '../packStatsUtils.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '@chat3/tenant-api/src/utils/__tests__/setup.js';

const tenantId = 'tnt_pack_stats';

function createDialogId(suffix) {
  return `dlg_${suffix.padEnd(20, 'a')}`;
}

function createPackId(suffix) {
  return `pck_${suffix.padEnd(20, 'b')}`;
}

function createMessageId(suffix) {
  return `msg_${suffix.padEnd(20, 'c')}`;
}

describe('packStatsUtils', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('calculates aggregated pack stats from dialog stats/members/topics', async () => {
    const packId = createPackId('calc');
    const [dialogA, dialogB] = [createDialogId('1'), createDialogId('2')];

    await Pack.create({ tenantId, packId });
    await PackLink.insertMany([
      { tenantId, packId, dialogId: dialogA },
      { tenantId, packId, dialogId: dialogB }
    ]);

    await DialogStats.create([
      { tenantId, dialogId: dialogA, messageCount: 10, memberCount: 2, topicCount: 1 },
      { tenantId, dialogId: dialogB, messageCount: 5, memberCount: 3, topicCount: 2 }
    ]);

    await DialogMember.insertMany([
      { tenantId, dialogId: dialogA, userId: 'user_a' },
      { tenantId, dialogId: dialogA, userId: 'user_b' },
      { tenantId, dialogId: dialogB, userId: 'user_b' },
      { tenantId, dialogId: dialogB, userId: 'user_c' }
    ]);

    await Topic.insertMany([
      { tenantId, dialogId: dialogA, topicId: `topic_${'1'.padEnd(20, 'x')}` },
      { tenantId, dialogId: dialogB, topicId: `topic_${'2'.padEnd(20, 'y')}` },
      { tenantId, dialogId: dialogB, topicId: `topic_${'3'.padEnd(20, 'z')}` }
    ]);

    const stats = await calculatePackStats(tenantId, packId);

    expect(stats).toEqual({
      messageCount: 15,
      sumMemberCount: 5,
      sumTopicCount: 3,
      uniqueMemberCount: 3,
      uniqueTopicCount: 3
    });
  });

  it('recalculates and persists pack/user pack stats with history entries', async () => {
    const packId = createPackId('persist');
    const dialogIds = [createDialogId('10'), createDialogId('20')];

    await Pack.create({ tenantId, packId });
    await PackLink.insertMany(
      dialogIds.map((dialogId) => ({ tenantId, packId, dialogId }))
    );
    await DialogStats.insertMany(
      dialogIds.map((dialogId, index) => ({
        tenantId,
        dialogId,
        messageCount: 2 + index,
        memberCount: 1 + index,
        topicCount: 1
      }))
    );
    await DialogMember.insertMany([
      { tenantId, dialogId: dialogIds[0], userId: 'user_a' },
      { tenantId, dialogId: dialogIds[0], userId: 'user_b' },
      { tenantId, dialogId: dialogIds[1], userId: 'user_a' }
    ]);
    await Topic.insertMany([
      { tenantId, dialogId: dialogIds[0], topicId: `topic_${'4'.padEnd(20, 'q')}` }
    ]);
    await UserDialogStats.insertMany([
      { tenantId, userId: 'user_a', dialogId: dialogIds[0], unreadCount: 3 },
      { tenantId, userId: 'user_a', dialogId: dialogIds[1], unreadCount: 2 },
      { tenantId, userId: 'user_b', dialogId: dialogIds[0], unreadCount: 1 }
    ]);

    await recalculatePackStats(tenantId, packId, {
      sourceOperation: 'test.pack.recalc',
      sourceEntityId: packId,
      actorId: 'system'
    });

    const userPackMap = await recalculateUserPackStats(tenantId, packId, {
      sourceOperation: 'test.pack.recalc',
      sourceEntityId: packId,
      actorId: 'system'
    });

    const packStats = await PackStats.findOne({ tenantId, packId }).lean();
    expect(packStats).toBeTruthy();
    expect(packStats?.messageCount).toBe(5);

    expect(userPackMap.user_a.unreadCount).toBe(5);
    expect(userPackMap.user_b.unreadCount).toBe(1);

    const userPackEntries = await UserPackStats.find({ tenantId, packId })
      .select('userId unreadCount')
      .lean();
    const unreadMap = Object.fromEntries(userPackEntries.map((entry) => [entry.userId, entry.unreadCount]));
    expect(unreadMap).toEqual({
      user_a: 5,
      user_b: 1
    });

    const historyEntries = await CounterHistory.find({ tenantId, counterType: 'userPackStats.unreadCount' });
    expect(historyEntries.length).toBeGreaterThan(0);
  });

  it('decrements unread counts for dialog and pack when message is read', async () => {
    const packId = createPackId('read');
    const dialogId = createDialogId('read');
    const messageId = createMessageId('1');
    const userId = 'user_reader';

    await Pack.create({ tenantId, packId });
    await PackLink.create({ tenantId, packId, dialogId });
    await DialogStats.create({ tenantId, dialogId, messageCount: 1, memberCount: 1, topicCount: 0 });
    await DialogMember.create({ tenantId, dialogId, userId });
    await Topic.create({ tenantId, dialogId, topicId: `topic_${'r'.padEnd(20, 'x')}` });

    await UserDialogStats.create({ tenantId, userId, dialogId, unreadCount: 1 });
    await Message.create({
      tenantId,
      messageId,
      dialogId,
      senderId: 'user_sender',
      content: 'Hello',
      type: 'internal.text'
    });

    await recalculateUserPackStats(tenantId, packId, {
      sourceOperation: 'test.setup',
      sourceEntityId: packId,
      actorId: 'system'
    });

    const dialogStatsBefore = await UserDialogStats.findOne({ tenantId, userId, dialogId }).lean();
    const packStatsBefore = await UserPackStats.findOne({ tenantId, packId, userId }).lean();
    expect(dialogStatsBefore?.unreadCount).toBe(1);
    expect(packStatsBefore?.unreadCount).toBe(1);

    await MessageStatus.create({
      tenantId,
      messageId,
      userId,
      dialogId,
      status: 'read'
    });

    const dialogStatsAfter = await UserDialogStats.findOne({ tenantId, userId, dialogId }).lean();
    expect(dialogStatsAfter?.unreadCount).toBe(0);

    // Симулируем update-worker: при message.status.update пересчёт пака и рассылка update
    // (см. update-worker: updatePackCountersForDialog → recalculateUserPackStats → createUserPackStatsUpdate)
    await recalculateUserPackStats(tenantId, packId, {
      sourceOperation: 'message.status.update',
      sourceEntityId: messageId,
      actorId: userId
    });

    const packStatsAfter = await UserPackStats.findOne({ tenantId, packId, userId }).lean();
    expect(packStatsAfter?.unreadCount).toBe(0);
  });
});
