import metaController from '../metaController.js';
import { Dialog, DialogMember, Message, Meta } from '../../models/index.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';

const tenantId = 'tnt_test';

const createMockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

const createMockReq = ({
  params = {},
  body = {},
  apiKey = { name: 'test-key' }
} = {}) => ({
  tenantId,
  params,
  body,
  apiKey
});

function generateId(prefix) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = prefix;
  while (result.length < prefix.length + 20) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

describe('metaController', () => {
  let dialogId;
  let messageId;
  let dialogMemberKey;

  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();

    dialogId = generateId('dlg_');
    messageId = generateId('msg_');
    dialogMemberKey = `${dialogId}:carl`;

    await Dialog.create({
      tenantId,
      dialogId,
      name: 'Support chat',
      createdBy: 'owner'
    });

    await Message.create({
      tenantId,
      dialogId,
      messageId,
      senderId: 'carl',
      type: 'internal.text',
      content: 'hello there'
    });

    await DialogMember.create({
      tenantId,
      dialogId,
      userId: 'carl'
    });
  });

  describe('getMeta', () => {
    test('returns meta object for existing dialog', async () => {
      await Meta.create([
        {
          tenantId,
          entityType: 'dialog',
          entityId: dialogId,
          key: 'channel',
          value: 'whatsapp',
          dataType: 'string',
          createdBy: 'system'
        },
        {
          tenantId,
          entityType: 'dialog',
          entityId: dialogId,
          key: 'priority',
          value: 'high',
          dataType: 'string',
          createdBy: 'system'
        }
      ]);

      const req = createMockReq({
        params: { entityType: 'dialog', entityId: dialogId }
      });
      const res = createMockRes();

      await metaController.getMeta(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toEqual({
        data: {
          channel: 'whatsapp',
          priority: 'high'
        }
      });
    });

    test('returns 400 for invalid entity type', async () => {
      const req = createMockReq({
        params: { entityType: 'invalid', entityId: 'any' }
      });
      const res = createMockRes();

      await metaController.getMeta(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: 'Bad Request',
        message: expect.stringContaining('Invalid entityType')
      });
    });

    test('returns 404 when dialog not found', async () => {
      const req = createMockReq({
        params: { entityType: 'dialog', entityId: generateId('dlg_') }
      });
      const res = createMockRes();

      await metaController.getMeta(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({
        error: 'Not Found',
        message: expect.stringContaining('Dialog')
      });
    });
  });

  describe('setMeta', () => {
    test('creates meta for dialog', async () => {
      const req = createMockReq({
        params: {
          entityType: 'dialog',
          entityId: dialogId,
          key: 'language'
        },
        body: {
          value: 'ru',
          dataType: 'string'
        }
      });
      const res = createMockRes();

      await metaController.setMeta(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body.message).toBe('Meta set successfully');

      const metaRecord = await Meta.findOne({
        tenantId,
        entityType: 'dialog',
        entityId: dialogId,
        key: 'language'
      }).lean();

      expect(metaRecord).toBeTruthy();
      expect(metaRecord.value).toBe('ru');
      expect(metaRecord.dataType).toBe('string');
    });

    test('returns 400 for unsupported dataType', async () => {
      const req = createMockReq({
        params: {
          entityType: 'dialog',
          entityId: dialogId,
          key: 'lang'
        },
        body: {
          value: 'ru',
          dataType: 'binary'
        }
      });
      const res = createMockRes();

      await metaController.setMeta(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: 'Bad Request',
        message: expect.stringContaining('Invalid dataType')
      });
    });

    test('returns 404 when message does not exist', async () => {
      const missingMessageId = generateId('msg_');
      const req = createMockReq({
        params: {
          entityType: 'message',
          entityId: missingMessageId,
          key: 'externalId'
        },
        body: {
          value: 'crm-404',
          dataType: 'string'
        }
      });
      const res = createMockRes();

      await metaController.setMeta(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({
        error: 'Not Found',
        message: 'Message not found'
      });
    });

    test('returns 400 for dialogMember when entityId format invalid', async () => {
      const req = createMockReq({
        params: {
          entityType: 'dialogMember',
          entityId: 'invalid-format',
          key: 'role'
        },
        body: {
          value: 'observer',
          dataType: 'string'
        }
      });
      const res = createMockRes();

      await metaController.setMeta(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: 'Bad Request',
        message: expect.stringContaining('Invalid DialogMember entityId format')
      });
    });
  });

  describe('deleteMeta', () => {
    test('removes meta key when it exists', async () => {
      await Meta.create({
        tenantId,
        entityType: 'dialogMember',
        entityId: dialogMemberKey,
        key: 'role',
        value: 'agent',
        dataType: 'string',
        createdBy: 'system'
      });

      const req = createMockReq({
        params: {
          entityType: 'dialogMember',
          entityId: dialogMemberKey,
          key: 'role'
        }
      });
      const res = createMockRes();

      await metaController.deleteMeta(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toEqual({ message: 'Meta deleted successfully' });

      const remaining = await Meta.findOne({
        tenantId,
        entityType: 'dialogMember',
        entityId: dialogMemberKey,
        key: 'role'
      }).lean();
      expect(remaining).toBeNull();
    });

    test('returns 404 when meta key missing', async () => {
      const req = createMockReq({
        params: {
          entityType: 'dialog',
          entityId: dialogId,
          key: 'absent'
        }
      });
      const res = createMockRes();

      await metaController.deleteMeta(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({
        error: 'Not Found',
        message: "Meta key 'absent' not found for dialog " + dialogId
      });
    });
  });
});


