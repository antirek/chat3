import { tenantController } from '../tenantController.js';
import { Tenant, Meta } from "../../../../models/index.js";
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

    test('returns tenants without _id field', async () => {
      const req = { query: {} };
      const res = createMockRes();

      await tenantController.getAll(req, res);

      expect(res.body.data[0]).not.toHaveProperty('_id');
      expect(res.body.data[0].tenantId).toBe(tenant.tenantId);
    });

    test('returns tenants with meta tags', async () => {
      // Создаем мета-тег для тенанта
      await Meta.create({
        tenantId: tenant.tenantId,
        entityType: 'tenant',
        entityId: tenant.tenantId,
        key: 'plan',
        value: 'premium',
        dataType: 'string'
      });

      const req = { query: {} };
      const res = createMockRes();

      await tenantController.getAll(req, res);

      expect(res.body.data[0].meta).toEqual({ plan: 'premium' });
    });
  });

  describe('getById', () => {
    test('returns tenant by tenantId', async () => {
      const req = { params: { id: tenant.tenantId } };
      const res = createMockRes();

      await tenantController.getById(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body.data).not.toHaveProperty('_id');
      expect(res.body.data.tenantId).toBe(tenant.tenantId);
    });

    test('returns tenant with meta tags', async () => {
      // Создаем мета-тег для тенанта
      await Meta.create({
        tenantId: tenant.tenantId,
        entityType: 'tenant',
        entityId: tenant.tenantId,
        key: 'plan',
        value: 'enterprise',
        dataType: 'string'
      });

      const req = { params: { id: tenant.tenantId } };
      const res = createMockRes();

      await tenantController.getById(req, res);

      expect(res.body.data.meta).toEqual({ plan: 'enterprise' });
    });

    test('returns 404 when tenant not found', async () => {
      const req = { params: { id: 'tnt_nonexistent' } };
      const res = createMockRes();

      await tenantController.getById(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({
        error: 'Not Found',
        message: 'Tenant with tenantId "tnt_nonexistent" not found'
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
      expect(res.body.data).not.toHaveProperty('_id');
      expect(res.body.data.tenantId).toBe('tnt_new');

      const created = await Tenant.findOne({ tenantId: 'tnt_new' }).lean();
      expect(created).toBeTruthy();
      expect(created.tenantId).toBe('tnt_new');
    });

    test('creates tenant with meta tags', async () => {
      const req = {
        body: {
          tenantId: 'tnt_with_meta',
          meta: { plan: 'premium', maxUsers: 100 }
        }
      };
      const res = createMockRes();

      await tenantController.create(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.data.meta).toEqual({ plan: 'premium', maxUsers: 100 });

      // Проверяем, что мета-теги сохранены в базе
      const savedMeta = await Meta.find({ 
        tenantId: 'tnt_with_meta', 
        entityType: 'tenant' 
      }).lean();
      expect(savedMeta).toHaveLength(2);
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
      expect(res.body.data).not.toHaveProperty('_id');
    });
  });

  describe('delete', () => {
    test('deletes tenant by tenantId', async () => {
      const req = { params: { id: tenant.tenantId } };
      const res = createMockRes();

      await tenantController.delete(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body.message).toBe('Tenant deleted successfully');
      expect(res.body.tenantId).toBe(tenant.tenantId);

      const deleted = await Tenant.findOne({ tenantId: tenant.tenantId });
      expect(deleted).toBeNull();
    });

    test('deletes tenant meta tags when deleting tenant', async () => {
      // Создаем мета-теги для тенанта
      await Meta.create({
        tenantId: tenant.tenantId,
        entityType: 'tenant',
        entityId: tenant.tenantId,
        key: 'plan',
        value: 'premium',
        dataType: 'string'
      });

      const req = { params: { id: tenant.tenantId } };
      const res = createMockRes();

      await tenantController.delete(req, res);

      // Проверяем, что мета-теги удалены
      const remainingMeta = await Meta.find({ 
        tenantId: tenant.tenantId, 
        entityType: 'tenant' 
      });
      expect(remainingMeta).toHaveLength(0);
    });

    test('returns 404 when tenant missing', async () => {
      const req = { params: { id: 'tnt_nonexistent' } };
      const res = createMockRes();

      await tenantController.delete(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({
        error: 'Not Found',
        message: 'Tenant with tenantId "tnt_nonexistent" not found'
      });
    });
  });
});
