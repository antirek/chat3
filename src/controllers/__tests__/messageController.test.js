import messageController from '../messageController.js';
import { Dialog, DialogMember, Message, Meta, MessageStatus, Tenant, User } from '../../models/index.js';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '../../utils/timestampUtils.js';

const tenantId = 'tnt_test';

const createMockReq = (query = {}) => ({
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

function generateDialogId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateMessageId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'msg_';
  for (let i = 0; i < 20; i++) {
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
    name: 'Test Tenant',
    domain: 'test.chat3.com',
    type: 'client',
    isActive: true,
    createdAt: generateTimestamp()
  });

  await User.create({
    tenantId,
    userId: 'alice',
    name: 'Alice',
    createdAt: generateTimestamp(),
    lastActiveAt: generateTimestamp()
  });

  await User.create({
    tenantId,
    userId: 'bob',
    name: 'Bob',
    createdAt: generateTimestamp(),
    lastActiveAt: generateTimestamp()
  });

  await Meta.create([
    { tenantId, entityType: 'user', entityId: 'alice', key: 'role', value: 'manager', dataType: 'string' },
    { tenantId, entityType: 'user', entityId: 'bob', key: 'role', value: 'agent', dataType: 'string' }
  ]);
});

describe('messageController.getAll - filter combinations', () => {
  let dialog;
  let message1;
  let message2;
  let message3;

  beforeEach(async () => {
    dialog = await Dialog.create({
      tenantId,
      dialogId: generateDialogId(),
      name: 'Test Dialog',
      createdBy: 'alice',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });

    const baseTimestamp = generateTimestamp();

    message1 = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'alice',
      content: 'Email update',
      type: 'internal.text',
      createdAt: baseTimestamp,
      updatedAt: baseTimestamp
    });

    message2 = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'bob',
      content: 'Support update',
      type: 'internal.text',
      createdAt: baseTimestamp + 1000,
      updatedAt: baseTimestamp + 1000
    });

    message3 = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'alice',
      content: 'Internal note',
      type: 'internal.text',
      createdAt: baseTimestamp + 2000,
      updatedAt: baseTimestamp + 2000
    });

    await Meta.create([
      { tenantId, entityType: 'message', entityId: message1.messageId, key: 'channel', value: 'email', dataType: 'string' },
      { tenantId, entityType: 'message', entityId: message1.messageId, key: 'category', value: 'sales', dataType: 'string' },
      { tenantId, entityType: 'message', entityId: message2.messageId, key: 'channel', value: 'chat', dataType: 'string' },
      { tenantId, entityType: 'message', entityId: message3.messageId, key: 'channel', value: 'email', dataType: 'string' }
    ]);

    await MessageStatus.create([
      { tenantId, messageId: message1.messageId, userId: 'bob', status: 'read', createdAt: generateTimestamp(), updatedAt: generateTimestamp() },
      { tenantId, messageId: message2.messageId, userId: 'alice', status: 'delivered', createdAt: generateTimestamp(), updatedAt: generateTimestamp() },
      { tenantId, messageId: message3.messageId, userId: 'bob', status: 'unread', createdAt: generateTimestamp(), updatedAt: generateTimestamp() }
    ]);
  });

  test('returns messages filtered by senderId', async () => {
    const req = createMockReq({ filter: '(senderId,eq,alice)', page: 1, limit: 10 });
    const res = createMockRes();

    await messageController.getAll(req, res);

    expect(res.statusCode).toBeUndefined();
    const ids = res.body.data.map((m) => m.messageId);
    expect(ids).toContain(message1.messageId);
    expect(ids).toContain(message3.messageId);
    expect(ids).not.toContain(message2.messageId);

    res.body.data.forEach((message) => {
      expect(message).toHaveProperty('senderInfo');
      if (message.senderId === 'alice') {
        expect(message.senderInfo).toEqual(expect.objectContaining({
          userId: 'alice',
          meta: expect.objectContaining({ role: 'manager' })
        }));
      }
    });
  });

  test('returns messages filtered by meta channel', async () => {
    const req = createMockReq({ filter: '(meta.channel,eq,email)', page: 1, limit: 10 });
    const res = createMockRes();

    await messageController.getAll(req, res);

    const ids = res.body.data.map((m) => m.messageId);
    expect(ids).toContain(message1.messageId);
    expect(ids).toContain(message3.messageId);
    expect(ids).not.toContain(message2.messageId);

    res.body.data.forEach((message) => {
      expect(message).toHaveProperty('senderInfo');
      if (message.senderId === 'alice') {
        expect(message.senderInfo?.userId).toBe('alice');
      }
    });
  });

  test('returns messages filtered by sender AND meta', async () => {
    const req = createMockReq({ filter: '(senderId,eq,alice)&(meta.category,eq,sales)', page: 1, limit: 10 });
    const res = createMockRes();

    await messageController.getAll(req, res);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].messageId).toBe(message1.messageId);
  });

  test('returns all messages when filter parsing fails', async () => {
    const req = createMockReq({ filter: '(senderId,invalid_operator,alice)', page: 1, limit: 10 });
    const res = createMockRes();

    await messageController.getAll(req, res);

    expect(res.body.data).toHaveLength(3);
    res.body.data.forEach((message) => {
      expect(message.senderInfo?.userId).toBe(message.senderId);
    });
  });

  test('supports sorting by createdAt asc', async () => {
    const req = createMockReq({ sort: '(createdAt,asc)', page: 1, limit: 10 });
    const res = createMockRes();

    await messageController.getAll(req, res);

    const returnedIds = res.body.data.map((m) => m.messageId);
    // createdAt values increase in order message1, message2, message3 because of creation sequence
    expect(returnedIds[0]).toBe(message1.messageId);
    expect(returnedIds[returnedIds.length - 1]).toBe(message3.messageId);
  });
});

