import { dialogController } from '../dialogController.js';
import { Dialog, DialogMember, Meta, Tenant, User } from '../../models/index.js';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '../../utils/timestampUtils.js';

function generateDialogId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const createMockReq = (tenantId, query = {}) => ({
  tenantId,
  query
});

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

const tenantId = 'tnt_test';
const users = ['carl', 'alice', 'bob', 'marta'];

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
    name: 'Test Tenant',
    domain: 'test.chat3.com',
    type: 'client',
    isActive: true,
    createdAt: generateTimestamp()
  });

  await User.create(
    users.map((userId) => ({
      tenantId,
      userId,
      name: userId.toUpperCase(),
      lastActiveAt: generateTimestamp(),
      createdAt: generateTimestamp()
    }))
  );
});

describe('dialogController.getAll - filter combinations', () => {
  let dialogA;
  let dialogB;
  let dialogC;
  let dialogD;

  beforeEach(async () => {
    dialogA = await Dialog.create({
      dialogId: generateDialogId(),
      tenantId,
      createdBy: 'carl',
      name: 'Sales Daily',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });

    dialogB = await Dialog.create({
      dialogId: generateDialogId(),
      tenantId,
      createdBy: 'carl',
      name: 'Sales Weekly',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });

    dialogC = await Dialog.create({
      dialogId: generateDialogId(),
      tenantId,
      createdBy: 'carl',
      name: 'Engineering',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });

    dialogD = await Dialog.create({
      dialogId: generateDialogId(),
      tenantId,
      createdBy: 'carl',
      name: 'Support',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });

    await DialogMember.create([
      { tenantId, dialogId: dialogA.dialogId, userId: 'carl', isActive: true, unreadCount: 0 },
      { tenantId, dialogId: dialogA.dialogId, userId: 'alice', isActive: true, unreadCount: 0 },
      { tenantId, dialogId: dialogA.dialogId, userId: 'bob', isActive: true, unreadCount: 0 },

      { tenantId, dialogId: dialogB.dialogId, userId: 'carl', isActive: true, unreadCount: 0 },
      { tenantId, dialogId: dialogB.dialogId, userId: 'alice', isActive: true, unreadCount: 0 },
      { tenantId, dialogId: dialogB.dialogId, userId: 'marta', isActive: true, unreadCount: 0 },

      { tenantId, dialogId: dialogC.dialogId, userId: 'carl', isActive: true, unreadCount: 0 },
      { tenantId, dialogId: dialogC.dialogId, userId: 'bob', isActive: true, unreadCount: 0 },

      { tenantId, dialogId: dialogD.dialogId, userId: 'carl', isActive: true, unreadCount: 0 },
      { tenantId, dialogId: dialogD.dialogId, userId: 'marta', isActive: true, unreadCount: 0 }
    ]);

    await Meta.create([
      { tenantId, entityType: 'dialog', entityId: dialogA.dialogId, key: 'department', value: 'sales', dataType: 'string' },
      { tenantId, entityType: 'dialog', entityId: dialogA.dialogId, key: 'priority', value: 'high', dataType: 'string' },
      { tenantId, entityType: 'dialog', entityId: dialogB.dialogId, key: 'department', value: 'sales', dataType: 'string' },
      { tenantId, entityType: 'dialog', entityId: dialogB.dialogId, key: 'priority', value: 'medium', dataType: 'string' },
      { tenantId, entityType: 'dialog', entityId: dialogC.dialogId, key: 'department', value: 'engineering', dataType: 'string' },
      { tenantId, entityType: 'dialog', entityId: dialogD.dialogId, key: 'department', value: 'support', dataType: 'string' }
    ]);
  });

  test('returns all dialogs without filters', async () => {
    const req = createMockReq(tenantId, { page: 1, limit: 10 });
    const res = createMockRes();

    await dialogController.getAll(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(4);
  });

  test('filters dialogs by meta tag eq', async () => {
    const req = createMockReq(tenantId, { filter: '(meta.department,eq,sales)', page: 1, limit: 10 });
    const res = createMockRes();

    await dialogController.getAll(req, res);

    const ids = res.body.data.map((d) => d.dialogId);
    expect(ids).toContain(dialogA.dialogId);
    expect(ids).toContain(dialogB.dialogId);
    expect(ids).not.toContain(dialogC.dialogId);
    expect(ids).not.toContain(dialogD.dialogId);
  });

  test('filters dialogs by meta tag ne', async () => {
    const req = createMockReq(tenantId, { filter: '(meta.department,ne,sales)', page: 1, limit: 10 });
    const res = createMockRes();

    await dialogController.getAll(req, res);

    const ids = res.body.data.map((d) => d.dialogId);
    expect(ids).toContain(dialogC.dialogId);
    expect(ids).toContain(dialogD.dialogId);
    expect(ids).not.toContain(dialogA.dialogId);
    expect(ids).not.toContain(dialogB.dialogId);
  });

  test('filters dialogs by member $all (AND)', async () => {
    const req = createMockReq(tenantId, { filter: '(member,all,[alice,bob])', page: 1, limit: 10 });
    const res = createMockRes();

    await dialogController.getAll(req, res);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].dialogId).toBe(dialogA.dialogId);
  });

  test('filters dialogs by meta tag AND member', async () => {
    const req = createMockReq(tenantId, { filter: '(meta.department,eq,sales)&(member,eq,marta)', page: 1, limit: 10 });
    const res = createMockRes();

    await dialogController.getAll(req, res);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].dialogId).toBe(dialogB.dialogId);
  });

  test('returns empty list when filter excludes all dialogs', async () => {
    const req = createMockReq(tenantId, { filter: '(member,eq,unknown)', page: 1, limit: 10 });
    const res = createMockRes();

    await dialogController.getAll(req, res);

    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });

  test('returns 400 for invalid filter format', async () => {
    const req = createMockReq(tenantId, { filter: '(meta.department,unknown_operator,sales)', page: 1, limit: 10 });
    const res = createMockRes();

    await dialogController.getAll(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
  });
});
