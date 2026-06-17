import mongoose from 'mongoose';
import { Tenant, DialogReadTask, Dialog, DialogMember, Message, MessageStatus, UserDialogStats, OutboxEvent } from '@chat3/models';
import { scheduleDialogReadTask, runDialogReadTask, markDialogMessagesAsReadUntil } from '../dialogReadTaskUtils.js';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from '@chat3/tenant-api/src/utils/__tests__/setup.js';
import { flushCounterEvents } from '@chat3/tenant-api/src/utils/__tests__/counterTestHelpers.js';
import { generateTimestamp } from '../timestampUtils.js';

const tenantId = 'tnt_test';

function generateDialogId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateMessageId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'msg_';
  for (let i = 0; i < 20; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

beforeEach(async () => {
  await clearDatabase();

  await Tenant.create({
    tenantId,
    name: 'Test tenant',
    domain: 'test.chat3.com',
    type: 'client',
    isActive: true,
    createdAt: generateTimestamp()
  });
});

describe('dialogReadTaskUtils', () => {
  describe('scheduleDialogReadTask', () => {
    test('creates new pending task', async () => {
      const dialogId = generateDialogId();
      const task = await scheduleDialogReadTask({
        tenantId,
        dialogId,
        userId: 'alice',
        readUntil: 123
      });

      expect(task).toBeTruthy();
      expect(task.status).toBe('pending');
      expect(task.readUntil).toBe(123);
      expect(task.requestCount).toBe(1);
    });

    test('upserts existing task and extends readUntil', async () => {
      const dialogId = generateDialogId();

      const initial = await DialogReadTask.create({
        tenantId,
        dialogId,
        userId: 'alice',
        readUntil: 100,
        status: 'pending'
      });

      const updated = await scheduleDialogReadTask({
        tenantId,
        dialogId,
        userId: 'alice',
        readUntil: 200
      });

      expect(updated._id.toString()).toBe(initial._id.toString());
      expect(updated.readUntil).toBe(200);
      expect(updated.requestCount).toBe(2);
    });
  });

  describe('runDialogReadTask', () => {
    test('marks messages as read for dialog', async () => {
      const dialogId = generateDialogId();

      await Dialog.create({
        tenantId,
        dialogId,
        
        createdBy: 'system',
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      });

      await DialogMember.create({
        tenantId,
        dialogId,
        userId: 'agent',
        unreadCount: 3,
        createdAt: generateTimestamp(),
        lastSeenAt: generateTimestamp()
      });

      const messages = [];
      for (let i = 0; i < 5; i += 1) {
        messages.push({
          tenantId,
          dialogId,
          messageId: generateMessageId(),
          senderId: i === 0 ? 'agent' : 'customer',
          content: `msg ${i}`,
          type: 'internal.text',
          createdAt: generateTimestamp(),
          updatedAt: generateTimestamp()
        });
      }
      await Message.insertMany(messages);

      const task = await DialogReadTask.create({
        tenantId,
        dialogId,
        userId: 'agent',
        readUntil: Number.MAX_SAFE_INTEGER,
        status: 'running',
        startedAt: generateTimestamp()
      });

      await runDialogReadTask(task, { batchSize: 2 });

      const statuses = await MessageStatus.find({
        tenantId,
        userId: 'agent'
      }).lean();

      // Первое сообщение пропускается, потому что отправлено самим агентом
      expect(statuses).toHaveLength(4);
      statuses.forEach((statusDoc) => {
        expect(statusDoc.status).toBe('read');
      });

      const reloadedTask = await DialogReadTask.findById(task._id).lean();
      expect(reloadedTask.status).toBe('completed');
      expect(reloadedTask.processedCount).toBe(4);
      expect(reloadedTask.finishedAt).toBeDefined();
    });
  });

  describe('markDialogMessagesAsReadUntil', () => {
    test('эмитит bulk_read при drift stats (unreadCount>0, нет чужих сообщений для обработки)', async () => {
      const dialogId = generateDialogId();
      const userId = 'agent';
      const now = generateTimestamp();

      await Dialog.create({
        tenantId,
        dialogId,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now
      });

      await DialogMember.create({
        tenantId,
        dialogId,
        userId,
        unreadCount: 1,
        createdAt: now,
        lastSeenAt: now
      });

      await UserDialogStats.create({
        tenantId,
        dialogId,
        userId,
        unreadCount: 1,
        lastMessageAt: now,
        updatedAt: now
      });

      const result = await markDialogMessagesAsReadUntil(
        tenantId,
        dialogId,
        userId,
        Number.MAX_SAFE_INTEGER
      );

      expect(result.processedCount).toBe(0);
      expect(result.bulkReadEventId).toBeTruthy();

      const bulkReadOutbox = await OutboxEvent.findOne({
        tenantId,
        eventType: 'dialog.messages.bulk_read',
        entityId: `${dialogId}:${userId}`
      }).lean();
      expect(bulkReadOutbox).toBeTruthy();

      await flushCounterEvents();

      const stats = await UserDialogStats.findOne({ tenantId, userId, dialogId }).lean();
      expect(stats?.unreadCount).toBe(0);
    });

    test('не эмитит bulk_read если unreadCount=0 и processedCount=0', async () => {
      const dialogId = generateDialogId();
      const userId = 'agent';
      const now = generateTimestamp();

      await Dialog.create({
        tenantId,
        dialogId,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now
      });

      await DialogMember.create({
        tenantId,
        dialogId,
        userId,
        unreadCount: 0,
        createdAt: now,
        lastSeenAt: now
      });

      await UserDialogStats.create({
        tenantId,
        dialogId,
        userId,
        unreadCount: 0,
        updatedAt: now
      });

      const result = await markDialogMessagesAsReadUntil(
        tenantId,
        dialogId,
        userId,
        Number.MAX_SAFE_INTEGER
      );

      expect(result.processedCount).toBe(0);
      expect(result.bulkReadEventId).toBeNull();

      const bulkReadOutbox = await OutboxEvent.countDocuments({
        tenantId,
        eventType: 'dialog.messages.bulk_read'
      });
      expect(bulkReadOutbox).toBe(0);
    });
  });
});
