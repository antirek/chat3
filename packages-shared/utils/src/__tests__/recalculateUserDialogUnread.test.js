import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { DialogMember, Message } from '@chat3/models';
import {
  countUserDialogUnread,
  recalculateUserDialogUnread
} from '../counterProcessor/recalculateUserDialogUnread.js';
import { generateTimestamp } from '../timestampUtils.js';

describe('recalculateUserDialogUnread / countUserDialogUnread', () => {
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

  const tenantId = 'tnt_join_boundary';
  const dialogId = 'dlg_aa111111111111111111';
  const senderId = 'contact_sender';
  const lateJoiner = 'late_joiner';

  async function seedHistoricalMessages(count, createdAt) {
    const rows = [];
    for (let i = 0; i < count; i++) {
      const suffix = String(i).padStart(2, '0');
      rows.push({
        tenantId,
        dialogId,
        messageId: `msg_bb2222222222222222${suffix}`,
        senderId,
        type: 'internal.text',
        content: `hist ${i}`,
        createdAt
      });
    }
    await Message.insertMany(rows);
  }

  test('5 messages before join, 0 after → unread 0 for late joiner', async () => {
    const historyAt = generateTimestamp();
    const joinAt = historyAt + 1000;

    await DialogMember.insertMany([
      { tenantId, dialogId, userId: senderId, createdAt: historyAt },
      { tenantId, dialogId, userId: lateJoiner, createdAt: joinAt }
    ]);
    await seedHistoricalMessages(5, historyAt);

    expect(await countUserDialogUnread(tenantId, lateJoiner, dialogId)).toBe(0);
  });

  test('2 before join, 1 after (no read) → unread 1', async () => {
    const historyAt = generateTimestamp();
    const joinAt = historyAt + 1000;
    const afterJoinAt = joinAt + 500;

    await DialogMember.insertMany([
      { tenantId, dialogId, userId: senderId, createdAt: historyAt },
      { tenantId, dialogId, userId: lateJoiner, createdAt: joinAt }
    ]);
    await seedHistoricalMessages(2, historyAt);
    await Message.insertMany([
      {
        tenantId,
        dialogId,
        messageId: 'msg_cc333333333333333333',
        senderId,
        type: 'internal.text',
        content: 'after',
        createdAt: afterJoinAt
      }
    ]);

    expect(await countUserDialogUnread(tenantId, lateJoiner, dialogId)).toBe(1);
  });

  test('no DialogMember → unread 0', async () => {
    await seedHistoricalMessages(3, generateTimestamp());
    expect(await countUserDialogUnread(tenantId, 'ghost', dialogId)).toBe(0);
    expect(await recalculateUserDialogUnread(tenantId, 'ghost', dialogId)).toBe(0);
  });

  test('message at same timestamp as join counts as unread', async () => {
    const joinAt = generateTimestamp();

    await DialogMember.insertMany([
      { tenantId, dialogId, userId: senderId, createdAt: joinAt - 5000 },
      { tenantId, dialogId, userId: lateJoiner, createdAt: joinAt }
    ]);
    await Message.insertMany([
      {
        tenantId,
        dialogId,
        messageId: 'msg_dd444444444444444444',
        senderId,
        type: 'internal.text',
        content: 'at join',
        createdAt: joinAt
      }
    ]);

    expect(await countUserDialogUnread(tenantId, lateJoiner, dialogId)).toBe(1);
  });

  test('message before join timestamp is excluded', async () => {
    const joinAt = generateTimestamp();

    await DialogMember.insertMany([
      { tenantId, dialogId, userId: senderId, createdAt: joinAt - 5000 },
      { tenantId, dialogId, userId: lateJoiner, createdAt: joinAt }
    ]);
    await Message.insertMany([
      {
        tenantId,
        dialogId,
        messageId: 'msg_ee555555555555555555',
        senderId,
        type: 'internal.text',
        content: 'before',
        createdAt: joinAt - 1
      }
    ]);

    expect(await countUserDialogUnread(tenantId, lateJoiner, dialogId)).toBe(0);
  });

  test('founding member: messages at and after DialogMember.createdAt all count', async () => {
    const joinAt = generateTimestamp();

    await DialogMember.insertMany([
      { tenantId, dialogId, userId: senderId, createdAt: joinAt },
      { tenantId, dialogId, userId: lateJoiner, createdAt: joinAt }
    ]);
    await Message.insertMany([
      {
        tenantId,
        dialogId,
        messageId: 'msg_ff666666666666666666',
        senderId,
        type: 'internal.text',
        content: '0',
        createdAt: joinAt
      },
      {
        tenantId,
        dialogId,
        messageId: 'msg_gg777777777777777777',
        senderId,
        type: 'internal.text',
        content: '1',
        createdAt: joinAt + 1
      },
      {
        tenantId,
        dialogId,
        messageId: 'msg_hh888888888888888888',
        senderId,
        type: 'internal.text',
        content: '2',
        createdAt: joinAt + 2
      }
    ]);

    expect(await countUserDialogUnread(tenantId, lateJoiner, dialogId)).toBe(3);
  });
});
