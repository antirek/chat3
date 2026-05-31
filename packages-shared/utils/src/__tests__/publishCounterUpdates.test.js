import { jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { UserDialogStats } from '@chat3/models';

const createUserStatsUpdate = jest.fn().mockResolvedValue(undefined);
const createDialogMemberUpdate = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule('../updateUtils.js', () => ({
  createUserStatsUpdate,
  createDialogMemberUpdate
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
    createUserStatsUpdate.mockClear();
    createDialogMemberUpdate.mockClear();
  });

  test('does not push UserPackStatsUpdate (R5)', async () => {
    await publishCounterUpdates({
      tenantId: 'tnt_test',
      userIds: ['usr_alice', 'usr_bob'],
      userDialogs: [],
      packIds: ['pck_aa111111111111111111'],
      sourceEventId: 'evt_b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1',
      sourceEventType: 'message.create'
    });

    expect(createUserStatsUpdate).toHaveBeenCalledTimes(2);
  });

  test('DialogMemberUpdate passes sourceEventType to createDialogMemberUpdate', async () => {
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
      'message.status.changed',
      expect.objectContaining({
        context: expect.objectContaining({
          dialogId,
          userId,
          updatedFields: expect.arrayContaining(['member.state.unreadCount'])
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
