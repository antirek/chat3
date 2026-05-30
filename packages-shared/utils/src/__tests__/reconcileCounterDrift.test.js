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
  Pack,
  PackLink,
  UserDialogStats,
  UserDialogUnreadBySenderType,
  UserPackedMessagesUnreadBySenderType,
  UserStats
} from '@chat3/models';
import { processCounterEvent } from '../counterProcessor/processCounterEvent.js';
import { reconcileCounterDrift } from '../counterProcessor/reconcileCounterDrift.js';
import { generateTimestamp } from '../timestampUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('reconcileCounterDrift', () => {
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

  test('ok when counters match expected values', async () => {
    const tenantId = 'tnt_drift_ok';
    const dialogId = 'dlg_ff666666666666666666';
    const senderId = 'alice';
    const readerId = 'bob';
    const messageId = 'msg_gg777777777777777777';
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

    await processCounterEvent({
      eventId: 'evt_f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1',
      tenantId,
      eventType: 'message.create',
      entityType: 'message',
      entityId: messageId,
      data: {
        context: { dialogId, messageId },
        message: { messageId, dialogId, senderId, type: 'internal.text' }
      }
    });

    await UserStats.create({
      tenantId,
      userId: readerId,
      dialogCount: 1,
      unreadDialogsCount: 1,
      totalUnreadCount: 1,
      totalMessagesCount: 0,
      createdAt: now
    });

    const result = await reconcileCounterDrift({ tenantId, maxUserDialogs: 50 });
    expect(result.ok).toBe(true);
    expect(result.driftCount).toBe(0);
    expect(result.checkedUserDialogs).toBeGreaterThan(0);
  });

  test('detects UserDialogStats unread drift', async () => {
    const tenantId = 'tnt_drift_bad';
    const dialogId = 'dlg_hh888888888888888888';
    const readerId = 'bob';
    const now = generateTimestamp();

    await UserDialogStats.create({
      tenantId,
      dialogId,
      userId: readerId,
      unreadCount: 99,
      createdAt: now
    });

    const result = await reconcileCounterDrift({ tenantId, maxUserDialogs: 10 });
    expect(result.ok).toBe(false);
    expect(result.driftCount).toBeGreaterThan(0);
    expect(result.drifts.some((d) => d.kind === 'userDialogUnread')).toBe(true);
  });

  test('detects MessageStatusStats drift', async () => {
    const tenantId = 'tnt_status_drift';
    const messageId = 'msg_ii999999999999999999';
    const now = generateTimestamp();

    await MessageStatus.create({
      tenantId,
      dialogId: 'dlg_jjaaaaaaaaaaaaaaaaaa',
      messageId,
      userId: 'bob',
      status: 'read',
      createdAt: now
    });
    await MessageStatusStats.create({
      tenantId,
      messageId,
      status: 'read',
      count: 5,
      createdAt: now
    });

    const result = await reconcileCounterDrift({ tenantId, maxMessages: 10 });
    expect(result.ok).toBe(false);
    expect(result.drifts.some((d) => d.kind === 'messageStatusStats')).toBe(true);
  });

  test('detects UserPackedMessagesUnreadBySenderType drift', async () => {
    const tenantId = 'tnt_packed_drift';
    const userId = 'bob';
    const dialogId = 'dlg_kkbbbbbbbbbbbbbbbbbb';
    const packId = 'pck_llcccccccccccccccccc';
    const now = generateTimestamp();

    await DialogMember.create({ tenantId, dialogId, userId, createdAt: now });
    await Pack.create({ tenantId, packId, createdAt: now });
    await PackLink.create({ tenantId, packId, dialogId, addedAt: now });
    await UserDialogUnreadBySenderType.create({
      tenantId, userId, dialogId, fromType: 'user', countUnread: 3, createdAt: now
    });
    await UserStats.create({
      tenantId,
      userId,
      dialogCount: 1,
      unreadDialogsCount: 1,
      totalUnreadCount: 3,
      totalMessagesCount: 0,
      createdAt: now
    });
    await UserPackedMessagesUnreadBySenderType.create({
      tenantId, userId, fromType: 'user', countUnread: 99, createdAt: now
    });

    const result = await reconcileCounterDrift({ tenantId, maxUsers: 10 });
    expect(result.ok).toBe(false);
    expect(result.drifts.some((d) => d.kind === 'userStatsPackedTotalUnread')).toBe(true);
  });

  test('golden fixture message.create yields expected unread', async () => {
    const fixture = JSON.parse(
      readFileSync(join(__dirname, 'fixtures/events/message.create.json'), 'utf8')
    );
    const { tenantId, data } = fixture;
    const dialogId = data.context.dialogId;
    const messageId = data.context.messageId;
    const senderId = data.message.senderId;
    const readerId = 'carol';
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
      content: 'fixture',
      createdAt: now
    });

    await processCounterEvent(fixture);

    const stats = await UserDialogStats.findOne({ tenantId, userId: readerId, dialogId }).lean();
    expect(stats?.unreadCount).toBe(1);

    const drift = await reconcileCounterDrift({ tenantId, maxUserDialogs: 10 });
    expect(drift.ok).toBe(true);
  });
});
