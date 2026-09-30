import mongoose from 'mongoose';
import {
  DialogStats,
  Message,
  MessageCountClaim,
  PackLink,
  UserStats
} from '@chat3/models';
import { applyHotMessageCount } from '../counterProcessor/applyHotMessageCount.js';
import { recalculateSlice } from '../counterProcessor/recalculateSlice.js';
import { calculatePackStats } from '../packStatsUtils.js';
import { generateTimestamp } from '../timestampUtils.js';
import { createTestMongoServer } from './createTestMongoServer.js';

const tenantId = 'tnt_test';
const dialogId = 'dlg_aa111111111111111111';
const senderId = 'alice';
const packId = 'pck_cc333333333333333333';

function eventId(char) {
  return `evt_${char.repeat(32)}`;
}

function slice(overrides) {
  return {
    tenantId,
    dialogIds: [dialogId],
    messageIds: ['msg_bb222222222222222222'],
    userIds: [],
    userDialogs: [],
    packIds: [],
    senderId,
    sourceEventId: eventId('a'),
    sourceEventType: 'message.create',
    actorId: 'system',
    actorType: 'system',
    ...overrides
  };
}

describe('applyHotMessageCount', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await createTestMongoServer();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  async function seedMessage(fields) {
    const now = generateTimestamp();
    await Message.create({
      tenantId,
      dialogId,
      messageId: 'msg_bb222222222222222222',
      senderId,
      type: 'internal.text',
      content: 'hi',
      createdAt: now,
      ...fields
    });
  }

  async function counts() {
    const user = await UserStats.findOne({ tenantId, userId: senderId }).lean();
    const dialog = await DialogStats.findOne({ tenantId, dialogId }).lean();
    return {
      total: user?.totalMessagesCount ?? 0,
      dialog: dialog?.messageCount ?? 0
    };
  }

  test('create increments both counters, including system messages', async () => {
    await seedMessage({ type: 'system.member_added', content: '' });
    await applyHotMessageCount(slice({ sourceEventType: 'message.create' }));
    expect(await counts()).toEqual({ total: 1, dialog: 1 });
  });

  test('delete decrements, restore increments, repeat event does not double', async () => {
    await seedMessage({});
    await applyHotMessageCount(slice({ sourceEventId: eventId('a'), sourceEventType: 'message.create' }));
    expect(await counts()).toEqual({ total: 1, dialog: 1 });

    await applyHotMessageCount(slice({ sourceEventId: eventId('a'), sourceEventType: 'message.create' }));
    expect(await counts()).toEqual({ total: 1, dialog: 1 });
    expect(await MessageCountClaim.countDocuments({ tenantId })).toBe(1);

    await Message.updateOne({ messageId: 'msg_bb222222222222222222' }, { deleted: true });
    await applyHotMessageCount(slice({ sourceEventId: eventId('b'), sourceEventType: 'message.deleted' }));
    expect(await counts()).toEqual({ total: 0, dialog: 0 });

    await Message.updateOne({ messageId: 'msg_bb222222222222222222' }, { deleted: false });
    await applyHotMessageCount(slice({ sourceEventId: eventId('c'), sourceEventType: 'message.deleted' }));
    expect(await counts()).toEqual({ total: 1, dialog: 1 });
  });

  test('hot path does not countDocuments on messages and pack sums dialog stats', async () => {
    await seedMessage({});
    await PackLink.create({ tenantId, packId, dialogId, addedAt: generateTimestamp() });
    const originalCount = Message.countDocuments;
    let countCalls = 0;
    Message.countDocuments = function countDocuments(...args) {
      countCalls += 1;
      return originalCount.apply(this, args);
    };
    try {
      await recalculateSlice(slice({ sourceEventType: 'message.create' }));
    } finally {
      Message.countDocuments = originalCount;
    }
    expect(countCalls).toBe(0);

    const pack = await calculatePackStats(tenantId, packId);
    expect(pack.messageCount).toBe(1);

    await Message.create({
      tenantId,
      dialogId,
      messageId: 'msg_dd444444444444444444',
      senderId,
      type: 'internal.text',
      content: 'extra',
      createdAt: generateTimestamp()
    });
    const originalCountAgain = Message.countDocuments;
    let countCallsAgain = 0;
    Message.countDocuments = function countDocuments(...args) {
      countCallsAgain += 1;
      return originalCountAgain.apply(this, args);
    };
    try {
      await recalculateSlice(slice({ sourceEventId: eventId('a'), sourceEventType: 'message.create' }));
    } finally {
      Message.countDocuments = originalCountAgain;
    }
    expect(countCallsAgain).toBe(0);
    expect(await counts()).toEqual({ total: 1, dialog: 1 });
  });
});
