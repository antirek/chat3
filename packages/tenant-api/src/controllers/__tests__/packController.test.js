import * as fakeAmqp from '@onify/fake-amqplib';
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
  params: packId != null ? { packId } : {},
  query
});

const createMockReqList = (query = {}) => ({
  tenantId,
  params: {},
  query
});

const createMockReqWithBody = (body, params = {}) => ({
  tenantId,
  params,
  body
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
  const rabbitmqUtils = await import('@chat3/utils/rabbitmqUtils.js');
  const amqplib = await import('amqplib');
  amqplib.default.connect = fakeAmqp.connect;
  await rabbitmqUtils.initRabbitMQ();
});

afterAll(async () => {
  const rabbitmqUtils = await import('@chat3/utils/rabbitmqUtils.js');
  await rabbitmqUtils.closeRabbitMQ();
  await teardownMongoMemoryServer();
});

beforeEach(async () => {
  await clearDatabase();
  fakeAmqp.resetMock();
  const rabbitmqUtils = await import('@chat3/utils/rabbitmqUtils.js');
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

describe('packController.list', () => {
  test('returns packs with pagination', async () => {
    const p1 = createPackId(10);
    const p2 = createPackId(11);
    await Pack.create([
      { tenantId, packId: p1, createdAt: generateTimestamp() },
      { tenantId, packId: p2, createdAt: generateTimestamp() }
    ]);

    const req = createMockReqList({ page: 1, limit: 10 });
    const res = createMockRes();

    await packController.list(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.pagination.pages).toBe(1);
    const ids = res.body.data.map((d) => d.packId);
    expect(ids).toContain(p1);
    expect(ids).toContain(p2);
    res.body.data.forEach((p) => {
      expect(p.meta).toBeDefined();
      expect(p.stats).toBeDefined();
      expect(typeof p.stats.dialogCount).toBe('number');
    });
  });

  test('returns empty array when no packs', async () => {
    const req = createMockReqList({ page: 1, limit: 10 });
    const res = createMockRes();

    await packController.list(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });
});

describe('packController.getById', () => {
  test('returns pack with meta and stats', async () => {
    const packId = createPackId(20);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });
    await PackLink.create({ tenantId, packId, dialogId: dialogId(1) });

    const req = createMockReq(packId);
    const res = createMockRes();

    await packController.getById(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.packId).toBe(packId);
    expect(res.body.data.meta).toBeDefined();
    expect(res.body.data.stats).toBeDefined();
    expect(res.body.data.stats.dialogCount).toBe(1);
  });

  test('returns 404 when pack not found', async () => {
    const req = createMockReq(createPackId(99));
    const res = createMockRes();

    await packController.getById(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toBe('Pack not found');
  });
});

describe('packController.create', () => {
  test('creates pack and returns 201', async () => {
    const req = createMockReqWithBody({});
    const res = createMockRes();

    await packController.create(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.packId).toMatch(/^pck_[a-z0-9]{20}$/);
    expect(res.body.data.tenantId).toBe(tenantId);
    expect(res.body.data.createdAt).toBeDefined();
    const count = await Pack.countDocuments({ tenantId });
    expect(count).toBe(1);
  });
});

describe('packController.delete', () => {
  test('returns 404 when pack not found', async () => {
    const req = createMockReq(createPackId(88));
    const res = createMockRes();

    await packController.delete(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toBe('Pack not found');
  });

  test('deletes pack and returns 200', async () => {
    const packId = createPackId(30);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });

    const req = createMockReq(packId);
    const res = createMockRes();

    await packController.delete(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.packId).toBe(packId);
    expect(res.body.message).toBe('Pack deleted');
    const pack = await Pack.findOne({ packId, tenantId });
    expect(pack).toBeNull();
  });
});

describe('packController.addDialog', () => {
  test('returns 404 when pack not found', async () => {
    const req = createMockReqWithBody(
      { dialogId: dialogId(1) },
      { packId: createPackId(40) }
    );
    await Dialog.create({ tenantId, dialogId: dialogId(1), createdAt: generateTimestamp() });
    const res = createMockRes();

    await packController.addDialog(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toBe('Pack not found');
  });

  test('returns 404 when dialog not found', async () => {
    const packId = createPackId(41);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });
    const req = createMockReqWithBody(
      { dialogId: 'dlg_nonexistent12345678901' },
      { packId }
    );
    const res = createMockRes();

    await packController.addDialog(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toBe('Dialog not found');
  });

  test('adds dialog to pack and returns 201', async () => {
    const packId = createPackId(42);
    const dlgId = dialogId(42);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });
    await Dialog.create({ tenantId, dialogId: dlgId, createdAt: generateTimestamp() });

    const req = createMockReqWithBody({ dialogId: dlgId }, { packId });
    const res = createMockRes();

    await packController.addDialog(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.packId).toBe(packId);
    expect(res.body.data.dialogId).toBe(dlgId);
    expect(res.body.data.addedAt).toBeDefined();
    const link = await PackLink.findOne({ packId, dialogId: dlgId, tenantId });
    expect(link).not.toBeNull();
  });

  test('returns 200 when dialog already in pack', async () => {
    const packId = createPackId(43);
    const dlgId = dialogId(43);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });
    await Dialog.create({ tenantId, dialogId: dlgId, createdAt: generateTimestamp() });
    await PackLink.create({ tenantId, packId, dialogId: dlgId });

    const req = createMockReqWithBody({ dialogId: dlgId }, { packId });
    const res = createMockRes();

    await packController.addDialog(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.alreadyInPack).toBe(true);
  });
});

