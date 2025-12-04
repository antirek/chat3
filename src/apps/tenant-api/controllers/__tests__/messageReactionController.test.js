import messageReactionController from '../messageReactionController.js';
import {
  Dialog,
  Event,
  Message,
  MessageReaction,
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

const createMockReq = ({ params = {}, query = {}, body = {}, userId = undefined } = {}) => ({
  tenantId,
  params,
  query,
  body,
  userId
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

describe('messageReactionController', () => {
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
      name: 'General Chat',
      createdBy: 'owner',
      createdAt: generateTimestamp(),
    });

    message = await Message.create({
      tenantId,
      dialogId: dialog.dialogId,
      messageId: generateMessageId(),
      senderId: 'alice',
      content: 'Hello!',
      type: 'internal.text',
      reactionCounts: {},
      createdAt: generateTimestamp(),
    });
  });

  describe('getMessageReactions', () => {
    test('returns reactions and counts', async () => {
      await MessageReaction.create({
        tenantId,
        messageId: message.messageId,
        userId: 'bob',
        reaction: '👍',
        createdAt: generateTimestamp(),
      });
      await MessageReaction.create({
        tenantId,
        messageId: message.messageId,
        userId: 'carol',
        reaction: '❤️',
        createdAt: generateTimestamp(),
      });

      message.reactionCounts = { '👍': 1, '❤️': 1 };
      await message.save();

      const req = createMockReq({ params: { messageId: message.messageId } });
      const res = createMockRes();

      await messageReactionController.getMessageReactions(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body?.data?.reactions).toHaveLength(2);
      expect(res.body?.data?.counts).toEqual({ '👍': 1, '❤️': 1 });
    });

    test('returns 404 when message not found', async () => {
      const req = createMockReq({ params: { messageId: 'msg_missing' } });
      const res = createMockRes();

      await messageReactionController.getMessageReactions(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Not Found', message: 'Message not found' });
    });
  });

  describe('setOrUnsetReaction - set action', () => {
    test('creates new reaction and increments counts', async () => {
      const req = createMockReq({
        params: { messageId: message.messageId, action: 'set', userId: 'bob' },
        body: { reaction: '🔥' }
      });
      const res = createMockRes();

      await messageReactionController.setOrUnsetReaction(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body?.data?.counts).toEqual({ '🔥': 1 });

      const reactionDoc = await MessageReaction.findOne({ tenantId, messageId: message.messageId, userId: 'bob', reaction: '🔥' }).lean();
      expect(reactionDoc).toBeTruthy();
      expect(reactionDoc.reaction).toBe('🔥');

      const updatedMessage = await Message.findOne({ messageId: message.messageId }).lean();
      expect(updatedMessage.reactionCounts).toEqual({ '🔥': 1 });

      const event = await Event.findOne({ tenantId, eventType: 'message.reaction.update' }).lean();
      expect(event).toBeTruthy();
      expect(event.entityId).toBe(message.messageId);
      expect(event.data.message.reactionUpdate).toMatchObject({
        userId: 'bob',
        reaction: '🔥',
        oldReaction: null
      });
      expect(event.data.message.reactionUpdate.reactionSet).toEqual([
        { reaction: '🔥', count: 1, me: true }
      ]);
      
      // Проверяем, что member секция отсутствует, но dialog присутствует
      expect(event.data.member).toBeUndefined();
      expect(event.data.dialog).toBeDefined();
      expect(event.data.dialog.dialogId).toBe(dialog.dialogId);
      expect(event.data.context.includedSections).not.toContain('member');
      expect(event.data.context.includedSections).toContain('dialog');
      expect(event.data.context.includedSections).toContain('message');
    });

    test('returns existing reaction when reaction already exists', async () => {
      const reactionDoc = await MessageReaction.create({
        tenantId,
        messageId: message.messageId,
        userId: 'bob',
        reaction: '👍',
        createdAt: generateTimestamp(),
      });

      const req = createMockReq({
        params: { messageId: message.messageId, action: 'set', userId: 'bob' },
        body: { reaction: '👍' }
      });
      const res = createMockRes();

      await messageReactionController.setOrUnsetReaction(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body?.message).toBe('Reaction already exists');

      const eventsCount = await Event.countDocuments({ tenantId }).lean();
      expect(eventsCount).toBe(0);

      const storedReaction = await MessageReaction.findById(reactionDoc._id).lean();
      expect(storedReaction.reaction).toBe('👍');
    });

    test('allows multiple different reactions from same user', async () => {
      await MessageReaction.create({
        tenantId,
        messageId: message.messageId,
        userId: 'bob',
        reaction: '👍',
        createdAt: generateTimestamp(),
      });
      message.reactionCounts = { '👍': 1 };
      await message.save();

      const req = createMockReq({
        params: { messageId: message.messageId, action: 'set', userId: 'bob' },
        body: { reaction: '❤️' }
      });
      const res = createMockRes();

      await messageReactionController.setOrUnsetReaction(req, res);

      expect(res.statusCode).toBe(201);

      const reactions = await MessageReaction.find({ tenantId, messageId: message.messageId, userId: 'bob' }).lean();
      expect(reactions).toHaveLength(2);
      expect(reactions.map(r => r.reaction)).toContain('👍');
      expect(reactions.map(r => r.reaction)).toContain('❤️');
    });

    test('returns 404 when message not found', async () => {
      const req = createMockReq({
        params: { messageId: 'msg_missing', action: 'set', userId: 'bob' },
        body: { reaction: '👍' }
      });
      const res = createMockRes();

      await messageReactionController.setOrUnsetReaction(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Not Found', message: 'Message not found' });
    });

    test('returns 400 when userId missing', async () => {
      const req = createMockReq({
        params: { messageId: message.messageId, action: 'set' },
        body: { reaction: '👍' },
        userId: undefined
      });
      const res = createMockRes();

      await messageReactionController.setOrUnsetReaction(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Bad Request', message: 'User ID is required' });
    });
  });

  describe('setOrUnsetReaction - unset action', () => {
    test('removes reaction and updates counts', async () => {
      await MessageReaction.create({
        tenantId,
        messageId: message.messageId,
        userId: 'bob',
        reaction: '🔥',
        createdAt: generateTimestamp(),
      });
      message.reactionCounts = { '🔥': 1 };
      await message.save();

      const req = createMockReq({
        params: { messageId: message.messageId, action: 'unset', userId: 'bob' },
        body: { reaction: '🔥' }
      });
      const res = createMockRes();

      await messageReactionController.setOrUnsetReaction(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body?.data?.counts || {}).toEqual({});

      const reactionDoc = await MessageReaction.findOne({ tenantId, messageId: message.messageId, userId: 'bob', reaction: '🔥' }).lean();
      expect(reactionDoc).toBeNull();

      const updatedMessage = await Message.findOne({ messageId: message.messageId }).lean();
      expect(updatedMessage.reactionCounts).toEqual({});

      const event = await Event.findOne({ tenantId, eventType: 'message.reaction.update' }).lean();
      expect(event).toBeTruthy();
      expect(event.entityId).toBe(message.messageId);
      expect(event.data.message.reactionUpdate).toMatchObject({
        userId: 'bob',
        reaction: null,
        oldReaction: '🔥'
      });
      expect(event.data.message.reactionUpdate.reactionSet || []).toEqual([]);
      
      // Проверяем, что member секция отсутствует, но dialog присутствует
      expect(event.data.member).toBeUndefined();
      expect(event.data.dialog).toBeDefined();
      expect(event.data.dialog.dialogId).toBe(dialog.dialogId);
      expect(event.data.context.includedSections).not.toContain('member');
      expect(event.data.context.includedSections).toContain('dialog');
      expect(event.data.context.includedSections).toContain('message');
    });

    test('removes only specific reaction when user has multiple', async () => {
      await MessageReaction.create({
        tenantId,
        messageId: message.messageId,
        userId: 'bob',
        reaction: '👍',
        createdAt: generateTimestamp(),
      });
      await MessageReaction.create({
        tenantId,
        messageId: message.messageId,
        userId: 'bob',
        reaction: '❤️',
        createdAt: generateTimestamp(),
      });
      message.reactionCounts = { '👍': 1, '❤️': 1 };
      await message.save();

      const req = createMockReq({
        params: { messageId: message.messageId, action: 'unset', userId: 'bob' },
        body: { reaction: '👍' }
      });
      const res = createMockRes();

      await messageReactionController.setOrUnsetReaction(req, res);

      expect(res.statusCode).toBeUndefined();

      const reactions = await MessageReaction.find({ tenantId, messageId: message.messageId, userId: 'bob' }).lean();
      expect(reactions).toHaveLength(1);
      expect(reactions[0].reaction).toBe('❤️');
    });

    test('returns 404 when reaction not found', async () => {
      const req = createMockReq({
        params: { messageId: message.messageId, action: 'unset', userId: 'bob' },
        body: { reaction: '👍' }
      });
      const res = createMockRes();

      await messageReactionController.setOrUnsetReaction(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Not Found', message: 'Reaction not found' });
    });

    test('returns 400 when userId missing', async () => {
      const req = createMockReq({
        params: { messageId: message.messageId, action: 'unset' },
        body: { reaction: '👍' },
        userId: undefined
      });
      const res = createMockRes();

      await messageReactionController.setOrUnsetReaction(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Bad Request', message: 'User ID is required' });
    });

    test('returns 404 when message not found', async () => {
      const req = createMockReq({
        params: { messageId: 'msg_missing', action: 'unset', userId: 'bob' },
        body: { reaction: '👍' }
      });
      const res = createMockRes();

      await messageReactionController.setOrUnsetReaction(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Not Found', message: 'Message not found' });
    });
  });
});
