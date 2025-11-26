import messageStatusController from '../messageStatusController.js';
import {
  Dialog,
  DialogMember,
  Event,
  Message,
  MessageStatus,
  Tenant
} from "../../../../models/index.js";
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '../../../../utils/timestampUtils.js';

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

const createMockReq = ({ params = {} } = {}) => ({
  tenantId,
  params
});

const generateDialogId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateMessageId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'msg_';
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

describe('messageStatusController.updateMessageStatus', () => {
  let dialog;
  let message;

  beforeEach(async () => {
    await clearDatabase();

    await Tenant.create({
      tenantId,
      name: 'Test Tenant',
      domain: 'tenant.example.com',
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

    message = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'alice',
      content: 'Hello team!',
      type: 'internal.text',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });
  });

  test('creates message status and emits event', async () => {
    const req = createMockReq({
      params: {
        messageId: message.messageId,
        userId: 'bob',
        status: 'delivered'
      }
    });
    const res = createMockRes();

    await messageStatusController.updateMessageStatus(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body?.data?.status).toBe('delivered');

    const statusDoc = await MessageStatus.findOne({ tenantId, messageId: message.messageId, userId: 'bob' }).lean();
    expect(statusDoc).toBeTruthy();
    expect(statusDoc.status).toBe('delivered');

    const event = await Event.findOne({ tenantId, eventType: 'message.status.create' }).lean();
    expect(event).toBeTruthy();
    expect(event.entityId).toBe(message.messageId);
    expect(event.data.context).toMatchObject({
      eventType: 'message.status.create',
      dialogId: dialog.dialogId,
      entityId: message.messageId
    });
    expect(event.data.message).toBeDefined();
    expect(event.data.message.statusUpdate).toMatchObject({
      userId: 'bob',
      status: 'delivered',
      oldStatus: null
    });
  });

  test('updates existing status to read and decrements unread count', async () => {
    await MessageStatus.create({
      tenantId,
      messageId: message.messageId,
      userId: 'bob',
      status: 'delivered',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });

    await DialogMember.create({
      tenantId,
      dialogId: dialog.dialogId,
      userId: 'bob',
      unreadCount: 2,
      lastSeenAt: generateTimestamp(),
      lastMessageAt: generateTimestamp(),
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });

    const req = createMockReq({
      params: {
        messageId: message.messageId,
        userId: 'bob',
        status: 'read'
      }
    });
    const res = createMockRes();

    await messageStatusController.updateMessageStatus(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body?.data?.status).toBe('read');

    const statusDoc = await MessageStatus.findOne({ tenantId, messageId: message.messageId, userId: 'bob' }).lean();
    expect(statusDoc.status).toBe('read');

    const dialogMember = await DialogMember.findOne({ tenantId, dialogId: dialog.dialogId, userId: 'bob' }).lean();
    expect(dialogMember.unreadCount).toBe(1);

    const statusEvent = await Event.findOne({ tenantId, eventType: 'message.status.update' }).lean();
    expect(statusEvent).toBeTruthy();
    expect(statusEvent.data.message.statusUpdate.oldStatus).toBe('delivered');
    expect(statusEvent.data.message.statusUpdate.status).toBe('read');

    const memberEvent = await Event.findOne({ tenantId, eventType: 'dialog.member.update' }).lean();
    expect(memberEvent).toBeTruthy();
    expect(memberEvent.entityId).toBe(dialog.dialogId);
    expect(memberEvent.data.member).toMatchObject({
      userId: 'bob'
    });
    expect(memberEvent.data.member.state.unreadCount).toBe(1);
    expect(memberEvent.data.member.state.lastSeenAt).toBeDefined();
  });

  test('returns 400 for invalid status', async () => {
    const req = createMockReq({
      params: {
        messageId: message.messageId,
        userId: 'bob',
        status: 'invalid'
      }
    });
    const res = createMockRes();

    await messageStatusController.updateMessageStatus(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: 'Bad Request',
      message: 'Invalid status. Must be one of: unread, delivered, read'
    });
  });

  test('returns 404 when message not found', async () => {
    const req = createMockReq({
      params: {
        messageId: 'msg_missing',
        userId: 'bob',
        status: 'delivered'
      }
    });
    const res = createMockRes();

    await messageStatusController.updateMessageStatus(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found', message: 'Message not found' });
  });
});
