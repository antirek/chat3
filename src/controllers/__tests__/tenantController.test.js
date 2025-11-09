import { tenantController } from '../tenantController.js';
import { Tenant } from '../../models/index.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';

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
  name: 'Demo Tenant',
  domain: 'demo.example.com',
  type: 'client',
  isActive: true,
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
      await Tenant.create(createTenantPayload({ domain: 'second.example.com', name: 'Second' }));

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
      expect(res.body.data.domain).toBe('demo.example.com');
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
          name: 'New Tenant',
          domain: 'new.example.com'
        })
      };
      const res = createMockRes();

      await tenantController.create(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe('Tenant created successfully');

      const created = await Tenant.findOne({ domain: 'new.example.com' }).lean();
      expect(created).toBeTruthy();
      expect(created.name).toBe('New Tenant');
    });

    test('returns 409 when domain already exists', async () => {
      const req = {
        body: createTenantPayload({ name: 'Duplicate' })
      };
      const res = createMockRes();

      await tenantController.create(req, res);

      expect(res.statusCode).toBe(409);
      expect(res.body).toEqual({
        error: 'Conflict',
        message: 'Tenant with this domain already exists'
      });
    });

    test('returns 400 when payload invalid', async () => {
      const req = { body: { domain: 'invalid' } };
      const res = createMockRes();

      await tenantController.create(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.message).toContain('`name` is required');
    });
  });

  describe('update', () => {
    test('updates tenant and returns payload', async () => {
      const req = {
        params: { id: tenant._id.toString() },
        body: { name: 'Updated Tenant', isActive: false }
      };
      const res = createMockRes();

      await tenantController.update(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body.message).toBe('Tenant updated successfully');
      expect(res.body.data.name).toBe('Updated Tenant');
      expect(res.body.data.isActive).toBe(false);
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

    test('returns 400 when validation fails', async () => {
      const req = {
        params: { id: tenant._id.toString() },
        body: { type: 'unsupported-type' }
      };
      const res = createMockRes();

      await tenantController.update(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.message).toContain('`unsupported-type` is not a valid enum value');
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


