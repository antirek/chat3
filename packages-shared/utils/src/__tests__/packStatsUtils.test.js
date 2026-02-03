import {
  Pack,
  PackLink,
  DialogStats,
  DialogMember,
  Topic,
  UserDialogStats,
  UserPackStats,
  PackStats,
  CounterHistory
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

    await recalculateUserPackStats(tenantId, packId, {
      sourceOperation: 'test.pack.recalc',
      sourceEntityId: packId,
      actorId: 'system'
    });

    const packStats = await PackStats.findOne({ tenantId, packId }).lean();
    expect(packStats).toBeTruthy();
    expect(packStats?.messageCount).toBe(5);

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
});
