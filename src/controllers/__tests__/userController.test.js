import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserActivity
} from '../userController.js';
import { User, Meta, Tenant, DialogMember } from '../../models/index.js';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '../../utils/timestampUtils.js';

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
  res.send = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

const createMockReq = (query = {}) => ({
  tenantId,
  query
});

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('userController.getUsers', () => {
  beforeEach(async () => {
    await clearDatabase();

    await Tenant.create({
      tenantId,
      name: 'Test Tenant',
      domain: 'tenant.chat3.dev',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });

    await User.create([
      {
        tenantId,
        userId: 'agent_carl',
        name: 'Carl Johnson',
        lastActiveAt: generateTimestamp(),
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      },
      {
        tenantId,
        userId: 'manager_alice',
        name: 'Alice Manager',
        lastActiveAt: generateTimestamp(),
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      },
      {
        tenantId,
        userId: 'guest_zoe',
        name: 'Zoe Guest',
        lastActiveAt: generateTimestamp(),
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      }
    ]);

    await Meta.create([
      {
        tenantId,
        entityType: 'user',
        entityId: 'agent_carl',
        key: 'role',
        value: 'support',
        dataType: 'string',
        createdBy: 'system'
      },
      {
        tenantId,
        entityType: 'user',
        entityId: 'manager_alice',
        key: 'role',
        value: 'manager',
        dataType: 'string',
        createdBy: 'system'
      },
      {
        tenantId,
        entityType: 'user',
        entityId: 'manager_alice',
        key: 'region',
        value: 'europe',
        dataType: 'string',
        createdBy: 'system'
      }
    ]);
  });

  test('filters by userId via queryParser syntax', async () => {
    const req = createMockReq({
      filter: '(userId,regex,agent)',
      page: '1',
      limit: '10'
    });
    const res = createMockRes();

    await getUsers(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe('agent_carl');
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      pages: 1
    });
  });

  test('filters by meta tags using queryParser syntax', async () => {
    const req = createMockReq({
      filter: '(meta.role,eq,manager)&(meta.region,regex,euro)',
      limit: '5',
      page: '1'
    });
    const res = createMockRes();

    await getUsers(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe('manager_alice');
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.pagination.pages).toBe(1);
  });

  test('returns 400 on invalid filter syntax', async () => {
    const req = createMockReq({
      filter: '(userId,regex',
      page: '1',
      limit: '5'
    });
    const res = createMockRes();

    await getUsers(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: 'Bad Request',
      message: expect.stringContaining('Invalid filter format')
    });
  });

  test('includes dialogCount when includeDialogCount=true', async () => {
    await DialogMember.create([
      {
        tenantId,
        dialogId: 'dlg_aa111111111111111111',
        userId: 'agent_carl',
        isActive: true
      },
      {
        tenantId,
        dialogId: 'dlg_bb222222222222222222',
        userId: 'agent_carl',
        isActive: true
      },
      {
        tenantId,
        dialogId: 'dlg_cc333333333333333333',
        userId: 'manager_alice',
        isActive: false
      }
    ]);

    const req = createMockReq({
      includeDialogCount: 'true',
      limit: '10',
      page: '1'
    });
    const res = createMockRes();

    await getUsers(req, res);

    const carl = res.body.data.find((user) => user.userId === 'agent_carl');
    const alice = res.body.data.find((user) => user.userId === 'manager_alice');
    expect(carl.dialogCount).toBe(2);
    expect(alice.dialogCount).toBe(0);
  });
});

describe('userController.getUserById', () => {
  beforeEach(async () => {
    await clearDatabase();

    await Tenant.create({
      tenantId,
      name: 'Tenant',
      domain: 'tenant.chat3.dev',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });

    await User.create({
      tenantId,
      userId: 'agent_carl',
      name: 'Carl Johnson',
      lastActiveAt: generateTimestamp(),
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });
  });

  test('returns existing user with meta merged', async () => {
    await Meta.create({
      tenantId,
      entityType: 'user',
      entityId: 'agent_carl',
      key: 'role',
      value: 'support',
      dataType: 'string',
      createdBy: 'system'
    });

    const req = {
      tenantId,
      params: { userId: 'agent_carl' }
    };
    const res = createMockRes();

    await getUserById(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data.userId).toBe('agent_carl');
    expect(res.body.data.meta).toEqual({ role: 'support' });
  });

  test('returns fallback meta when user missing but meta exists', async () => {
    await Meta.create({
      tenantId,
      entityType: 'user',
      entityId: 'ghost_user',
      key: 'role',
      value: 'ghost',
      dataType: 'string',
      createdBy: 'system'
    });

    const req = {
      tenantId,
      params: { userId: 'ghost_user' }
    };
    const res = createMockRes();

    await getUserById(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data.userId).toBe('ghost_user');
    expect(res.body.data.meta).toEqual({ role: 'ghost' });
  });

  test('returns 404 when neither user nor meta found', async () => {
    const req = {
      tenantId,
      params: { userId: 'missing' }
    };
    const res = createMockRes();

    await getUserById(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: 'Not Found',
      message: 'User not found'
    });
  });
});

