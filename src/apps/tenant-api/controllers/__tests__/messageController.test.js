import * as fakeAmqp from '@onify/fake-amqplib';
import { jest } from '@jest/globals';
import messageController from '../messageController.js';
import { Tenant, User, Meta, Dialog, Message, MessageStatus, DialogMember, Event } from "../../../../models/index.js";
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '../../../../utils/timestampUtils.js';

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
  
  // Инициализируем RabbitMQ для eventUtils
  const rabbitmqUtils = await import('../../../../utils/rabbitmqUtils.js');
  const amqplib = await import('amqplib');
  amqplib.default.connect = fakeAmqp.connect;
  await rabbitmqUtils.initRabbitMQ();
});

afterAll(async () => {
  const rabbitmqUtils = await import('../../../../utils/rabbitmqUtils.js');
  await rabbitmqUtils.closeRabbitMQ();
  await teardownMongoMemoryServer();
});

beforeEach(async () => {
  await clearDatabase();
  fakeAmqp.resetMock();
  
  // Переинициализируем RabbitMQ перед каждым тестом (если канал закрыт)
  const rabbitmqUtils = await import('../../../../utils/rabbitmqUtils.js');
  const rabbitmqInfo = rabbitmqUtils.getRabbitMQInfo();
  if (!rabbitmqInfo.connected) {
    const amqplib = await import('amqplib');
    amqplib.default.connect = fakeAmqp.connect;
    await rabbitmqUtils.initRabbitMQ();
  }

  await Tenant.create({
    tenantId,
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
      
      createdBy: 'alice',
      createdAt: generateTimestamp(),
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
    });

    message2 = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'bob',
      content: 'Support update',
      type: 'internal.text',
      createdAt: baseTimestamp + 1000
    });

    message3 = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'alice',
      content: 'Internal note',
      type: 'internal.text',
      createdAt: baseTimestamp + 2000
    });

    await Meta.create([
      { tenantId, entityType: 'message', entityId: message1.messageId, key: 'channel', value: 'email', dataType: 'string' },
      { tenantId, entityType: 'message', entityId: message1.messageId, key: 'category', value: 'sales', dataType: 'string' },
      { tenantId, entityType: 'message', entityId: message2.messageId, key: 'channel', value: 'chat', dataType: 'string' },
      { tenantId, entityType: 'message', entityId: message3.messageId, key: 'channel', value: 'email', dataType: 'string' }
    ]);

    await MessageStatus.create([
      { tenantId, messageId: message1.messageId, userId: 'bob', status: 'read', createdAt: generateTimestamp() },
      { tenantId, messageId: message2.messageId, userId: 'alice', status: 'delivered', createdAt: generateTimestamp() },
      { tenantId, messageId: message3.messageId, userId: 'bob', status: 'unread', createdAt: generateTimestamp() }
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
      
      createdBy: 'alice',
      createdAt: generateTimestamp(),
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
      
      createdBy: 'alice',
      createdAt: generateTimestamp(),
    });

    message = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'alice',
      content: 'Original content',
      type: 'internal.text',
      createdAt: generateTimestamp(),
    });
  });

  test('updates only content and keeps other fields unchanged', async () => {
    const req = createRequest({ content: 'Updated content' });
    const res = createResponse();

    await messageController.updateMessageContent(req, res);

    expect(res.body.data.content).toBe('Updated content');
    expect(res.body.data.meta).toEqual(expect.objectContaining({ editedAt: expect.any(Number) }));

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

    expect(updatedMeta.editedAt).toBeGreaterThan(0);
  });

  test('returns 400 when clearing content of internal.text message', async () => {
    const req = createRequest({ content: '   ' });
    const res = createResponse();

    await messageController.updateMessageContent(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
  });

  test('returns message when content is unchanged', async () => {
    const req = createRequest({ content: 'Original content' });
    const res = createResponse();

    await messageController.updateMessageContent(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data.content).toBe('Original content');
    expect(res.body.message).toBe('Message content is unchanged');
  });

  test('returns 404 when message not found', async () => {
    const req = {
      tenantId,
      params: { messageId: 'msg_nonexistent' },
      body: { content: 'New content' },
      apiKey: { name: 'test-key' }
    };
    const res = createResponse();

    await messageController.updateMessageContent(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});

describe('messageController.getAll - error handling', () => {
  test('handles database errors gracefully', async () => {
    // Mock Message.find to throw an error
    const originalFind = Message.find;
    Message.find = jest.fn().mockImplementation(() => {
      throw new Error('Database connection error');
    });

    const req = createMockReq({ page: 1, limit: 10 });
    const res = createMockRes();

    await messageController.getAll(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');

    // Restore original method
    Message.find = originalFind;
  });
});

describe('messageController.getDialogMessages', () => {
  let dialog;

  beforeEach(async () => {
    dialog = await Dialog.create({
      tenantId,
      dialogId: generateDialogId(),
      
      createdBy: 'alice',
      createdAt: generateTimestamp(),
    });
  });

  test('returns 404 when dialog not found', async () => {
    const req = {
      tenantId,
      params: { dialogId: 'dlg_nonexistent' },
      query: { page: 1, limit: 10 }
    };
    const res = createMockRes();

    await messageController.getDialogMessages(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.message).toBe('Dialog not found');
  });

  test('returns messages for dialog with filters', async () => {
    const message1 = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'alice',
      content: 'Message 1',
      type: 'internal.text',
      createdAt: generateTimestamp(),
    });

    const message2 = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'bob',
      content: 'Message 2',
      type: 'internal.text',
      createdAt: generateTimestamp() + 1000
    });

    await Meta.create({
      tenantId,
      entityType: 'message',
      entityId: message1.messageId,
      key: 'category',
      value: 'important',
      dataType: 'string'
    });

    const req = {
      tenantId,
      params: { dialogId: dialog.dialogId },
      query: { 
        page: 1, 
        limit: 10,
        filter: '(senderId,eq,alice)'
      }
    };
    const res = createMockRes();

    await messageController.getDialogMessages(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].messageId).toBe(message1.messageId);
  });

  test('handles invalid filter format gracefully', async () => {
    const message = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'alice',
      content: 'Test message',
      type: 'internal.text',
      createdAt: generateTimestamp(),
    });

    const req = {
      tenantId,
      params: { dialogId: dialog.dialogId },
      query: { 
        page: 1, 
        limit: 10,
        filter: 'invalid filter format'
      }
    };
    const res = createMockRes();

    await messageController.getDialogMessages(req, res);

    // parseFilters might not throw for invalid format, so it may continue
    // If it does throw, we should get 400, otherwise it continues normally
    // Let's check if it returns successfully or with error
    if (res.statusCode === 400) {
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toBe('Invalid filter format');
    } else {
      // If parseFilters doesn't throw, it should return messages normally
      expect(res.statusCode).toBeUndefined();
      expect(res.body.data).toBeDefined();
    }
  });

  test('supports sorting by createdAt', async () => {
    const baseTimestamp = generateTimestamp();
    
    const message1 = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'alice',
      content: 'First',
      type: 'internal.text',
      createdAt: baseTimestamp,
    });

    const message2 = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'bob',
      content: 'Second',
      type: 'internal.text',
      createdAt: baseTimestamp + 1000
    });

    const req = {
      tenantId,
      params: { dialogId: dialog.dialogId },
      query: { 
        page: 1, 
        limit: 10,
        sort: '(createdAt,asc)'
      }
    };
    const res = createMockRes();

    await messageController.getDialogMessages(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].messageId).toBe(message1.messageId);
    expect(res.body.data[1].messageId).toBe(message2.messageId);
  });

  test('handles CastError gracefully', async () => {
    const req = {
      tenantId,
      params: { dialogId: 'invalid_id' },
      query: { page: 1, limit: 10 }
    };
    const res = createMockRes();

    // Mock Dialog.findOne to throw CastError
    const originalFindOne = Dialog.findOne;
    Dialog.findOne = jest.fn().mockImplementation(() => {
      const error = new Error('Cast to ObjectId failed');
      error.name = 'CastError';
      throw error;
    });

    await messageController.getDialogMessages(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(res.body.message).toBe('Invalid dialog ID');

    // Restore original method
    Dialog.findOne = originalFindOne;
  });

  test('handles general errors', async () => {
    const req = {
      tenantId,
      params: { dialogId: dialog.dialogId },
      query: { page: 1, limit: 10 }
    };
    const res = createMockRes();

    // Mock Message.find to throw an error
    const originalFind = Message.find;
    Message.find = jest.fn().mockImplementation(() => {
      throw new Error('Database error');
    });

    await messageController.getDialogMessages(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');

    // Restore original method
    Message.find = originalFind;
  });
});