describe('packController.removeDialog', () => {
  test('returns 404 when pack not found', async () => {
    const packId = createPackId(50);
    const req = createMockReqWithBody({}, { packId, dialogId: dialogId(1) });
    req.params = { packId, dialogId: dialogId(1) };
    const res = createMockRes();

    await packController.removeDialog(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toBe('Pack not found');
  });

  test('returns 404 when dialog not in pack', async () => {
    const packId = createPackId(51);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });

    const req = createMockReqWithBody({}, { packId, dialogId: dialogId(51) });
    req.params = { packId, dialogId: dialogId(51) };
    const res = createMockRes();

    await packController.removeDialog(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toBe('Dialog not found in pack');
  });

  test('removes dialog from pack and returns 200', async () => {
    const packId = createPackId(52);
    const dlgId = dialogId(52);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });
    await PackLink.create({ tenantId, packId, dialogId: dlgId });

    const req = createMockReqWithBody({}, { packId, dialogId: dlgId });
    req.params = { packId, dialogId: dlgId };
    const res = createMockRes();

    await packController.removeDialog(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.packId).toBe(packId);
    expect(res.body.data.dialogId).toBe(dlgId);
    const link = await PackLink.findOne({ packId, dialogId: dlgId, tenantId });
    expect(link).toBeNull();
  });
});

describe('packController.getDialogs', () => {
  test('returns dialogs of pack with pagination', async () => {
    const packId = createPackId(60);
    const dlg1 = dialogId(60);
    const dlg2 = dialogId(61);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });
    await PackLink.create([
      { tenantId, packId, dialogId: dlg1 },
      { tenantId, packId, dialogId: dlg2 }
    ]);

    const req = createMockReq(packId, { page: 1, limit: 10 });
    const res = createMockRes();

    await packController.getDialogs(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
    const dialogIds = res.body.data.map((d) => d.dialogId);
    expect(dialogIds).toContain(dlg1);
    expect(dialogIds).toContain(dlg2);
  });

  test('returns 404 when pack not found', async () => {
    const req = createMockReq(createPackId(69), { page: 1, limit: 10 });
    const res = createMockRes();

    await packController.getDialogs(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toBe('Pack not found');
  });
});
