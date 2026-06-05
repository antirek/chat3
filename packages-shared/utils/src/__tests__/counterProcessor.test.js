import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import {
  Message,
  MessageStatus,
  MessageStatusStats,
  DialogMember,
  DialogStats,
  ProcessedCounterEvent,
  UserDialogStats,
  UserDialogUnreadBySenderType,
  UserStats
} from '@chat3/models';
import { processCounterEvent, CounterProcessorError } from '../counterProcessor/processCounterEvent.js';
import { generateTimestamp } from '../timestampUtils.js';

describe('counterProcessor', () => {
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

  test('message.create + read updates unread via recalculateSlice', async () => {
    const tenantId = 'tnt_test';
    const dialogId = 'dlg_aa111111111111111111';
    const senderId = 'alice';
    const readerId = 'bob';
    const messageId = 'msg_bb222222222222222222';
    const now = generateTimestamp();

    await DialogMember.insertMany([
      { tenantId, dialogId, userId: senderId, createdAt: now },
      { tenantId, dialogId, userId: readerId, createdAt: now }
    ]);

    await Message.create({
      tenantId,
      dialogId,
      messageId,
      senderId,
      type: 'internal.text',
      content: 'hi',
      createdAt: now
    });

    const createEvent = {
      eventId: 'evt_a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0',
      tenantId,
      eventType: 'message.create',
      entityType: 'message',
      entityId: messageId,
      data: {
        context: { dialogId, messageId },
        message: { messageId, dialogId, senderId, type: 'internal.text' }
      }
    };

    await processCounterEvent(createEvent);

    const { UserDialogStats } = await import('@chat3/models');
    let stats = await UserDialogStats.findOne({ tenantId, userId: readerId, dialogId }).lean();
    expect(stats?.unreadCount).toBe(1);

    await MessageStatus.create({
      tenantId,
      dialogId,
      messageId,
      userId: readerId,
      status: 'unread',
      createdAt: now
    });
    await MessageStatus.create({
      tenantId,
      dialogId,
      messageId,
      userId: readerId,
      status: 'read',
      createdAt: now + 1
    });

    await processCounterEvent({
      eventId: 'evt_b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1',
      tenantId,
      eventType: 'message.status.changed',
      entityType: 'messageStatus',
      entityId: messageId,
      data: {
        context: { dialogId, messageId, userId: readerId },
        message: { messageId, dialogId, statusUpdate: { userId: readerId, status: 'read' } }
      }
    });

    stats = await UserDialogStats.findOne({ tenantId, userId: readerId, dialogId }).lean();
    expect(stats?.unreadCount).toBe(0);

    await processCounterEvent({
      eventId: 'evt_c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2',
      tenantId,
      eventType: 'dialog.messages.bulk_read',
      entityType: 'dialogMember',
      entityId: `${dialogId}:${readerId}`,
      data: {
        context: { dialogId, userId: readerId },
        dialog: { dialogId }
      }
    });

    stats = await UserDialogStats.findOne({ tenantId, userId: readerId, dialogId }).lean();
    expect(stats?.unreadCount).toBe(0);

    const dup = await ProcessedCounterEvent.countDocuments({ tenantId, eventId: 'evt_b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1' });
    expect(dup).toBe(1);

    await processCounterEvent({
      eventId: 'evt_b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1',
      tenantId,
      eventType: 'message.status.changed',
      entityType: 'messageStatus',
      entityId: messageId,
      data: {
        context: { dialogId, messageId, userId: readerId },
        message: { messageId, dialogId }
      }
    });

    stats = await UserDialogStats.findOne({ tenantId, userId: readerId, dialogId }).lean();
    expect(stats?.unreadCount).toBe(0);
  });

  test('dialog.member.remove deletes per-dialog stats for user', async () => {
    const tenantId = 'tnt_test';
    const dialogId = 'dlg_cc333333333333333333';
    const userId = 'leaver';
    const now = generateTimestamp();

    await UserDialogStats.create({
      tenantId,
      dialogId,
      userId,
      unreadCount: 3,
      createdAt: now
    });
    await UserDialogUnreadBySenderType.create({
      tenantId,
      dialogId,
      userId,
      fromType: 'user',
      countUnread: 3,
      createdAt: now
    });

    await processCounterEvent({
      eventId: 'evt_d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3',
      tenantId,
      eventType: 'dialog.member.remove',
      entityType: 'dialogMember',
      entityId: `${dialogId}:${userId}`,
      data: {
        context: { dialogId, userId },
        dialog: { dialogId }
      }
    });

    expect(await UserDialogStats.findOne({ tenantId, userId, dialogId }).lean()).toBeNull();
    expect(await UserDialogUnreadBySenderType.countDocuments({ tenantId, userId, dialogId })).toBe(0);
  });

  test('dialog.member.remove recalculates UserStats and DialogStats.memberCount', async () => {
    const tenantId = 'tnt_test';
    const dialogId = 'dlg_ee666666666666666666';
    const leaver = 'leaver';
    const stayer = 'stayer';
    const now = generateTimestamp();

    await DialogMember.create({
      tenantId,
      dialogId,
      userId: stayer,
      createdAt: now
    });

    await UserStats.create({
      tenantId,
      userId: leaver,
      dialogCount: 2,
      totalUnreadCount: 5,
      unreadDialogsCount: 1,
      totalMessagesCount: 0,
      createdAt: now
    });

    await UserDialogStats.create({
      tenantId,
      dialogId,
      userId: leaver,
      unreadCount: 5,
      createdAt: now
    });

    await UserDialogUnreadBySenderType.create({
      tenantId,
      dialogId,
      userId: leaver,
      fromType: 'user',
      countUnread: 5,
      createdAt: now
    });

    await processCounterEvent({
      eventId: 'evt_e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6',
      tenantId,
      eventType: 'dialog.member.remove',
      entityType: 'dialogMember',
      entityId: `${dialogId}:${leaver}`,
      data: {
        context: { dialogId, userId: leaver },
        dialog: { dialogId }
      }
    });

    const userStats = await UserStats.findOne({ tenantId, userId: leaver }).lean();
    expect(userStats?.totalUnreadCount).toBe(0);
    expect(userStats?.unreadDialogsCount).toBe(0);
    expect(userStats?.dialogCount).toBe(1);

    const dialogStats = await DialogStats.findOne({ tenantId, dialogId }).lean();
    expect(dialogStats?.memberCount).toBe(1);
  });

  test('dialog.member.remove resolves userId from entityId when context omits userId', async () => {
    const tenantId = 'tnt_test';
    const dialogId = 'dlg_ff888888888888888888';
    const userId = 'leaver2';
    const now = generateTimestamp();

    await UserDialogUnreadBySenderType.create({
      tenantId,
      dialogId,
      userId,
      fromType: 'user',
      countUnread: 2,
      createdAt: now
    });

    await processCounterEvent({
      eventId: 'evt_f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8',
      tenantId,
      eventType: 'dialog.member.remove',
      entityType: 'dialogMember',
      entityId: `${dialogId}:${userId}`,
      data: {
        context: { dialogId },
        dialog: { dialogId }
      }
    });

    expect(await UserDialogUnreadBySenderType.countDocuments({ tenantId, userId, dialogId })).toBe(0);
  });

  test('dialog.member.remove rejects payload without userId', async () => {
    await expect(
      processCounterEvent({
        eventId: 'evt_badbadbadbadbadbadbadbadbadba',
        tenantId: 'tnt_test',
        eventType: 'dialog.member.remove',
        entityType: 'dialogMember',
        entityId: 'dlg_only_no_user_suffix',
        data: {
          context: { dialogId: 'dlg_x' },
          dialog: { dialogId: 'dlg_x' }
        }
      })
    ).rejects.toThrow(CounterProcessorError);

    const processed = await ProcessedCounterEvent.countDocuments({
      eventId: 'evt_badbadbadbadbadbadbadbadbadba'
    });
    expect(processed).toBe(0);
  });

  test('message.status.changed recalculates MessageStatusStats from history', async () => {
    const tenantId = 'tnt_test';
    const dialogId = 'dlg_dd444444444444444444';
    const messageId = 'msg_ee555555555555555555';
    const readerId = 'bob';
    const now = generateTimestamp();

    await MessageStatus.insertMany([
      { tenantId, dialogId, messageId, userId: readerId, status: 'unread', createdAt: now },
      { tenantId, dialogId, messageId, userId: readerId, status: 'read', createdAt: now + 1 }
    ]);

    await processCounterEvent({
      eventId: 'evt_e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4',
      tenantId,
      eventType: 'message.status.changed',
      entityType: 'messageStatus',
      entityId: messageId,
      data: {
        context: { dialogId, messageId, userId: readerId },
        message: { messageId, dialogId }
      }
    });

    const unreadRow = await MessageStatusStats.findOne({ tenantId, messageId, status: 'unread' }).lean();
    const readRow = await MessageStatusStats.findOne({ tenantId, messageId, status: 'read' }).lean();
    expect(unreadRow?.count).toBe(1);
    expect(readRow?.count).toBe(1);
  });

  test('logs slice duration on success', async () => {
    const tenantId = 'tnt_log';
    const dialogId = 'dlg_ff777777777777777777';
    const senderId = 'alice';
    const readerId = 'bob';
    const messageId = 'msg_gg888888888888888888';
    const now = generateTimestamp();

    await DialogMember.insertMany([
      { tenantId, dialogId, userId: senderId, createdAt: now },
      { tenantId, dialogId, userId: readerId, createdAt: now }
    ]);
    await Message.create({
      tenantId,
      dialogId,
      messageId,
      senderId,
      type: 'internal.text',
      content: 'hi',
      createdAt: now
    });

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(' '));
    };

    await processCounterEvent({
      eventId: 'evt_f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2',
      tenantId,
      eventType: 'message.create',
      entityType: 'message',
      entityId: messageId,
      data: {
        context: { dialogId, messageId },
        message: { messageId, dialogId, senderId, type: 'internal.text' }
      }
    });

    const okLine = logs.find((line) => line.includes('[counterProcessor] slice ok:'));
    expect(okLine).toBeDefined();
    expect(okLine).toMatch(/eventId=evt_f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2/);
    expect(okLine).toMatch(/dialogId=dlg_ff777777777777777777/);
    expect(okLine).toMatch(/durationMs=\d+(\.\d+)?/);

    console.log = origLog;
  });
});
