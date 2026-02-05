import * as userPackController from '../userPackController.js';
import {
  Tenant,
  Pack,
  PackLink,
  Dialog,
  DialogMember,
  Meta
} from '@chat3/models';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

const tenantId = 'tnt_user_pack';

function createDialogId(seed) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let value = 'dlg_';
  for (let i = 0; i < 20; i++) {
    value += chars.charAt((seed + i) % chars.length);
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

const createMockReq = (userId, query = {}) => ({
  tenantId,
  params: { userId },
  query
});

const createMockRes = () => {
  const res = { statusCode: 200, body: null };
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

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

beforeEach(async () => {
  await clearDatabase();
  await Tenant.create({ tenantId, createdAt: generateTimestamp() });
});

describe('userPackController.getUserPacks - filter by meta', () => {
  const userId = 'user_main';
  let packA; // пользователь в диалоге, meta.attention=required
  let packB; // пользователь в диалоге, meta.attention=optional
  let packC; // пользователь НЕ в диалоге, meta.attention=required — не должен попасть в выборку

  beforeEach(async () => {
    const dialogA = createDialogId(1);
    const dialogB = createDialogId(2);
    const dialogC = createDialogId(3);

    await Dialog.create([
      { tenantId, dialogId: dialogA, createdAt: generateTimestamp() },
      { tenantId, dialogId: dialogB, createdAt: generateTimestamp() },
      { tenantId, dialogId: dialogC, createdAt: generateTimestamp() }
    ]);

    await DialogMember.create([
      { tenantId, dialogId: dialogA, userId },
      { tenantId, dialogId: dialogB, userId }
      // dialogC — без userId, пользователь не участник
    ]);

    packA = createPackId(1);
    packB = createPackId(2);
    packC = createPackId(3);

    await Pack.create([
      { tenantId, packId: packA, createdAt: generateTimestamp() },
      { tenantId, packId: packB, createdAt: generateTimestamp() },
      { tenantId, packId: packC, createdAt: generateTimestamp() }
    ]);

    await PackLink.create([
      { tenantId, packId: packA, dialogId: dialogA },
      { tenantId, packId: packB, dialogId: dialogB },
      { tenantId, packId: packC, dialogId: dialogC }
    ]);

    await Meta.create([
      { tenantId, entityType: 'pack', entityId: packA, key: 'attention', value: 'required', dataType: 'string' },
      { tenantId, entityType: 'pack', entityId: packB, key: 'attention', value: 'optional', dataType: 'string' },
      { tenantId, entityType: 'pack', entityId: packC, key: 'attention', value: 'required', dataType: 'string' }
    ]);
  });

  test('filter (meta.attention,eq,required) returns only packs where user is member of a dialog', async () => {
    const req = createMockReq(userId, {
      page: 1,
      limit: 10,
      filter: '(meta.attention,eq,required)',
      sort: 'createdAt',
      sortDirection: 'desc'
    });
    const res = createMockRes();

    await userPackController.getUserPacks(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].packId).toBe(packA);
    expect(res.body.pagination.total).toBe(1);
    const packIds = res.body.data.map((p) => p.packId);
    expect(packIds).toContain(packA);
    expect(packIds).not.toContain(packB);
    expect(packIds).not.toContain(packC);
  });

  test('without filter returns all packs where user is member', async () => {
    const req = createMockReq(userId, { page: 1, limit: 10 });
    const res = createMockRes();

    await userPackController.getUserPacks(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const packIds = res.body.data.map((p) => p.packId);
    expect(packIds).toContain(packA);
    expect(packIds).toContain(packB);
    expect(packIds).not.toContain(packC);
    expect(res.body.pagination.total).toBe(2);
  });
});
