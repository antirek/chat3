import { jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { UserDialogStats, UserPackUnreadBySenderType } from '@chat3/models';

const createUserStatsUpdate = jest.fn().mockResolvedValue(undefined);
const createDialogMemberUpdate = jest.fn().mockResolvedValue(undefined);
const createUserPackStatsUpdate = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule('../updateUtils.js', () => ({
  createUserStatsUpdate,
  createDialogMemberUpdate,
  createUserPackStatsUpdate
}));

const { publishCounterUpdates } = await import('../counterProcessor/publishCounterUpdates.js');

describe('publishCounterUpdates', () => {
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
    createUserStatsUpdate.mockClear();
    createDialogMemberUpdate.mockClear();
    createUserPackStatsUpdate.mockClear();
  });

  test('UserPackStatsUpdate only for packIds × userIds from slice (R1)', async () => {
    const tenantId = 'tnt_test';
    const packId = 'pck_aa111111111111111111';
    const now = Date.now();

    await UserPackUnreadBySenderType.insertMany([
      { tenantId, packId, userId: 'usr_alice', fromType: 'user', countUnread: 2, createdAt: now },
      { tenantId, packId, userId: 'usr_bob', fromType: 'user', countUnread: 1, createdAt: now },
      { tenantId, packId, userId: 'usr_carol', fromType: 'user', countUnread: 5, createdAt: now }
    ]);

    await publishCounterUpdates({
      tenantId,
      userIds: ['usr_alice', 'usr_bob'],
      userDialogs: [],
      packIds: [packId],
      sourceEventId: 'evt_b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1',
      sourceEventType: 'message.create'
    });

    expect(createUserPackStatsUpdate).toHaveBeenCalledTimes(2);
    expect(createUserPackStatsUpdate).toHaveBeenCalledWith(
      tenantId,
      'usr_alice',
      packId,
      'evt_b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1',
      'message.create',
      expect.objectContaining({ unreadCount: expect.any(Number) })
    );
    expect(createUserPackStatsUpdate).toHaveBeenCalledWith(
      tenantId,
      'usr_bob',
      packId,
      'evt_b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1',
      'message.create',
      expect.objectContaining({ unreadCount: expect.any(Number) })
    );
    expect(createUserPackStatsUpdate).not.toHaveBeenCalledWith(
      tenantId,
      'usr_carol',
      packId,
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  test('DialogMemberUpdate passes sourceEventType in context', async () => {
    const tenantId = 'tnt_test';
    const dialogId = 'dlg_cc333333333333333333';
    const userId = 'usr_alice';
    const now = Date.now();

    await UserDialogStats.create({
      tenantId,
      dialogId,
      userId,
      unreadCount: 3,
      createdAt: now
    });

    await publishCounterUpdates({
      tenantId,
      userIds: [userId],
      userDialogs: [{ userId, dialogId }],
      packIds: [],
      sourceEventId: 'evt_c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2',
      sourceEventType: 'message.status.changed'
    });

    expect(createDialogMemberUpdate).toHaveBeenCalledWith(
      tenantId,
      dialogId,
      userId,
      'evt_c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2',
      'dialog.member.changed',
      expect.objectContaining({
        context: expect.objectContaining({
          eventType: 'dialog.member.changed',
          sourceEventType: 'message.status.changed'
        })
      })
    );
  });

  test('UserStatsUpdate for each user in slice.userIds', async () => {
    await publishCounterUpdates({
      tenantId: 'tnt_test',
      userIds: ['usr_alice', 'usr_bob', 'usr_alice'],
      userDialogs: [],
      packIds: [],
      sourceEventId: 'evt_d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3',
      sourceEventType: 'message.create'
    });

    expect(createUserStatsUpdate).toHaveBeenCalledTimes(2);
  });
});
