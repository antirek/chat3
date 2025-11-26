import mongoose from 'mongoose';
import { Tenant, DialogReadTask, Dialog, DialogMember, Message, MessageStatus } from "../../../../models/index.js";
import { scheduleDialogReadTask, runDialogReadTask } from '../dialogReadTaskUtils.js';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from './setup.js';
import { generateTimestamp } from '../../../../utils/timestampUtils.js';

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
        name: 'Bulk dialog',
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
});

