import {
  Pack,
  PackLink,
  DialogStats,
  DialogMember,
  Topic,
  UserDialogStats,
  UserDialogUnreadBySenderType,
  UserPackUnreadBySenderType,
  PackStats,
  CounterHistory,
  Message,
  MessageStatus
} from '@chat3/models';
import {
  calculatePackStats,
  recalculatePackStats,
  recalculateUserPackUnreadBySenderType,
  buildUserPackStatsFromBySenderRows
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

  it('recalculates UserPackUnreadBySenderType from UserDialogUnreadBySenderType and returns map', async () => {
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
    await UserDialogUnreadBySenderType.insertMany([
      { tenantId, userId: 'user_a', dialogId: dialogIds[0], fromType: 'user', countUnread: 2 },
      { tenantId, userId: 'user_a', dialogId: dialogIds[0], fromType: 'contact', countUnread: 1 },
      { tenantId, userId: 'user_a', dialogId: dialogIds[1], fromType: 'user', countUnread: 2 },
      { tenantId, userId: 'user_b', dialogId: dialogIds[0], fromType: 'user', countUnread: 1 }
    ]);

    await recalculatePackStats(tenantId, packId, {
      sourceOperation: 'test.pack.recalc',
      sourceEntityId: packId,
      actorId: 'system'
    });

    const userPackMap = await recalculateUserPackUnreadBySenderType(tenantId, packId, {
      sourceOperation: 'test.pack.recalc',
      sourceEntityId: packId,
      actorId: 'system'
    });

    const packStats = await PackStats.findOne({ tenantId, packId }).lean();
    expect(packStats).toBeTruthy();
    expect(packStats?.messageCount).toBe(5);

    expect(userPackMap.user_a.unreadCount).toBe(5);
    expect(userPackMap.user_a.unreadBySenderType).toEqual(
      expect.arrayContaining([
        { fromType: 'user', countUnread: 4 },
        { fromType: 'contact', countUnread: 1 },
        { fromType: 'bot', countUnread: 0 }
      ])
    );
    expect(userPackMap.user_b.unreadCount).toBe(1);
    expect(userPackMap.user_b.unreadBySenderType).toEqual(
      expect.arrayContaining([
        { fromType: 'user', countUnread: 1 },
        { fromType: 'contact', countUnread: 0 },
        { fromType: 'bot', countUnread: 0 }
      ])
    );

    const bySenderRows = await UserPackUnreadBySenderType.find({ tenantId, packId })
      .select('userId fromType countUnread')
      .lean();
    const byUser = {};
    for (const r of bySenderRows) {
      if (!byUser[r.userId]) byUser[r.userId] = {};
      byUser[r.userId][r.fromType] = r.countUnread;
    }
    expect(byUser.user_a?.user).toBe(4);
    expect(byUser.user_a?.contact).toBe(1);
    expect(byUser.user_b?.user).toBe(1);
  });

  it('buildUserPackStatsFromBySenderRows returns unreadCount and unreadBySenderType for fixed types', () => {
    const rows = [
      { fromType: 'user', countUnread: 2 },
      { fromType: 'contact', countUnread: 1 }
    ];
    const result = buildUserPackStatsFromBySenderRows(rows);
    expect(result.unreadCount).toBe(3);
    expect(result.unreadBySenderType).toHaveLength(3);
    expect(result.unreadBySenderType.find((x) => x.fromType === 'user').countUnread).toBe(2);
    expect(result.unreadBySenderType.find((x) => x.fromType === 'contact').countUnread).toBe(1);
    expect(result.unreadBySenderType.find((x) => x.fromType === 'bot').countUnread).toBe(0);
  });

  it('decrements unread for pack when message is read (recalc from UserDialogUnreadBySenderType)', async () => {
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
    await UserDialogUnreadBySenderType.create({
      tenantId,
      userId,
      dialogId,
      fromType: 'user',
      countUnread: 1
    });
    await Message.create({
      tenantId,
      messageId,
      dialogId,
      senderId: 'user_sender',
      content: 'Hello',
      type: 'internal.text'
    });

    await recalculateUserPackUnreadBySenderType(tenantId, packId, {
      sourceOperation: 'test.setup',
      sourceEntityId: packId,
      actorId: 'system'
    });

    const dialogStatsBefore = await UserDialogStats.findOne({ tenantId, userId, dialogId }).lean();
    const packBefore = await UserPackUnreadBySenderType.findOne({ tenantId, packId, userId, fromType: 'user' }).lean();
    expect(dialogStatsBefore?.unreadCount).toBe(1);
    expect(packBefore?.countUnread).toBe(1);

    await MessageStatus.create({
      tenantId,
      messageId,
      userId,
      dialogId,
      status: 'read'
    });

    const dialogStatsAfter = await UserDialogStats.findOne({ tenantId, userId, dialogId }).lean();
    expect(dialogStatsAfter?.unreadCount).toBe(0);

    await recalculateUserPackUnreadBySenderType(tenantId, packId, {
      sourceOperation: 'message.status.update',
      sourceEntityId: messageId,
      actorId: userId
    });

    const packAfter = await UserPackUnreadBySenderType.findOne({ tenantId, packId, userId, fromType: 'user' }).lean();
    expect(packAfter?.countUnread).toBe(0);
  });
});