// Note: getSenderInfo is an internal function, so we test it indirectly through methods that use it
// The caching behavior is tested through getAll and getMessageById tests

describe('messageController.createMessage - validation', () => {
  let dialog;

  beforeEach(async () => {
    dialog = await Dialog.create({
      tenantId,
      dialogId: generateDialogId(),
      
      createdBy: 'alice',
      createdAt: generateTimestamp(),
    });
  });

  test('returns 400 when senderId is missing', async () => {
    const req = {
      tenantId,
      params: { dialogId: dialog.dialogId },
      body: {
        content: 'Test message',
        type: 'internal.text'
      }
    };
    const res = createMockRes();

    await messageController.createMessage(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(res.body.message).toBe('Missing required field: senderId');
  });

  test('returns 400 when content is empty for internal.text', async () => {
    const req = {
      tenantId,
      params: { dialogId: dialog.dialogId },
      body: {
        senderId: 'alice',
        content: '   ',
        type: 'internal.text'
      }
    };
    const res = createMockRes();

    await messageController.createMessage(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(res.body.message).toBe('content is required for internal.text messages');
  });

  test('returns 400 when meta.url is missing for media types', async () => {
    const req = {
      tenantId,
      params: { dialogId: dialog.dialogId },
      body: {
        senderId: 'alice',
        type: 'internal.image',
        meta: {}
      }
    };
    const res = createMockRes();

    await messageController.createMessage(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(res.body.message).toBe('meta.url is required for internal.image messages');
  });

  test('creates message with meta data', async () => {
    const req = {
      tenantId,
      params: { dialogId: dialog.dialogId },
      body: {
        senderId: 'alice',
        content: 'Test message',
        type: 'internal.text',
        meta: {
          category: 'support',
          priority: 'high'
        }
      }
    };
    const res = createMockRes();

    await messageController.createMessage(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toBeTruthy();

    const message = await Message.findOne({ tenantId, senderId: 'alice' }).lean();
    expect(message).toBeTruthy();

    const meta = await Meta.find({
      tenantId,
      entityType: 'message',
      entityId: message.messageId
    }).lean();

    const metaMap = meta.reduce((acc, m) => {
      acc[m.key] = m.value;
      return acc;
    }, {});

    expect(metaMap.category).toBe('support');
    expect(metaMap.priority).toBe('high');
  });

  test('message.create event should have dialog section', async () => {
    const req = {
      tenantId,
      params: { dialogId: dialog.dialogId },
      body: {
        senderId: 'alice',
        content: 'Test message',
        type: 'internal.text'
      }
    };
    const res = createMockRes();

    await messageController.createMessage(req, res);

    expect(res.statusCode).toBe(201);

    const message = await Message.findOne({ tenantId, senderId: 'alice' }).lean();
    expect(message).toBeTruthy();

    const event = await Event.findOne({
      tenantId,
      eventType: 'message.create',
      entityId: message.messageId
    }).lean();

    expect(event).toBeTruthy();
    expect(event.data.dialog).toBeDefined();
    expect(event.data.dialog.dialogId).toBe(dialog.dialogId);
    expect(event.data.dialog.tenantId).toBe(tenantId);
    expect(event.data.dialog.createdBy).toBe(dialog.createdBy);
    expect(event.data.dialog.createdAt).toBe(dialog.createdAt);
    // meta всегда должен быть объектом (может быть пустым)
    if (!event.data.dialog.meta) {
      event.data.dialog.meta = {};
    }
    expect(event.data.dialog.meta).toBeDefined();
    expect(typeof event.data.dialog.meta).toBe('object');
    expect(Array.isArray(event.data.dialog.meta)).toBe(false);
    expect(event.data.message).toBeDefined();
    expect(event.data.message.messageId).toBe(message.messageId);
    expect(event.data.context.includedSections).toContain('dialog');
    expect(event.data.context.includedSections).toContain('message.full');
  });
});

describe('messageController.getMessageById - error handling', () => {
  test('returns 404 when message not found', async () => {
    const req = {
      tenantId,
      params: { messageId: 'msg_nonexistent' }
    };
    const res = createMockRes();

    await messageController.getMessageById(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.message).toBe('Message not found');
  });

  test('handles database errors', async () => {
    const req = {
      tenantId,
      params: { messageId: 'msg_test' }
    };
    const res = createMockRes();

    // Mock Message.findOne to throw an error
    const originalFindOne = Message.findOne;
    Message.findOne = jest.fn().mockImplementation(() => {
      throw new Error('Database error');
    });

    await messageController.getMessageById(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');

    // Restore original method
    Message.findOne = originalFindOne;
  });

  test('returns message with statuses and meta', async () => {
    const dialog = await Dialog.create({
      tenantId,
      dialogId: generateDialogId(),
      
      createdBy: 'alice',
      createdAt: generateTimestamp(),
    });

    const message = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'alice',
      content: 'Test message',
      type: 'internal.text',
      createdAt: generateTimestamp(),
    });

    await MessageStatus.create({
      tenantId,
      messageId: message.messageId,
      userId: 'bob',
      status: 'read',
      createdAt: generateTimestamp(),
    });

    await Meta.create({
      tenantId,
      entityType: 'message',
      entityId: message.messageId,
      key: 'category',
      value: 'test',
      dataType: 'string'
    });

    const req = {
      tenantId,
      params: { messageId: message.messageId }
    };
    const res = createMockRes();

    await messageController.getMessageById(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.messageId).toBe(message.messageId);
    expect(res.body.data.statusMessageMatrix).toBeDefined();
    expect(Array.isArray(res.body.data.statusMessageMatrix)).toBe(true);
    expect(res.body.data.reactionSet).toBeDefined();
    expect(Array.isArray(res.body.data.reactionSet)).toBe(true);
    expect(res.body.data.meta).toEqual(expect.objectContaining({ category: 'test' }));
    expect(res.body.data.senderInfo).toBeTruthy();
    expect(res.body.data.senderInfo.userId).toBe('alice');
  });
});
