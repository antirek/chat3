import dialogMemberController from '../dialogMemberController.js';
import { Dialog, DialogMember, Event, Tenant } from '../../models/index.js';
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

const createMockReq = (params = {}) => ({
  tenantId,
  params,
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
      expect(event.entityId).toBe(`${dialog.dialogId}:alice`);
      expect(event.actorId).toBe('test-key');
      expect(event.data).toEqual({ userId: 'alice', dialogId: dialog.dialogId });
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
      expect(event.entityId).toBe(`${dialog.dialogId}:alice`);
      expect(event.data.userId).toBe('alice');
      expect(event.data.dialogId).toBe(dialog.dialogId);
      expect(event.data.removedMember).toBeDefined();
      expect(event.data.removedMember.userId).toBe('alice');
      expect(event.data.removedMember.unreadCount).toBe(2);
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
});
