/**
 * Registry API: POST/GET/DELETE /api/meta/index/{entityType}[/{indexId}]
 * (тестируем metaIndexController напрямую, как остальные controller tests)
 */
import metaIndexController from '../metaIndexController.js';
import metaController from '../metaController.js';
import { Pack, Meta, MetaIndexDefinition, MetaIndex } from '@chat3/models';
import { setEntityMetaBulk } from '@chat3/utils/metaUtils.js';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from '../../utils/__tests__/setup.js';

const tenantId = 'tnt_meta_index_registry';
const otherTenantId = 'tnt_other_registry';

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

const createReq = ({
  params = { entityType: 'pack' },
  body = {},
  query = {},
  tenant = tenantId,
  apiKey = { name: 'test-api-key' }
} = {}) => ({
  tenantId: tenant,
  params,
  body,
  query,
  apiKey
});

describe('metaIndexController (registry)', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  describe('POST registerDefinitions', () => {
    test('registers unique index and returns 201', async () => {
      const req = createReq({
        body: { keys: ['contactId'], mode: 'unique' }
      });
      const res = createMockRes();

      await metaIndexController.registerDefinitions(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.data).toMatchObject({
        indexId: 'unique:contactId',
        mode: 'unique',
        keys: ['contactId'],
        entityType: 'pack',
        tenantId
      });
      expect(res.body.message).toContain('registered');
      expect(await MetaIndexDefinition.countDocuments({ tenantId })).toBe(1);
    });

    test('registers required index', async () => {
      const req = createReq({
        body: { keys: ['contactId'], mode: 'required' }
      });
      const res = createMockRes();

      await metaIndexController.registerDefinitions(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.data.indexId).toBe('required:contactId');
      expect(await MetaIndex.countDocuments({ tenantId })).toBe(0);
    });

    test('registers batch via indexes[]', async () => {
      const req = createReq({
        body: {
          indexes: [
            { keys: ['contactId'], mode: 'unique' },
            { keys: ['contactId'], mode: 'required' },
            { keys: ['channel', 'externalId'], mode: 'unique', id: 'by_channel_ext' }
          ]
        }
      });
      const res = createMockRes();

      await metaIndexController.registerDefinitions(req, res);

      expect(res.statusCode).toBe(201);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data.map((d) => d.indexId).sort()).toEqual([
        'by_channel_ext',
        'required:contactId',
        'unique:contactId'
      ]);
      expect(await MetaIndexDefinition.countDocuments({ tenantId })).toBe(3);
    });

    test('dryRun returns 200 without persisting definition', async () => {
      const req = createReq({
        body: { keys: ['key'], mode: 'unique' },
        query: { dryRun: 'true' }
      });
      const res = createMockRes();

      await metaIndexController.registerDefinitions(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Dry run passed');
      expect(await MetaIndexDefinition.countDocuments({ tenantId })).toBe(0);
    });

    test('returns 409 INDEX_CONFLICT_EXISTING_DATA when data violates unique', async () => {
      const p1 = await Pack.create({ tenantId });
      const p2 = await Pack.create({ tenantId });
      await Meta.create([
        {
          tenantId,
          entityType: 'pack',
          entityId: p1.packId,
          key: 'contactId',
          value: 'dup',
          dataType: 'string'
        },
        {
          tenantId,
          entityType: 'pack',
          entityId: p2.packId,
          key: 'contactId',
          value: 'dup',
          dataType: 'string'
        }
      ]);

      const req = createReq({
        body: { keys: ['contactId'], mode: 'unique' }
      });
      const res = createMockRes();

      await metaIndexController.registerDefinitions(req, res);

      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('INDEX_CONFLICT_EXISTING_DATA');
      expect(res.body.details.truncated).toBeDefined();
      expect(await MetaIndexDefinition.countDocuments({ tenantId })).toBe(0);
    });

    test('after bulk delete on duplicate entity, unique index registers (UI clear flow)', async () => {
      const p1 = await Pack.create({ tenantId });
      const p2 = await Pack.create({ tenantId });
      await Meta.create([
        {
          tenantId,
          entityType: 'pack',
          entityId: p1.packId,
          key: 'contactId',
          value: 'dup',
          dataType: 'string'
        },
        {
          tenantId,
          entityType: 'pack',
          entityId: p2.packId,
          key: 'contactId',
          value: 'dup',
          dataType: 'string'
        }
      ]);

      const registerBody = { keys: ['contactId'], mode: 'unique' };

      const conflictRes = createMockRes();
      await metaIndexController.registerDefinitions(
        createReq({ body: registerBody }),
        conflictRes
      );

      expect(conflictRes.statusCode).toBe(409);
      const violation = conflictRes.body.details.violations.find(
        (v) => v.reason === 'duplicateUnique'
      );
      expect(violation).toBeDefined();
      expect([p1.packId, p2.packId]).toContain(violation.entityId);
      expect([p1.packId, p2.packId]).toContain(violation.duplicateWith);
      expect(violation.entityId).not.toBe(violation.duplicateWith);

      const deleteRes = createMockRes();
      await metaController.deleteMetaBulk(
        createReq({
          params: { entityType: 'pack', entityId: violation.entityId },
          body: { keys: ['contactId'] }
        }),
        deleteRes
      );
      expect(deleteRes.statusCode).toBe(200);

      const dryRes = createMockRes();
      await metaIndexController.registerDefinitions(
        createReq({ body: registerBody, query: { dryRun: 'true' } }),
        dryRes
      );
      expect(dryRes.statusCode).toBe(200);
      expect(dryRes.body.message).toBe('Dry run passed');
      expect(await MetaIndexDefinition.countDocuments({ tenantId })).toBe(0);

      const registerRes = createMockRes();
      await metaIndexController.registerDefinitions(
        createReq({ body: registerBody }),
        registerRes
      );
      expect(registerRes.statusCode).toBe(201);
      expect(registerRes.body.data.indexId).toBe('unique:contactId');
      expect(await MetaIndexDefinition.countDocuments({ tenantId })).toBe(1);

      expect(
        await Meta.countDocuments({
          tenantId,
          entityId: violation.duplicateWith,
          key: 'contactId'
        })
      ).toBe(1);
      expect(
        await Meta.countDocuments({ tenantId, entityId: violation.entityId, key: 'contactId' })
      ).toBe(0);
    });

    test('returns 409 INDEX_DEFINITION_CONFLICT for same id different spec', async () => {
      await metaIndexController.registerDefinitions(
        createReq({ body: { keys: ['a'], mode: 'unique', id: 'custom_id' } }),
        createMockRes()
      );

      const req = createReq({
        body: { keys: ['b'], mode: 'unique', id: 'custom_id' }
      });
      const res = createMockRes();

      await metaIndexController.registerDefinitions(req, res);

      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('INDEX_DEFINITION_CONFLICT');
    });

    test('returns 400 INVALID_INDEX_SPEC for invalid body', async () => {
      const req = createReq({
        body: { keys: [], mode: 'unique' }
      });
      const res = createMockRes();

      await metaIndexController.registerDefinitions(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INVALID_INDEX_SPEC');
    });

    test('idempotent re-register returns same definition', async () => {
      const body = { keys: ['contactId'], mode: 'unique' };
      await metaIndexController.registerDefinitions(createReq({ body }), createMockRes());
      const res = createMockRes();
      await metaIndexController.registerDefinitions(createReq({ body }), res);

      expect(res.statusCode).toBe(201);
      expect(res.body.data.indexId).toBe('unique:contactId');
      expect(await MetaIndexDefinition.countDocuments({ tenantId })).toBe(1);
    });
  });

  describe('GET listDefinitions / getDefinition', () => {
    test('lists definitions for tenant and entityType', async () => {
      await metaIndexController.registerDefinitions(
        createReq({ body: { keys: ['a'], mode: 'unique' } }),
        createMockRes()
      );
      await metaIndexController.registerDefinitions(
        createReq({ body: { keys: ['b'], mode: 'required' } }),
        createMockRes()
      );

      const req = createReq({ params: { entityType: 'pack' } });
      const res = createMockRes();

      await metaIndexController.listDefinitions(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(2);
      const ids = res.body.data.map((d) => d.indexId).sort();
      expect(ids).toEqual(['required:b', 'unique:a']);
    });

    test('does not list definitions from another tenant', async () => {
      await metaIndexController.registerDefinitions(
        createReq({ body: { keys: ['key'], mode: 'unique' }, tenant: otherTenantId }),
        createMockRes()
      );

      const req = createReq({ params: { entityType: 'pack' } });
      const res = createMockRes();

      await metaIndexController.listDefinitions(req, res);

      expect(res.body.data).toHaveLength(0);
    });

    test('getDefinition returns one rule', async () => {
      await metaIndexController.registerDefinitions(
        createReq({ body: { keys: ['contactId'], mode: 'required' } }),
        createMockRes()
      );

      const req = createReq({
        params: { entityType: 'pack', indexId: 'required:contactId' }
      });
      const res = createMockRes();

      await metaIndexController.getDefinition(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toMatchObject({
        indexId: 'required:contactId',
        mode: 'required',
        keys: ['contactId']
      });
    });

    test('getDefinition returns 404 when not found', async () => {
      const req = createReq({
        params: { entityType: 'pack', indexId: 'unique:missing' }
      });
      const res = createMockRes();

      await metaIndexController.getDefinition(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  describe('DELETE deleteDefinition', () => {
    test('deletes definition and cascades MetaIndex slots', async () => {
      await metaIndexController.registerDefinitions(
        createReq({ body: { keys: ['key'], mode: 'unique' } }),
        createMockRes()
      );

      const pack = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', pack.packId, { key: 1111 });
      expect(await MetaIndex.countDocuments({ tenantId })).toBe(1);

      const req = createReq({
        params: { entityType: 'pack', indexId: 'unique:key' }
      });
      const res = createMockRes();

      await metaIndexController.deleteDefinition(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Index definition deleted');
      expect(await MetaIndexDefinition.countDocuments({ tenantId })).toBe(0);
      expect(await MetaIndex.countDocuments({ tenantId })).toBe(0);
      // Meta на сущности остаётся
      expect(await Meta.countDocuments({ tenantId, entityId: pack.packId })).toBe(1);
    });

    test('returns 404 when definition does not exist', async () => {
      const req = createReq({
        params: { entityType: 'pack', indexId: 'unique:nope' }
      });
      const res = createMockRes();

      await metaIndexController.deleteDefinition(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('not found');
    });
  });
});
