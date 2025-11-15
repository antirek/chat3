import dialogMemberController from '../dialogMemberController.js';
import { Dialog, DialogMember, Event, Meta, Tenant, DialogReadTask } from '../../models/index.js';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '../../utils/timestampUtils.js';

const tenantId = 'tnt_test';

const createMockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

const createMockReq = (params = {}, body = {}) => ({
  tenantId,
  params,
  body,
  apiKey: { name: 'test-key' }
});

const generateDialogId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('dialogMemberController', () => {
  let dialog;

  beforeEach(async () => {
    await clearDatabase();

    await Tenant.create({
      tenantId,
      name: 'Test Tenant',
      domain: 'test.chat3.com',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });

    dialog = await Dialog.create({
      tenantId,
      dialogId: generateDialogId(),
      name: 'Support Chat',
      createdBy: 'owner',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });
  });

  describe('getDialogMembers', () => {
    beforeEach(async () => {
      await DialogMember.create([
        {
          tenantId,
          dialogId: dialog.dialogId,
          userId: 'alice',
          role: 'agent',
          isActive: true,
          unreadCount: 3,
          joinedAt: generateTimestamp(),
          lastSeenAt: generateTimestamp(),
          lastMessageAt: generateTimestamp()
        },
        {
          tenantId,
          dialogId: dialog.dialogId,
          userId: 'bob',
          role: 'supervisor',
          isActive: false,
          unreadCount: 0,
          joinedAt: generateTimestamp(),
          lastSeenAt: generateTimestamp(),
          lastMessageAt: generateTimestamp()
        },
        {
          tenantId,
          dialogId: dialog.dialogId,
          userId: 'carol',
          role: 'agent',
          isActive: true,
          unreadCount: 1,
          joinedAt: generateTimestamp(),
          lastSeenAt: generateTimestamp(),
          lastMessageAt: generateTimestamp()
        }
      ]);

      await Meta.create([
        { tenantId, entityType: 'dialogMember', entityId: `${dialog.dialogId}:alice`, key: 'shift', value: 'day', dataType: 'string' },
        { tenantId, entityType: 'dialogMember', entityId: `${dialog.dialogId}:bob`, key: 'shift', value: 'night', dataType: 'string' },
        { tenantId, entityType: 'dialogMember', entityId: `${dialog.dialogId}:carol`, key: 'shift', value: 'day', dataType: 'string' },
        { tenantId, entityType: 'dialogMember', entityId: `${dialog.dialogId}:alice`, key: 'skills', value: 'sales', dataType: 'string' }
      ]);
    });

    const createMembersReq = (query = {}) => ({
      tenantId,
      params: { dialogId: dialog.dialogId },
      query,
    });

    test('returns paginated members with meta data', async () => {
      const req = createMembersReq({ page: 1, limit: 2 });
      const res = createMockRes();

      await dialogMemberController.getDialogMembers(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.pages).toBe(2);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('meta');
    });

    test('filters members by meta fields', async () => {
      const req = createMembersReq({ filter: '(meta.shift,eq,day)' });
      const res = createMockRes();

      await dialogMemberController.getDialogMembers(req, res);

      expect(res.body.pagination.total).toBe(2);
      const userIds = res.body.data.map((member) => member.userId);
      expect(userIds.sort()).toEqual(['alice', 'carol']);
    });

    test('returns 404 when dialog is missing', async () => {
      const req = {
        tenantId,
        params: { dialogId: generateDialogId() },
        query: {}
      };
      const res = createMockRes();

      await dialogMemberController.getDialogMembers(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  describe('addDialogMember', () => {
    test('adds member and creates event', async () => {
      const req = createMockReq({ dialogId: dialog.dialogId, userId: 'alice' });
      const res = createMockRes();

      await dialogMemberController.addDialogMember(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body).toBeDefined();
      expect(res.body.data).toEqual({ dialogId: dialog.dialogId, userId: 'alice' });

      const member = await DialogMember.findOne({ tenantId, dialogId: dialog.dialogId, userId: 'alice' }).lean();
      expect(member).toBeTruthy();
      expect(member.unreadCount).toBe(0);

      const event = await Event.findOne({ tenantId, eventType: 'dialog.member.add' }).lean();
      expect(event).toBeTruthy();
      expect(event.entityType).toBe('dialogMember');
      expect(event.entityId).toBe(dialog.dialogId);
      expect(event.actorId).toBe('test-key');
      expect(event.data.context).toMatchObject({
        eventType: 'dialog.member.add',
        dialogId: dialog.dialogId,
        entityId: dialog.dialogId
      });
      expect(event.data.member).toMatchObject({
        userId: 'alice'
      });
      expect(event.data.dialog.dialogId).toBe(dialog.dialogId);
    });

    test('returns 404 if dialog not found', async () => {
      const req = createMockReq({ dialogId: 'dlg_missing', userId: 'alice' });
      const res = createMockRes();

      await dialogMemberController.addDialogMember(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Not Found', message: 'Dialog not found' });

      const memberCount = await DialogMember.countDocuments({ tenantId }).lean();
      expect(memberCount).toBe(0);
    });
  });

  describe('removeDialogMember', () => {
    test('removes member and creates event with details', async () => {
      await DialogMember.create({
        tenantId,
        dialogId: dialog.dialogId,
        userId: 'alice',
        role: 'member',
        isActive: true,
        unreadCount: 2,
        joinedAt: generateTimestamp(),
        lastSeenAt: generateTimestamp(),
        createdAt: generateTimestamp()
      });

      const req = createMockReq({ dialogId: dialog.dialogId, userId: 'alice' });
      const res = createMockRes();

      await dialogMemberController.removeDialogMember(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toEqual({ message: 'Member removed from dialog successfully' });

      const member = await DialogMember.findOne({ tenantId, dialogId: dialog.dialogId, userId: 'alice' }).lean();
      expect(member).toBeNull();

      const event = await Event.findOne({ tenantId, eventType: 'dialog.member.remove' }).lean();
      expect(event).toBeTruthy();
      expect(event.entityId).toBe(dialog.dialogId);
      expect(event.data.context).toMatchObject({
        eventType: 'dialog.member.remove',
        dialogId: dialog.dialogId
      });
      expect(event.data.member).toBeDefined();
      expect(event.data.member.userId).toBe('alice');
      expect(event.data.member.state.unreadCount).toBe(2);
    });

    test('returns 404 when dialog not found', async () => {
      const req = createMockReq({ dialogId: 'dlg_missing', userId: 'alice' });
      const res = createMockRes();

      await dialogMemberController.removeDialogMember(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Not Found', message: 'Dialog not found' });
    });

    test('succeeds without event when member missing', async () => {
      const req = createMockReq({ dialogId: dialog.dialogId, userId: 'ghost' });
      const res = createMockRes();

      await dialogMemberController.removeDialogMember(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toEqual({ message: 'Member removed from dialog successfully' });

      const eventCount = await Event.countDocuments({ tenantId }).lean();
      expect(eventCount).toBe(0);
    });
  });

  describe('setUnreadCount', () => {
    beforeEach(async () => {
      await DialogMember.create({
        tenantId,
        dialogId: dialog.dialogId,
        userId: 'alice',
        role: 'agent',
        isActive: true,
        unreadCount: 5,
        joinedAt: generateTimestamp(),
        lastSeenAt: generateTimestamp(),
        createdAt: generateTimestamp()
      });
    });

    test('updates unread count and creates event', async () => {
      const req = createMockReq(
        { dialogId: dialog.dialogId, userId: 'alice' },
        { unreadCount: 0, reason: 'external-sync' }
      );
      req.apiKey = { name: 'sync-service' };

      const res = createMockRes();

      await dialogMemberController.setUnreadCount(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body.data.unreadCount).toBe(0);
      expect(res.body.message).toBe('Unread count updated successfully');

      const member = await DialogMember.findOne({ tenantId, dialogId: dialog.dialogId, userId: 'alice' }).lean();
      expect(member.unreadCount).toBe(0);

      const event = await Event.findOne({ tenantId, eventType: 'dialog.member.update' }).lean();
      expect(event).toBeTruthy();
      expect(event.actorId).toBe('sync-service');
      expect(event.data.member.state.unreadCount).toBe(0);
      expect(event.data.dialog.dialogId).toBe(dialog.dialogId);

      const task = await DialogReadTask.findOne({ tenantId, dialogId: dialog.dialogId, userId: 'alice' }).lean();
      expect(task).toBeTruthy();
      expect(task.status).toBe('pending');
      expect(task.readUntil).toBeGreaterThan(0);
    });

    test('rejects unread count greater than current', async () => {
      const req = createMockReq(
        { dialogId: dialog.dialogId, userId: 'alice' },
        { unreadCount: 10 }
      );
      const res = createMockRes();

      await dialogMemberController.setUnreadCount(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toMatch(/greater than current/i);
    });
  });
});
