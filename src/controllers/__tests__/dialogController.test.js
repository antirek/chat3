import { dialogController } from '../dialogController.js';
import { Dialog, DialogMember, Meta, Tenant, User, Event } from '../../models/index.js';
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

const createMockReq = (tenantId, query = {}, params = {}, body = {}, apiKey = { name: 'test-key' }) => ({
  tenantId,
  query,
  params,
  body,
  apiKey
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
    res.body.data.forEach((dialog) => {
      expect(dialog).toHaveProperty('memberCount');
      expect(typeof dialog.memberCount).toBe('number');
    });
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

  test('filters dialogs by dialogId (regular filter)', async () => {
    const req = createMockReq(tenantId, { filter: `(dialogId,eq,${dialogA.dialogId})`, page: 1, limit: 10 });
    const res = createMockRes();

    await dialogController.getAll(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].dialogId).toBe(dialogA.dialogId);
    expect(res.body.pagination.total).toBe(1);
  });

  test('filters dialogs by dialogId returns empty when not found', async () => {
    const req = createMockReq(tenantId, { filter: '(dialogId,eq,dlg_nonexistent123456789)', page: 1, limit: 10 });
    const res = createMockRes();

    await dialogController.getAll(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });

  test('filters dialogs by dialogId combined with meta filter', async () => {
    // dialogA имеет meta.department = 'sales'
    // Фильтр должен найти только dialogA, так как он единственный с department=sales и указанным dialogId
    const req = createMockReq(tenantId, { 
      filter: `(meta.department,eq,sales)&(dialogId,eq,${dialogA.dialogId})`, 
      page: 1, 
      limit: 10 
    });
    const res = createMockRes();

    await dialogController.getAll(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].dialogId).toBe(dialogA.dialogId);
  });

  test('filters dialogs by dialogId combined with meta filter returns empty when no intersection', async () => {
    // dialogC имеет meta.department = 'engineering'
    // Фильтр по department=sales и dialogId=dialogC должен вернуть пустой результат
    const req = createMockReq(tenantId, { 
      filter: `(meta.department,eq,sales)&(dialogId,eq,${dialogC.dialogId})`, 
      page: 1, 
      limit: 10 
    });
    const res = createMockRes();

    await dialogController.getAll(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });
});

describe('dialogController.getAll - sorting modes', () => {
  let dialogOne;
  let dialogTwo;

  beforeEach(async () => {
    await clearDatabase();

    await Tenant.create({
      tenantId,
      name: 'Sorting Tenant',
      domain: 'sorting.chat3.com',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });

    dialogOne = await Dialog.create({
      dialogId: generateDialogId(),
      tenantId,
      createdBy: 'carl',
      name: 'First dialog',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });

    dialogTwo = await Dialog.create({
      dialogId: generateDialogId(),
      tenantId,
      createdBy: 'carl',
      name: 'Second dialog',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp() + 1000
    });

    await DialogMember.create([
      { tenantId, dialogId: dialogOne.dialogId, userId: 'alice', unreadCount: 2, isActive: true },
      { tenantId, dialogId: dialogTwo.dialogId, userId: 'alice', unreadCount: 5, isActive: true }
    ]);
  });

  test('sorts by dialog updatedAt when requested', async () => {
    const req = createMockReq(tenantId, { sort: '(updatedAt,desc)', page: 1, limit: 10 });
    const res = createMockRes();

    await dialogController.getAll(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data[0].dialogId).toBe(dialogTwo.dialogId);
    expect(res.body.data[1].dialogId).toBe(dialogOne.dialogId);
  });

  test('sorts by specific member field when using member sort expression', async () => {
    const req = createMockReq(tenantId, { sort: '(member[alice].unreadCount,desc)', page: 1, limit: 10 });
    const res = createMockRes();

    await dialogController.getAll(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data[0].dialogId).toBe(dialogTwo.dialogId);
    expect(res.body.data[1].dialogId).toBe(dialogOne.dialogId);
  });
});

