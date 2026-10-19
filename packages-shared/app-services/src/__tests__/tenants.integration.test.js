import {
  createTenant,
  ensureTenant,
  getTenant,
  listTenants,
  deleteTenant,
  AppServiceError
} from '@chat3/app-services';
import { Meta, Tenant } from '@chat3/models';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../../../packages/tenant-api/src/utils/__tests__/setup.js';

describe('tenant CRUD app-services', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  test('createTenant auto-generates id and stores meta', async () => {
    const result = await createTenant({
      meta: { name: 'Acme', plan: 'pro' },
      createdBy: 'test'
    });

    expect(result.created).toBe(true);
    expect(result.tenant.tenantId).toMatch(/^tnt_[a-z0-9]{8}$/);
    expect(result.tenant.meta.name).toBe('Acme');
    expect(result.tenant.meta.plan).toBe('pro');

    const metaDocs = await Meta.find({
      tenantId: result.tenant.tenantId,
      entityType: 'tenant'
    }).lean();
    expect(metaDocs.length).toBe(2);
  });

  test('createTenant with explicit id', async () => {
    const result = await createTenant({ tenantId: 'tnt_amax01' });
    expect(result.tenant.tenantId).toBe('tnt_amax01');
  });

  test('createTenant conflict on duplicate id', async () => {
    await createTenant({ tenantId: 'tnt_dup0001' });
    await expect(createTenant({ tenantId: 'tnt_dup0001' })).rejects.toMatchObject({
      code: 'CONFLICT'
    });
  });

  test('ensureTenant returns existing without recreate', async () => {
    const first = await ensureTenant({
      tenantId: 'tnt_ensure1',
      meta: { branch: 'a' }
    });
    expect(first.created).toBe(true);

    const second = await ensureTenant({
      tenantId: 'tnt_ensure1',
      meta: { branch: 'b' }
    });
    expect(second.created).toBe(false);
    expect(second.tenant.tenantId).toBe('tnt_ensure1');
    expect(second.tenant.meta.branch).toBe('a');
    expect(await Tenant.countDocuments()).toBe(1);
  });

  test('ensureTenant creates when missing', async () => {
    const result = await ensureTenant({ tenantId: 'tnt_new0001', meta: { x: 1 } });
    expect(result.created).toBe(true);
    expect(result.tenant.meta.x).toBe(1);
  });

  test('getTenant / listTenants / deleteTenant', async () => {
    await createTenant({ tenantId: 'tnt_list001', meta: { a: 1 } });
    await createTenant({ tenantId: 'tnt_list002' });

    const one = await getTenant({ tenantId: 'tnt_list001' });
    expect(one.tenant.meta.a).toBe(1);

    const listed = await listTenants({ page: 1, limit: 10, sort: '{"tenantId":1}' });
    expect(listed.pagination.total).toBe(2);
    expect(listed.data.map((t) => t.tenantId)).toEqual(['tnt_list001', 'tnt_list002']);

    const del = await deleteTenant({ tenantId: 'tnt_list001' });
    expect(del.deleted).toBe(true);
    expect(await Tenant.findOne({ tenantId: 'tnt_list001' })).toBeNull();
    expect(
      await Meta.countDocuments({
        tenantId: 'tnt_list001',
        entityType: 'tenant'
      })
    ).toBe(0);

    await expect(getTenant({ tenantId: 'tnt_list001' })).rejects.toBeInstanceOf(AppServiceError);
  });

  test('deleteTenant not found', async () => {
    await expect(deleteTenant({ tenantId: 'tnt_missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });
});
