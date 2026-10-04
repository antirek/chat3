import {
  bulkCreateMessages,
  normalizeToUnixTimestampMicroseconds
} from '@chat3/app-services';
import {
  Dialog,
  DialogMember,
  DialogStats,
  Event,
  Message,
  MessageStatus,
  Tenant,
  User,
  UserDialogActivity,
  UserStats
} from '@chat3/models';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../../../../packages/tenant-api/src/utils/__tests__/setup.js';

const tenantId = 'tnt_bulk';
const dialogId = 'dlg_bulkcreatedialog0001';

describe('normalizeToUnixTimestampMicroseconds', () => {
  test('keeps ms and adds order index for equal sentAt', () => {
    const a = normalizeToUnixTimestampMicroseconds(1730891234567, 0);
    const b = normalizeToUnixTimestampMicroseconds(1730891234567, 1);
    expect(Math.trunc(a)).toBe(1730891234567);
    expect(Math.trunc(b)).toBe(1730891234568);
    expect(b).toBeGreaterThan(a);
  });

  test('converts seconds to ms', () => {
    const ts = normalizeToUnixTimestampMicroseconds(1730891234, 0);
    expect(Math.trunc(ts)).toBe(1730891234000);
  });
});

describe('bulkCreateMessages', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
    const now = generateTimestamp();
    await Tenant.create({
      tenantId,
      name: 'Tenant',
      domain: 'bulk.chat3.dev',
      type: 'client',
      isActive: true,
      createdAt: now
    });
    await Dialog.create({
      tenantId,
      dialogId,
      createdBy: 'alice',
      createdAt: now
    });
    await User.create({ tenantId, userId: 'alice', name: 'Alice', type: 'user', createdAt: now });
    await User.create({ tenantId, userId: 'bob', name: 'Bob', type: 'contact', createdAt: now });
    await DialogMember.create({
      tenantId,
      dialogId,
      userId: 'alice',
      unreadCount: 0,
      isActive: true,
      lastSeenAt: now,
      lastMessageAt: now,
      createdAt: now
    });
    await DialogMember.create({
      tenantId,
      dialogId,
      userId: 'bob',
      unreadCount: 0,
      isActive: true,
      lastSeenAt: now,
      lastMessageAt: now,
      createdAt: now
    });
  });

  test('creates historical messages without events and unread statuses', async () => {
    const sentAt = 1700000000000;
    const result = await bulkCreateMessages({
      tenantId,
      dialogId,
      messages: [
        {
          senderId: 'bob',
          content: 'hello',
          sentAt,
          status: 'delivered',
          meta: { externalId: 'ext-1' }
        },
        {
          senderId: 'alice',
          content: 'reply',
          sentAt: sentAt + 1000,
          meta: { externalId: 'ext-2', sentFromPhone: true }
        }
      ]
    });

    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe('created');
    expect(result.results[1].status).toBe('created');

    const messages = await Message.find({ tenantId, dialogId }).sort({ createdAt: 1 }).lean();
    expect(messages).toHaveLength(2);
    expect(Math.trunc(messages[0].createdAt)).toBe(sentAt);
    expect(messages[1].createdAt).toBeGreaterThan(messages[0].createdAt);

    expect(await Event.countDocuments({ tenantId })).toBe(0);
    expect(await MessageStatus.countDocuments({ tenantId, status: 'unread' })).toBe(0);
    expect(await MessageStatus.countDocuments({ tenantId, status: 'delivered' })).toBe(1);

    const dialogStats = await DialogStats.findOne({ tenantId, dialogId }).lean();
    expect(dialogStats.messageCount).toBe(2);
    const bobStats = await UserStats.findOne({ tenantId, userId: 'bob' }).lean();
    expect(bobStats.totalMessagesCount).toBe(1);
  });

  test('duplicate externalId does not create second message or bump counters twice', async () => {
    const payload = {
      tenantId,
      dialogId,
      messages: [
        {
          senderId: 'bob',
          content: 'one',
          sentAt: 1700000001000,
          meta: { externalId: 'same-ext' }
        }
      ]
    };
    const first = await bulkCreateMessages(payload);
    expect(first.results[0].status).toBe('created');

    const second = await bulkCreateMessages(payload);
    expect(second.results[0].status).toBe('duplicate');
    expect(second.results[0].messageId).toBe(first.results[0].messageId);

    expect(await Message.countDocuments({ tenantId, dialogId })).toBe(1);
    const dialogStats = await DialogStats.findOne({ tenantId, dialogId }).lean();
    expect(dialogStats.messageCount).toBe(1);
  });

  test('lastMessageAt moves only forward', async () => {
    const recent = 1800000000000;
    await UserDialogActivity.create({
      tenantId,
      userId: 'alice',
      dialogId,
      lastMessageAt: recent,
      lastSeenAt: 0
    });

    await bulkCreateMessages({
      tenantId,
      dialogId,
      messages: [
        {
          senderId: 'bob',
          content: 'old',
          sentAt: 1700000000000,
          meta: { externalId: 'old-1' }
        }
      ]
    });

    const activity = await UserDialogActivity.findOne({
      tenantId,
      userId: 'alice',
      dialogId
    }).lean();
    expect(activity.lastMessageAt).toBe(recent);
  });

  test('rejects more than 50 messages', async () => {
    const messages = Array.from({ length: 51 }, (_, i) => ({
      senderId: 'bob',
      content: `m${i}`,
      sentAt: 1700000000000 + i,
      meta: { externalId: `e-${i}` }
    }));
    await expect(
      bulkCreateMessages({ tenantId, dialogId, messages })
    ).rejects.toMatchObject({ message: expect.stringContaining('<= 50') });
  });
});