describe('dialogController.getById', () => {
  let dialog;

  beforeEach(async () => {
    await clearDatabase();

    await Tenant.create({
      tenantId,
      name: 'Tenant',
      domain: 'tenant.chat3.com',
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

    dialog = await Dialog.create({
      dialogId: generateDialogId(),
      tenantId,
      createdBy: 'carl',
      name: 'Customer Support',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });

    await DialogMember.create([
      {
        tenantId,
        dialogId: dialog.dialogId,
        userId: 'alice',
        unreadCount: 3,
        lastSeenAt: generateTimestamp(),
        lastMessageAt: generateTimestamp(),
        isActive: true
      }
    ]);

    await Meta.create([
      { tenantId, entityType: 'dialog', entityId: dialog.dialogId, key: 'priority', value: 'high', dataType: 'string' },
      { tenantId, entityType: 'dialogMember', entityId: `${dialog.dialogId}:alice`, key: 'role', value: 'agent', dataType: 'string' }
    ]);
  });

  test('returns dialog with meta without eagerly loading members', async () => {
    const req = createMockReq(tenantId, {}, { id: dialog.dialogId });
    const res = createMockRes();

    await dialogController.getById(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data.dialogId).toBe(dialog.dialogId);
    expect(res.body.data.meta).toEqual({ priority: 'high' });
    expect(res.body.data.memberCount).toBe(1);
    expect(res.body.data.members).toBeUndefined();
  });

  test('returns 404 when dialog missing', async () => {
    const req = createMockReq(tenantId, {}, { id: generateDialogId() });
    const res = createMockRes();

    await dialogController.getById(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});

describe('dialogController.create', () => {
  beforeEach(async () => {
    await clearDatabase();

    await Tenant.create({
      tenantId,
      name: 'Tenant',
      domain: 'tenant.chat3.com',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });
  });

  test('creates dialog and emits event', async () => {
    const req = createMockReq(
      tenantId,
      {},
      {},
      {
        name: 'New Dialog',
        createdBy: 'carl'
      }
    );
    const res = createMockRes();

    await dialogController.create(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('Dialog created successfully');
    expect(res.body.data.name).toBe('New Dialog');

    const storedDialog = await Dialog.findOne({ tenantId, name: 'New Dialog' }).lean();
    expect(storedDialog).toBeTruthy();

    const event = await Event.findOne({ tenantId, eventType: 'dialog.create' }).lean();
    expect(event).toBeTruthy();
    expect(event.entityId).toBe(storedDialog.dialogId);
    expect(event.data.dialog).toMatchObject({
      dialogId: storedDialog.dialogId,
      name: 'New Dialog'
    });
  });

  test('creates dialog with meta tags', async () => {
    const req = createMockReq(
      tenantId,
      {},
      {},
      {
        name: 'Dialog with Meta',
        createdBy: 'carl',
        meta: {
          department: 'sales',
          priority: 5,
          channel: 'telegram'
        }
      }
    );
    const res = createMockRes();

    await dialogController.create(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('Dialog created successfully');
    expect(res.body.data.name).toBe('Dialog with Meta');
    expect(res.body.data.meta).toBeDefined();
    expect(res.body.data.meta.department).toBe('sales');
    expect(res.body.data.meta.priority).toBe(5);
    expect(res.body.data.meta.channel).toBe('telegram');

    // Проверяем, что мета-теги сохранены в базе
    const storedDialog = await Dialog.findOne({ tenantId, name: 'Dialog with Meta' }).lean();
    expect(storedDialog).toBeTruthy();

    const metaRecords = await Meta.find({
      tenantId,
      entityType: 'dialog',
      entityId: storedDialog.dialogId
    }).lean();

    expect(metaRecords).toHaveLength(3);
    const metaMap = {};
    metaRecords.forEach(m => {
      metaMap[m.key] = m.value;
    });
    expect(metaMap.department).toBe('sales');
    expect(metaMap.priority).toBe(5);
    expect(metaMap.channel).toBe('telegram');
  });

  test('creates dialog with members array', async () => {
    const req = createMockReq(
      tenantId,
      {},
      {},
      {
        name: 'Dialog with Members',
        createdBy: 'carl',
        members: [
          { userId: 'alice', type: 'user', name: 'Alice Smith' },
          { userId: 'bob', type: 'bot', name: 'Bob Bot' }
        ]
      }
    );
    const res = createMockRes();

    await dialogController.create(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('Dialog created successfully');

    const storedDialog = await Dialog.findOne({ tenantId, name: 'Dialog with Members' }).lean();
    expect(storedDialog).toBeTruthy();

    // Проверяем, что пользователи созданы
    const alice = await User.findOne({ tenantId, userId: 'alice' }).lean();
    expect(alice).toBeTruthy();
    expect(alice.type).toBe('user');
    expect(alice.name).toBe('Alice Smith');

    const bob = await User.findOne({ tenantId, userId: 'bob' }).lean();
    expect(bob).toBeTruthy();
    expect(bob.type).toBe('bot');
    expect(bob.name).toBe('Bob Bot');

    // Проверяем, что участники добавлены в диалог
    const members = await DialogMember.find({ tenantId, dialogId: storedDialog.dialogId }).lean();
    expect(members).toHaveLength(2);
    expect(members.map(m => m.userId)).toContain('alice');
    expect(members.map(m => m.userId)).toContain('bob');
  });

  test('creates dialog with members, updates existing users', async () => {
    // Создаем существующего пользователя
    await User.create({
      tenantId,
      userId: 'existing',
      type: 'user',
      name: 'Old Name',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });

    const req = createMockReq(
      tenantId,
      {},
      {},
      {
        name: 'Dialog with Existing User',
        createdBy: 'carl',
        members: [
          { userId: 'existing', type: 'bot', name: 'New Name' }
        ]
      }
    );
    const res = createMockRes();

    await dialogController.create(req, res);

    expect(res.statusCode).toBe(201);

    // Проверяем, что пользователь обновлен
    const user = await User.findOne({ tenantId, userId: 'existing' }).lean();
    expect(user.type).toBe('bot');
    expect(user.name).toBe('New Name');
  });

  test('returns 400 when required fields missing', async () => {
    const req = createMockReq(tenantId, {}, {}, {});
    const res = createMockRes();

    await dialogController.create(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('Missing required fields');
  });
});

describe('dialogController.delete', () => {
  let dialog;

  beforeEach(async () => {
    await clearDatabase();

    await Tenant.create({
      tenantId,
      name: 'Tenant',
      domain: 'tenant.chat3.com',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });

    dialog = await Dialog.create({
      dialogId: generateDialogId(),
      tenantId,
      createdBy: 'carl',
      name: 'To be deleted',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });

    // Meta is stored using dialogId in production, but controller deletes by _id
    await Meta.create({
      tenantId,
      entityType: 'dialog',
      entityId: dialog._id.toString(),
      key: 'status',
      value: 'archived',
      dataType: 'string'
    });
  });

  test('deletes dialog, removes meta and emits event', async () => {
    const req = createMockReq(
      tenantId,
      {},
      { id: dialog._id.toString() },
      {},
      { name: 'api-key' }
    );
    const res = createMockRes();

    await dialogController.delete(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.message).toBe('Dialog deleted successfully');

    const storedDialog = await Dialog.findById(dialog._id);
    expect(storedDialog).toBeNull();

    const remainingMeta = await Meta.findOne({ entityType: 'dialog', entityId: dialog._id.toString() }).lean();
    expect(remainingMeta).toBeNull();

    const event = await Event.findOne({ tenantId, eventType: 'dialog.delete' }).lean();
    expect(event).toBeTruthy();
    expect(event.entityId).toBe(dialog.dialogId);
  });

  test('returns 404 when dialog not found', async () => {
    const req = createMockReq(tenantId, {}, { id: '64fa1cca6f9b1a2b3c4d5e6f' });
    const res = createMockRes();

    await dialogController.delete(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });

  test('returns 400 for invalid id', async () => {
    const req = createMockReq(tenantId, {}, { id: 'invalid-id' });
    const res = createMockRes();

    await dialogController.delete(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
  });
});
