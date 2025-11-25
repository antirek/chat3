import { tenantController } from '../tenantController.js';
import from "../../../models/index.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../utils/__tests__/setup.js';

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

const createTenantPayload = (overrides = {}) => ({
  tenantId: 'tnt_demo',
  ...overrides
});

describe('tenantController', () => {
  let tenant;

  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
    tenant = await Tenant.create(createTenantPayload());
  });

  describe('getAll', () => {
    test('returns paginated list of tenants', async () => {
      await Tenant.create(createTenantPayload({ tenantId: 'tnt_second' }));

      const req = { query: { page: '1', limit: '1' } };
      const res = createMockRes();

      await tenantController.getAll(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 1,
        total: 2,
        pages: 2
      });
    });
  });

  describe('getById', () => {
    test('returns tenant by id', async () => {
      const req = { params: { id: tenant._id.toString() } };
      const res = createMockRes();

      await tenantController.getById(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(String(res.body.data._id)).toBe(tenant._id.toString());
      expect(res.body.data.tenantId).toBe(tenant.tenantId);
    });

    test('returns 404 when tenant not found', async () => {
      const req = { params: { id: '64fa1cca6f9b1a2b3c4d5e6f' } };
      const res = createMockRes();

      await tenantController.getById(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({
        error: 'Not Found',
        message: 'Tenant not found'
      });
    });

    test('returns 400 for invalid id format', async () => {
      const req = { params: { id: 'invalid-id' } };
      const res = createMockRes();

      await tenantController.getById(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: 'Bad Request',
        message: 'Invalid tenant ID'
      });
    });
  });

  describe('create', () => {
    test('creates tenant when payload is valid', async () => {
      const req = {
        body: createTenantPayload({
          tenantId: 'tnt_new'
        })
      };
      const res = createMockRes();

      await tenantController.create(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe('Tenant created successfully');

      const created = await Tenant.findOne({ tenantId: 'tnt_new' }).lean();
      expect(created).toBeTruthy();
      expect(created.tenantId).toBe('tnt_new');
    });

    test('returns 409 when tenantId already exists', async () => {
      const req = {
        body: createTenantPayload({ tenantId: tenant.tenantId })
      };
      const res = createMockRes();

      await tenantController.create(req, res);

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('Conflict');
      expect(res.body.message).toContain('already exists');
    });

    test('creates tenant without payload (uses defaults)', async () => {
      const req = { body: {} };
      const res = createMockRes();

      await tenantController.create(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe('Tenant created successfully');
      expect(res.body.data.tenantId).toBeTruthy();
    });
  });

  describe('update', () => {
    test('updates tenant and returns payload', async () => {
      const req = {
        params: { id: tenant._id.toString() },
        body: {}
      };
      const res = createMockRes();

      await tenantController.update(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body.message).toBe('Tenant updated successfully');
      expect(res.body.data.tenantId).toBe(tenant.tenantId);
    });

    test('returns 404 when tenant not found', async () => {
      const req = {
        params: { id: '64fa1cca6f9b1a2b3c4d5e6f' },
        body: { name: 'Missing' }
      };
      const res = createMockRes();

      await tenantController.update(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({
        error: 'Not Found',
        message: 'Tenant not found'
      });
    });

    test('updates tenant with empty body', async () => {
      const req = {
        params: { id: tenant._id.toString() },
        body: {}
      };
      const res = createMockRes();

      await tenantController.update(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body.message).toBe('Tenant updated successfully');
    });

    test('returns 400 for invalid id format', async () => {
      const req = {
        params: { id: 'invalid' },
        body: { name: 'Nope' }
      };
      const res = createMockRes();

      await tenantController.update(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: 'Bad Request',
        message: 'Invalid tenant ID'
      });
    });
  });

  describe('delete', () => {
    test('deletes tenant by id', async () => {
      const req = { params: { id: tenant._id.toString() } };
      const res = createMockRes();

      await tenantController.delete(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toEqual({ message: 'Tenant deleted successfully' });

      const deleted = await Tenant.findById(tenant._id);
      expect(deleted).toBeNull();
    });

    test('returns 404 when tenant missing', async () => {
      const req = { params: { id: '64fa1cca6f9b1a2b3c4d5e6f' } };
      const res = createMockRes();

      await tenantController.delete(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({
        error: 'Not Found',
        message: 'Tenant not found'
      });
    });

    test('returns 400 for invalid id', async () => {
      const req = { params: { id: 'invalid' } };
      const res = createMockRes();

      await tenantController.delete(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: 'Bad Request',
        message: 'Invalid tenant ID'
      });
    });
  });
});


