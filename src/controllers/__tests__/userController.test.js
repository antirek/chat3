import { getUsers } from '../userController.js';
import { User, Meta, Tenant } from '../../models/index.js';
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
});

