import { jest } from '@jest/globals';
import metaController from '../metaController.js';
import { Dialog, Message, DialogMember, Meta } from "../../../../models/index.js";
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
  apiKey = { name: 'test-key' },
  query = {}
} = {}) => ({
  tenantId,
  params,
  body,
  query,
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

    test('prioritizes scoped meta values when scope provided', async () => {
      await Meta.create([
        {
          tenantId,
          entityType: 'dialog',
          entityId: dialogId,
          key: 'name',
          value: 'Default Name',
          dataType: 'string'
        },
        {
          tenantId,
          entityType: 'dialog',
          entityId: dialogId,
          key: 'name',
          value: 'Personal Name',
          dataType: 'string',
          scope: 'user_alice'
        }
      ]);

      const req = createMockReq({
        params: { entityType: 'dialog', entityId: dialogId },
        query: { scope: 'user_alice' }
      });
      const res = createMockRes();

      await metaController.getMeta(req, res);

      expect(res.body.data.name).toBe('Personal Name');
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

    test('stores scoped meta entry when scope provided', async () => {
      const req = createMockReq({
        params: {
          entityType: 'dialog',
          entityId: dialogId,
          key: 'title'
        },
        body: {
          value: 'Scoped Title',
          scope: 'user_alice'
        }
      });
      const res = createMockRes();

      await metaController.setMeta(req, res);

      const scopedMeta = await Meta.findOne({
        tenantId,
        entityType: 'dialog',
        entityId: dialogId,
        key: 'title',
        scope: 'user_alice'
      }).lean();

      expect(scopedMeta).toBeTruthy();
      expect(scopedMeta.value).toBe('Scoped Title');
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

    test('deletes only scoped meta when scope query provided', async () => {
      await Meta.create([
        {
          tenantId,
          entityType: 'dialog',
          entityId: dialogId,
          key: 'summary',
          value: 'Default summary',
          dataType: 'string'
        },
        {
          tenantId,
          entityType: 'dialog',
          entityId: dialogId,
          key: 'summary',
          value: 'Personal summary',
          dataType: 'string',
          scope: 'user_alice'
        }
      ]);

      const req = createMockReq({
        params: {
          entityType: 'dialog',
          entityId: dialogId,
          key: 'summary'
        },
        query: { scope: 'user_alice' }
      });
      const res = createMockRes();

      await metaController.deleteMeta(req, res);

      const defaultMeta = await Meta.findOne({
        tenantId,
        entityType: 'dialog',
        entityId: dialogId,
        key: 'summary',
        scope: null
      }).lean();
      const scopedMeta = await Meta.findOne({
        tenantId,
        entityType: 'dialog',
        entityId: dialogId,
        key: 'summary',
        scope: 'user_alice'
      }).lean();

      expect(defaultMeta).toBeTruthy();
      expect(scopedMeta).toBeNull();
    });
  });

  describe('getMeta - error handling', () => {
    test('handles database errors gracefully', async () => {
      const dialog = await Dialog.create({
        tenantId,
        dialogId: generateId('dlg_'),
        name: 'Test Dialog',
        createdBy: 'alice',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const req = createMockReq({
        params: { entityType: 'dialog', entityId: dialog.dialogId, key: 'test' }
      });
      const res = createMockRes();

      // Mock Dialog.findOne to throw an error in verifyEntityExists
      const originalFindOne = Dialog.findOne;
      Dialog.findOne = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await metaController.getMeta(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');

      // Restore original method
      Dialog.findOne = originalFindOne;
    });
  });

  describe('setMeta - error handling', () => {
    test('handles 500 errors when not 404 or 400', async () => {
      const dialog = await Dialog.create({
        tenantId,
        dialogId: generateId('dlg_'),
        name: 'Test Dialog',
        createdBy: 'alice',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const req = createMockReq({
        params: { entityType: 'dialog', entityId: dialog.dialogId, key: 'test' },
        body: { value: 'test value', dataType: 'string' }
      });
      const res = createMockRes();

      // Mock Dialog.findOne to throw an error in verifyEntityExists
      const originalFindOne = Dialog.findOne;
      Dialog.findOne = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected database error');
      });

      await metaController.setMeta(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');

      // Restore original method
      Dialog.findOne = originalFindOne;
    });

    test('handles ObjectId cast errors', async () => {
      const req = createMockReq({
        params: { entityType: 'dialog', entityId: 'invalid_objectid', key: 'test' },
        body: { value: 'test value', dataType: 'string' }
      });
      const res = createMockRes();

      // Mock Dialog.findOne to throw ObjectId cast error
      const originalFindOne = Dialog.findOne;
      Dialog.findOne = jest.fn().mockImplementation(() => {
        const error = new Error('Cast to ObjectId failed for value "invalid_objectid"');
        throw error;
      });

      await metaController.setMeta(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toContain('Invalid entityId format');

      // Restore original method
      Dialog.findOne = originalFindOne;
    });
  });

  describe('deleteMeta - error handling', () => {
    test('handles database errors gracefully', async () => {
      const dialog = await Dialog.create({
        tenantId,
        dialogId: generateId('dlg_'),
        name: 'Test Dialog',
        createdBy: 'alice',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const req = createMockReq({
        params: { entityType: 'dialog', entityId: dialog.dialogId, key: 'test' },
        query: {}
      });
      const res = createMockRes();

      // Mock Meta.deleteOne to throw an error
      const originalDeleteOne = Meta.deleteOne;
      Meta.deleteOne = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await metaController.deleteMeta(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');

      // Restore original method
      Meta.deleteOne = originalDeleteOne;
    });

    test('handles scope parameter in query', async () => {
      const dialog = await Dialog.create({
        tenantId,
        dialogId: generateId('dlg_'),
        name: 'Test Dialog',
        createdBy: 'alice',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      // Create meta with scope and without scope
      await Meta.create([
        {
          tenantId,
          entityType: 'dialog',
          entityId: dialog.dialogId,
          key: 'name',
          value: 'Scoped Name',
          dataType: 'string',
          scope: 'user_alice'
        },
        {
          tenantId,
          entityType: 'dialog',
          entityId: dialog.dialogId,
          key: 'name',
          value: 'Global Name',
          dataType: 'string',
          scope: null
        }
      ]);

      const req = createMockReq({
        params: { entityType: 'dialog', entityId: dialog.dialogId, key: 'name' },
        query: { scope: 'user_alice' }
      });
      const res = createMockRes();

      await metaController.deleteMeta(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body.message).toBe('Meta deleted successfully');

      // Verify scoped meta is deleted
      const scopedMeta = await Meta.findOne({
        tenantId,
        entityType: 'dialog',
        entityId: dialog.dialogId,
        key: 'name',
        scope: 'user_alice'
      }).lean();

      expect(scopedMeta).toBeNull();

      // Verify global meta still exists
      const globalMeta = await Meta.findOne({
        tenantId,
        entityType: 'dialog',
        entityId: dialog.dialogId,
        key: 'name',
        scope: null
      }).lean();

      expect(globalMeta).toBeTruthy();
      expect(globalMeta.value).toBe('Global Name');
    });
  });
});