describe('userController.createUser', () => {
  beforeEach(async () => {
    await clearDatabase();

    await Tenant.create({
      tenantId,
      name: 'Tenant',
      domain: 'tenant.chat3.dev',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });
  });

  test('creates user successfully', async () => {
    const req = {
      tenantId,
      body: { userId: 'new_user', name: 'Newbie' }
    };
    const res = createMockRes();

    await createUser(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.userId).toBe('new_user');

    const stored = await User.findOne({ tenantId, userId: 'new_user' }).lean();
    expect(stored).toBeTruthy();
    expect(stored.name).toBe('Newbie');
  });

  test('returns 409 when user already exists', async () => {
    await User.create({
      tenantId,
      userId: 'existing',
      name: 'Existing',
      lastActiveAt: generateTimestamp(),
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });

    const req = {
      tenantId,
      body: { userId: 'existing', name: 'Duplicate' }
    };
    const res = createMockRes();

    await createUser(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });
});

describe('userController.updateUser', () => {
  beforeEach(async () => {
    await clearDatabase();

    await Tenant.create({
      tenantId,
      name: 'Tenant',
      domain: 'tenant.chat3.dev',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });

    await User.create({
      tenantId,
      userId: 'agent_carl',
      name: 'Carl',
      lastActiveAt: generateTimestamp(),
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });
  });

  test('updates user name', async () => {
    const req = {
      tenantId,
      params: { userId: 'agent_carl' },
      body: { name: 'Carl Updated' }
    };
    const res = createMockRes();

    await updateUser(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data.name).toBe('Carl Updated');

    const stored = await User.findOne({ tenantId, userId: 'agent_carl' }).lean();
    expect(stored.name).toBe('Carl Updated');
  });

  test('returns 404 when user missing', async () => {
    const req = {
      tenantId,
      params: { userId: 'missing' },
      body: { name: 'Nope' }
    };
    const res = createMockRes();

    await updateUser(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});

describe('userController.deleteUser', () => {
  beforeEach(async () => {
    await clearDatabase();

    await Tenant.create({
      tenantId,
      name: 'Tenant',
      domain: 'tenant.chat3.dev',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });

    await User.create({
      tenantId,
      userId: 'to_delete',
      name: 'Delete Me',
      lastActiveAt: generateTimestamp(),
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp()
    });
  });

  test('deletes user', async () => {
    const req = {
      tenantId,
      params: { userId: 'to_delete' }
    };
    const res = createMockRes();

    await deleteUser(req, res);

    expect(res.statusCode).toBe(204);

    const stored = await User.findOne({ tenantId, userId: 'to_delete' }).lean();
    expect(stored).toBeNull();
  });

  test('returns 404 if user absent', async () => {
    const req = {
      tenantId,
      params: { userId: 'ghost' }
    };
    const res = createMockRes();

    await deleteUser(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('User not found');
  });
});

describe('userController.updateUserActivity', () => {
  beforeEach(async () => {
    await clearDatabase();

    await Tenant.create({
      tenantId,
      name: 'Tenant',
      domain: 'tenant.chat3.dev',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });

    await User.create({
      tenantId,
      userId: 'active_user',
      name: 'Active User',
      lastActiveAt: 0,
      createdAt: generateTimestamp(),
      updatedAt: 0
    });
  });

  test('updates lastActiveAt and updatedAt', async () => {
    const req = {
      tenantId,
      params: { userId: 'active_user' }
    };
    const res = createMockRes();

    await updateUserActivity(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data.userId).toBe('active_user');
    expect(Number(res.body.data.lastActiveAt)).toBeGreaterThan(0);
    expect(Number(res.body.data.updatedAt)).toBeGreaterThan(0);
  });

  test('returns 404 when user missing', async () => {
    const req = {
      tenantId,
      params: { userId: 'ghost' }
    };
    const res = createMockRes();

    await updateUserActivity(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});