describe('messageController.createMessage - unread handling', () => {
  let dialog;

  const createRequest = (body) => ({
    tenantId,
    params: { dialogId: dialog.dialogId },
    body
  });

  const createResponse = () => createMockRes();

  beforeEach(async () => {
    dialog = await Dialog.create({
      tenantId,
      dialogId: generateDialogId(),
      name: 'Another Dialog',
      createdBy: 'alice',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });

    await DialogMember.create([
      {
        tenantId,
        dialogId: dialog.dialogId,
        userId: 'alice',
        unreadCount: 0,
        lastSeenAt: generateTimestamp(),
        lastMessageAt: generateTimestamp()
      },
      {
        tenantId,
        dialogId: dialog.dialogId,
        userId: 'bob',
        unreadCount: 0,
        lastSeenAt: generateTimestamp(),
        lastMessageAt: generateTimestamp()
      }
    ]);
  });

  test('internal.text message increments unreadCount and creates statuses', async () => {
    const req = createRequest({
      content: 'Hello Bob',
      senderId: 'alice',
      type: 'internal.text'
    });
    const res = createResponse();

    await messageController.createMessage(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data?.senderInfo).toEqual(expect.objectContaining({ userId: 'alice' }));
    const message = await Message.findOne({ tenantId, senderId: 'alice', type: 'internal.text' }).lean();
    expect(message).toBeTruthy();

    const bobMember = await DialogMember.findOne({ tenantId, dialogId: dialog.dialogId, userId: 'bob' }).lean();
    expect(bobMember?.unreadCount).toBe(1);

    const statuses = await MessageStatus.find({ tenantId, messageId: message.messageId }).lean();
    expect(statuses).toHaveLength(1);
    expect(statuses[0].userId).toBe('bob');
  });

  test('system.* message does not increment unreadCount or create statuses', async () => {
    const req = createRequest({
      content: 'System maintenance window',
      senderId: 'alice',
      type: 'system.text'
    });
    const res = createResponse();

    await messageController.createMessage(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data?.senderInfo).toEqual(expect.objectContaining({ userId: 'alice' }));
    const message = await Message.findOne({ tenantId, type: 'system.text' }).lean();
    expect(message).toBeTruthy();

    const bobMember = await DialogMember.findOne({ tenantId, dialogId: dialog.dialogId, userId: 'bob' }).lean();
    expect(bobMember?.unreadCount).toBe(0);

    const statuses = await MessageStatus.find({ tenantId, messageId: message.messageId }).lean();
    expect(statuses).toHaveLength(0);
  });
});

describe('messageController.updateMessageContent', () => {
  let dialog;
  let message;

  const createRequest = (body = {}) => ({
    tenantId,
    params: { messageId: message.messageId },
    body,
    apiKey: { name: 'test-key' }
  });

  const createResponse = () => createMockRes();

  beforeEach(async () => {
    dialog = await Dialog.create({
      tenantId,
      dialogId: generateDialogId(),
      name: 'Dialog for update',
      createdBy: 'alice',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });

    message = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'alice',
      content: 'Original content',
      type: 'internal.text',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });
  });

  test('updates only content and keeps other fields unchanged', async () => {
    const req = createRequest({ content: 'Updated content' });
    const res = createResponse();

    await messageController.updateMessageContent(req, res);

    expect(res.body.data.content).toBe('Updated content');
    expect(res.body.data.meta).toEqual(expect.objectContaining({ updated: true }));

    const updated = await Message.findOne({ tenantId, messageId: message.messageId }).lean();
    expect(updated.content).toBe('Updated content');
    expect(updated.senderId).toBe(message.senderId);
    expect(updated.type).toBe(message.type);

    const metaRecords = await Meta.find({
      tenantId,
      entityType: 'message',
      entityId: message.messageId
    }).lean();

    const updatedMeta = metaRecords.reduce((acc, m) => {
      acc[m.key] = m.value;
      return acc;
    }, {});

    expect(updatedMeta.updated).toBe(true);
  });

  test('returns 400 when clearing content of internal.text message', async () => {
    const req = createRequest({ content: '   ' });
    const res = createResponse();

    await messageController.updateMessageContent(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
  });
});
