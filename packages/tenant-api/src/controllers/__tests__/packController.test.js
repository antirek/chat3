import { packController } from '../packController.js';
import {
  Tenant,
  Pack,
  PackLink,
  Dialog,
  Message,
  User
} from '@chat3/models';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from '../../utils/__tests__/setup.js';

const tenantId = 'tnt_pack_test';

const createMockReq = (packId, query = {}) => ({
  tenantId,
  params: { packId },
  query
});

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null
  };
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

function dialogId(index) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let value = 'dlg_';
  for (let i = 0; i < 20; i++) {
    value += chars.charAt((index + i) % chars.length);
  }
  return value;
}

function messageId(index) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let value = 'msg_';
  for (let i = 0; i < 20; i++) {
    value += chars.charAt((index * 3 + i) % chars.length);
  }
  return value;
}

function createPackId(seed) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let value = 'pck_';
  for (let i = 0; i < 20; i++) {
    value += chars.charAt((seed + i) % chars.length);
  }
  return value;
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
    createdAt: generateTimestamp()
  });
});

describe('packController.getMessages', () => {
  test('returns messages with cursor pagination across pack dialogs', async () => {
    const packId = createPackId(1);
    await Pack.create({ packId, tenantId, createdAt: generateTimestamp() });

    const dialogOne = dialogId(1);
    const dialogTwo = dialogId(2);

    await Dialog.create([
      { tenantId, dialogId: dialogOne, createdAt: generateTimestamp() },
      { tenantId, dialogId: dialogTwo, createdAt: generateTimestamp() }
    ]);

    await PackLink.create([
      { tenantId, packId, dialogId: dialogOne },
      { tenantId, packId, dialogId: dialogTwo }
    ]);

    await User.create({
      tenantId,
      userId: 'user_alpha',
      createdAt: generateTimestamp()
    });

    const baseTimestamp = generateTimestamp();
    await Message.create([
      {
        tenantId,
        dialogId: dialogOne,
        messageId: messageId(1),
        senderId: 'user_alpha',
        content: 'First dialog message',
        createdAt: baseTimestamp + 3
      },
      {
        tenantId,
        dialogId: dialogTwo,
        messageId: messageId(2),
        senderId: 'user_alpha',
        content: 'Second dialog message',
        createdAt: baseTimestamp + 2
      },
      {
        tenantId,
        dialogId: dialogOne,
        messageId: messageId(3),
        senderId: 'user_alpha',
        content: 'Third dialog message',
        createdAt: baseTimestamp + 1
      }
    ]);

    const req = createMockReq(packId, { limit: 2 });
    const res = createMockRes();

    await packController.getMessages(req, res);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);

    const [first, second] = res.body.data;
    expect(first.sourceDialogId || first.dialogId).toBeDefined();
    expect(Number(first.createdAt)).toBeGreaterThan(Number(second.createdAt));
    expect(res.body.hasMore).toBe(true);
    expect(res.body.cursor.next).toBeTruthy();
    expect(res.body.cursor.prev).toBeNull();

    // Запрашиваем следующую страницу с курсором
    const nextReq = createMockReq(packId, { limit: 2, cursor: res.body.cursor.next });
    const nextRes = createMockRes();
    await packController.getMessages(nextReq, nextRes);

    expect(nextRes.statusCode).toBe(200);
    expect(nextRes.body.data).toHaveLength(1);
    expect(nextRes.body.hasMore).toBe(false);
    expect(nextRes.body.cursor.next).toBeNull();
  });

  test('returns 404 when pack not found', async () => {
    const req = createMockReq(createPackId(2), { limit: 10 });
    const res = createMockRes();

    await packController.getMessages(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toBe('Pack not found');
  });

  test('returns empty list when pack has no messages', async () => {
    const packId = createPackId(3);
    await Pack.create({ packId, tenantId, createdAt: generateTimestamp() });

    const req = createMockReq(packId, { limit: 10 });
    const res = createMockRes();

    await packController.getMessages(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.cursor).toEqual({ next: null, prev: null });
  });
});
