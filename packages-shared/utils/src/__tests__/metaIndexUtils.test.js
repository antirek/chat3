import {
  normalizeIndexValue,
  isNonEmpty,
  buildIndexId,
  buildCompositeValue,
  registerDefinition,
  loadDefinitions,
  deleteDefinition,
  validateRequiredMetaForCreate
} from '../metaIndexUtils.js';
import { MetaIndex, MetaIndexDefinition, Meta, Pack } from '@chat3/models';
import {
  setEntityMeta,
  setEntityMetaBulk,
  deleteEntityMeta,
  deleteEntityMetaBulk,
  deleteAllMetaForEntity
} from '../metaUtils.js';
import { MetaIndexError } from '../metaIndexErrors.js';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from '@chat3/tenant-api/src/utils/__tests__/setup.js';

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('metaIndexUtils', () => {
  const tenantId = 'tnt_meta_index_test';

  beforeEach(async () => {
    await clearDatabase();
  });

  describe('normalization', () => {
    test('typed canonical and empty values', () => {
      expect(normalizeIndexValue(1111)).toBe('n:1111');
      expect(normalizeIndexValue('1111')).toBe('s:1111');
      expect(normalizeIndexValue('Telegram')).toBe('s:telegram');
      expect(normalizeIndexValue(true)).toBe('b:1');
      expect(normalizeIndexValue(false)).toBe('b:0');
      expect(normalizeIndexValue([1])).toBe('a:[1]');
      expect(normalizeIndexValue('')).toBeNull();
      expect(normalizeIndexValue({})).toBeNull();
      expect(isNonEmpty(0)).toBe(true);
      expect(isNonEmpty(false)).toBe(true);
    });

    test('non-empty object throws INDEX_VALUE_TYPE_NOT_ALLOWED', () => {
      expect(() => normalizeIndexValue({ foo: 1 })).toThrow(MetaIndexError);
      try {
        normalizeIndexValue({ foo: 1 });
      } catch (e) {
        expect(e.code).toBe('INDEX_VALUE_TYPE_NOT_ALLOWED');
      }
    });

    test('buildIndexId sorts keys', () => {
      expect(buildIndexId('unique', ['externalId', 'channel'])).toBe('unique:channel+externalId');
    });

    test('buildIndexId includes when fingerprint', () => {
      const id = buildIndexId(
        'unique',
        ['channelId', 'canonKeyValue'],
        undefined,
        { key: 'serviceType', op: 'eq', value: 'telegram' }
      );
      expect(id).toMatch(/^unique:canonKeyValue\+channelId@w:serviceType:eq:[0-9a-f]{8}$/);
    });

    test('composite unique canonical string', () => {
      const v = buildCompositeValue(
        { channel: 'telegram', externalId: '42' },
        ['channel', 'externalId']
      );
      expect(v).toContain('s:telegram');
      expect(v).toContain('s:42');
    });
  });

  describe('registry', () => {
    test('register unique rejects duplicate existing meta', async () => {
      const pack = await Pack.create({ tenantId });
      await Meta.create({
        tenantId,
        entityType: 'pack',
        entityId: pack.packId,
        key: 'key',
        value: 1111,
        dataType: 'number'
      });
      const pack2 = await Pack.create({ tenantId });
      await Meta.create({
        tenantId,
        entityType: 'pack',
        entityId: pack2.packId,
        key: 'key',
        value: 1111,
        dataType: 'number'
      });

      await expect(
        registerDefinition(tenantId, 'pack', { keys: ['key'], mode: 'unique' })
      ).rejects.toMatchObject({ code: 'INDEX_CONFLICT_EXISTING_DATA' });
    });

    test('dryRun does not persist definition', async () => {
      await registerDefinition(tenantId, 'pack', { keys: ['key'], mode: 'unique' }, { dryRun: true });
      expect(await MetaIndexDefinition.countDocuments({ tenantId })).toBe(0);
    });

    test('idempotent register returns same indexId', async () => {
      const d1 = await registerDefinition(tenantId, 'pack', { keys: ['key'], mode: 'unique' });
      const d2 = await registerDefinition(tenantId, 'pack', { keys: ['key'], mode: 'unique' });
      expect(d1.indexId).toBe('unique:key');
      expect(d2.indexId).toBe('unique:key');
      expect(await MetaIndexDefinition.countDocuments({ tenantId })).toBe(1);
    });

    test('INDEX_DEFINITION_CONFLICT for same id different keys', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['key'],
        mode: 'unique',
        id: 'my_index'
      });
      await expect(
        registerDefinition(tenantId, 'pack', {
          keys: ['other'],
          mode: 'unique',
          id: 'my_index'
        })
      ).rejects.toMatchObject({ code: 'INDEX_DEFINITION_CONFLICT' });
    });

    test('allows same mode+keys with different when (auto id)', async () => {
      const d1 = await registerDefinition(tenantId, 'dialog', {
        keys: ['canonKeyValue', 'channelId'],
        mode: 'unique',
        when: { key: 'serviceType', op: 'eq', value: 'telegram' }
      });
      const d2 = await registerDefinition(tenantId, 'dialog', {
        keys: ['canonKeyValue', 'channelId'],
        mode: 'unique',
        when: { key: 'serviceType', op: 'eq', value: 'max' }
      });

      expect(d1.indexId).not.toBe(d2.indexId);
      const defs = await loadDefinitions(tenantId, 'dialog');
      expect(defs.filter((d) => d.mode === 'unique')).toHaveLength(2);
    });

    test('batch register unique + required on same key', async () => {
      await registerDefinition(tenantId, 'pack', { keys: ['contactId'], mode: 'unique' });
      await registerDefinition(tenantId, 'pack', { keys: ['contactId'], mode: 'required' });
      const defs = await loadDefinitions(tenantId, 'pack');
      expect(defs).toHaveLength(2);
      expect(defs.map((d) => d.mode).sort()).toEqual(['required', 'unique']);
    });

    test('delete definition removes slots', async () => {
      await registerDefinition(tenantId, 'pack', { keys: ['key'], mode: 'unique' });
      const p1 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p1.packId, { key: 1111 });

      await deleteDefinition(tenantId, 'pack', 'unique:key');
      expect(await MetaIndexDefinition.countDocuments({ tenantId })).toBe(0);
      expect(await MetaIndex.countDocuments({ tenantId })).toBe(0);
    });
  });

  describe('unique', () => {
    test('rejects duplicate value on second pack', async () => {
      await registerDefinition(tenantId, 'pack', { keys: ['key'], mode: 'unique' });

      const p1 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p1.packId, { key: 1111 });

      const p2 = await Pack.create({ tenantId });
      await expect(
        setEntityMetaBulk(tenantId, 'pack', p2.packId, { key: 1111 })
      ).rejects.toMatchObject({
        code: 'DUPLICATE_INDEX',
        details: expect.objectContaining({ existingEntityId: p1.packId })
      });

      const slots = await MetaIndex.find({ tenantId, entityType: 'pack' }).lean();
      expect(slots).toHaveLength(1);
    });

    test('number and string are different slots', async () => {
      await registerDefinition(tenantId, 'pack', { keys: ['key'], mode: 'unique' });

      const p1 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p1.packId, { key: 1111 });

      const p2 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p2.packId, { key: '1111' });

      expect(await MetaIndex.countDocuments({ tenantId })).toBe(2);
    });

    test('composite: same channel different externalId allowed', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['channel', 'externalId'],
        mode: 'unique'
      });

      const p1 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p1.packId, {
        channel: 'telegram',
        externalId: '1'
      });

      const p2 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p2.packId, {
        channel: 'telegram',
        externalId: '2'
      });

      expect(await MetaIndex.countDocuments({ tenantId })).toBe(2);
    });

    test('composite: duplicate pair rejected', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['channel', 'externalId'],
        mode: 'unique'
      });

      const p1 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p1.packId, {
        channel: 'telegram',
        externalId: '42'
      });

      const p2 = await Pack.create({ tenantId });
      await expect(
        setEntityMetaBulk(tenantId, 'pack', p2.packId, {
          channel: 'telegram',
          externalId: '42'
        })
      ).rejects.toMatchObject({ code: 'DUPLICATE_INDEX' });
    });

    test('A3: same entity can change unique value', async () => {
      await registerDefinition(tenantId, 'pack', { keys: ['key'], mode: 'unique' });

      const p1 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p1.packId, { key: 1111 });
      await setEntityMetaBulk(tenantId, 'pack', p1.packId, { key: 2222 });

      const slot = await MetaIndex.findOne({ tenantId, entityId: p1.packId }).lean();
      expect(slot.value).toBe('n:2222');
    });

    test('A3: cannot take value owned by another entity', async () => {
      await registerDefinition(tenantId, 'pack', { keys: ['key'], mode: 'unique' });

      const p1 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p1.packId, { key: 1111 });

      const p2 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p2.packId, { key: 2222 });

      await expect(
        setEntityMetaBulk(tenantId, 'pack', p2.packId, { key: 1111 })
      ).rejects.toMatchObject({
        code: 'DUPLICATE_INDEX',
        details: expect.objectContaining({ existingEntityId: p1.packId })
      });
    });
  });

  describe('required', () => {
    test('validateRequiredMetaForCreate rejects missing keys', async () => {
      await registerDefinition(tenantId, 'pack', { keys: ['contactId'], mode: 'required' });
      await expect(validateRequiredMetaForCreate(tenantId, 'pack', {})).rejects.toMatchObject({
        code: 'INDEX_KEYS_REQUIRED'
      });
    });

    test('validateRequiredMetaForCreate accepts full bundle', async () => {
      await registerDefinition(tenantId, 'pack', { keys: ['contactId'], mode: 'required' });
      await expect(
        validateRequiredMetaForCreate(tenantId, 'pack', { contactId: 'c1' })
      ).resolves.toBeUndefined();
    });

    test('rejects empty string for required key', async () => {
      await registerDefinition(tenantId, 'pack', { keys: ['contactId'], mode: 'required' });
      const pack = await Pack.create({ tenantId });

      await expect(
        setEntityMetaBulk(tenantId, 'pack', pack.packId, { contactId: '   ' })
      ).rejects.toMatchObject({ code: 'INDEX_KEYS_REQUIRED' });
    });

    test('composite required: partial bulk rejected', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['channel', 'externalId'],
        mode: 'required'
      });
      const pack = await Pack.create({ tenantId });

      await expect(
        setEntityMetaBulk(tenantId, 'pack', pack.packId, { channel: 'telegram' })
      ).rejects.toMatchObject({ code: 'INDEX_KEYS_REQUIRED' });
    });

    test('composite required: full bulk accepted', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['channel', 'externalId'],
        mode: 'required'
      });
      const pack = await Pack.create({ tenantId });

      const meta = await setEntityMetaBulk(tenantId, 'pack', pack.packId, {
        channel: 'telegram',
        externalId: '42'
      });

      expect(meta.channel).toBe('telegram');
      expect(meta.externalId).toBe('42');
    });

    test('single PUT blocked for composite required link', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['channel', 'externalId'],
        mode: 'required'
      });
      const pack = await Pack.create({ tenantId });

      await expect(
        setEntityMeta(tenantId, 'pack', pack.packId, 'channel', 'telegram', 'string')
      ).rejects.toMatchObject({ code: 'INDEX_KEYS_REQUIRED' });
    });

    test('cannot delete single key from required composite', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['channel', 'externalId'],
        mode: 'required'
      });
      const pack = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', pack.packId, {
        channel: 'telegram',
        externalId: '42'
      });

      await expect(
        deleteEntityMeta(tenantId, 'pack', pack.packId, 'channel')
      ).rejects.toMatchObject({ code: 'INDEX_KEYS_REQUIRED' });
    });

    test('bulk delete removes entire required composite', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['channel', 'externalId'],
        mode: 'required'
      });
      const pack = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', pack.packId, {
        channel: 'telegram',
        externalId: '42'
      });

      const remaining = await deleteEntityMetaBulk(tenantId, 'pack', pack.packId, [
        'channel',
        'externalId'
      ]);
      expect(remaining.channel).toBeUndefined();
      expect(remaining.externalId).toBeUndefined();
    });
  });

  describe('required + unique combined', () => {
    test('must provide key and it must be unique', async () => {
      await registerDefinition(tenantId, 'pack', { keys: ['contactId'], mode: 'required' });
      await registerDefinition(tenantId, 'pack', { keys: ['contactId'], mode: 'unique' });

      const p1 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p1.packId, { contactId: 'same' });

      const p2 = await Pack.create({ tenantId });
      await expect(
        setEntityMetaBulk(tenantId, 'pack', p2.packId, { contactId: 'same' })
      ).rejects.toMatchObject({ code: 'DUPLICATE_INDEX' });

      const p3 = await Pack.create({ tenantId });
      await expect(setEntityMetaBulk(tenantId, 'pack', p3.packId, {})).rejects.toMatchObject({
        code: 'INDEX_KEYS_REQUIRED'
      });
    });
  });

  describe('conditional when', () => {
    test('required with when enforces only on matched type', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['phone', 'nickname'],
        mode: 'required',
        when: { key: 'type', op: 'eq', value: 'telegram' }
      });

      const p1 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p1.packId, { type: 'email' });

      const p2 = await Pack.create({ tenantId });
      await expect(
        setEntityMetaBulk(tenantId, 'pack', p2.packId, { type: 'telegram', phone: '111' })
      ).rejects.toMatchObject({ code: 'INDEX_KEYS_REQUIRED' });
    });

    test('unique with when checks only matched subset', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['phone'],
        mode: 'unique',
        when: { key: 'type', op: 'in', value: ['phone', 'telegram'] }
      });

      const p1 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p1.packId, { type: 'phone', phone: '111' });

      const p2 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p2.packId, { type: 'email', phone: '111' });

      await expect(
        setEntityMetaBulk(tenantId, 'pack', p2.packId, { type: 'telegram', phone: '111' })
      ).rejects.toMatchObject({ code: 'DUPLICATE_INDEX' });
    });

    test('unique when: switching to non-matching type releases slot', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['phone'],
        mode: 'unique',
        when: { key: 'type', op: 'in', value: ['phone', 'telegram'] }
      });

      const p1 = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', p1.packId, { type: 'phone', phone: '111' });
      expect(await MetaIndex.countDocuments({ tenantId, entityId: p1.packId })).toBe(1);

      await setEntityMetaBulk(tenantId, 'pack', p1.packId, { type: 'email' });
      expect(await MetaIndex.countDocuments({ tenantId, entityId: p1.packId })).toBe(0);

      const p2 = await Pack.create({ tenantId });
      await expect(
        setEntityMetaBulk(tenantId, 'pack', p2.packId, { type: 'telegram', phone: '111' })
      ).resolves.toBeDefined();
    });

    test('required with when.ne does not match when key missing', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['phone'],
        mode: 'required',
        when: { key: 'type', op: 'ne', value: 'telegram' }
      });

      const p1 = await Pack.create({ tenantId });
      await expect(
        setEntityMetaBulk(tenantId, 'pack', p1.packId, {})
      ).resolves.toBeDefined();
    });

    test('required with when.exists=true enforces only when key exists', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['phone'],
        mode: 'required',
        when: { key: 'type', op: 'exists', value: true }
      });

      const p1 = await Pack.create({ tenantId });
      await expect(setEntityMetaBulk(tenantId, 'pack', p1.packId, {})).resolves.toBeDefined();

      const p2 = await Pack.create({ tenantId });
      await expect(
        setEntityMetaBulk(tenantId, 'pack', p2.packId, { type: 'telegram' })
      ).rejects.toMatchObject({ code: 'INDEX_KEYS_REQUIRED' });
    });

    test('required with when.exists=false enforces when key is absent', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['phone'],
        mode: 'required',
        when: { key: 'type', op: 'exists', value: false }
      });

      const p1 = await Pack.create({ tenantId });
      await expect(setEntityMetaBulk(tenantId, 'pack', p1.packId, {})).rejects.toMatchObject({
        code: 'INDEX_KEYS_REQUIRED'
      });

      const p2 = await Pack.create({ tenantId });
      await expect(
        setEntityMetaBulk(tenantId, 'pack', p2.packId, { type: 'telegram' })
      ).resolves.toBeDefined();
    });

    test('required with when.in supports mixed typed canonical match', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['phone'],
        mode: 'required',
        when: { key: 'typeCode', op: 'in', value: ['1', 2] }
      });

      const p1 = await Pack.create({ tenantId });
      await expect(
        setEntityMetaBulk(tenantId, 'pack', p1.packId, { typeCode: '1' })
      ).rejects.toMatchObject({ code: 'INDEX_KEYS_REQUIRED' });

      const p2 = await Pack.create({ tenantId });
      await expect(
        setEntityMetaBulk(tenantId, 'pack', p2.packId, { typeCode: 3 })
      ).resolves.toBeDefined();
    });

    test('when.exists checks key presence, not value emptiness', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['phone'],
        mode: 'required',
        when: { key: 'type', op: 'exists', value: true }
      });

      const p1 = await Pack.create({ tenantId });
      await expect(
        setEntityMetaBulk(tenantId, 'pack', p1.packId, { type: null })
      ).rejects.toMatchObject({ code: 'INDEX_KEYS_REQUIRED' });

      const p2 = await Pack.create({ tenantId });
      await expect(
        setEntityMetaBulk(tenantId, 'pack', p2.packId, { type: '' })
      ).rejects.toMatchObject({ code: 'INDEX_KEYS_REQUIRED' });
    });
  });

  describe('allowlist', () => {
    test('register allowlist and reject unknown meta key', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['key', 'label'],
        mode: 'allowed'
      });

      const pack = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', pack.packId, { key: 1, label: 'x' });

      await expect(
        setEntityMeta(tenantId, 'pack', pack.packId, 'unknownField', 'nope', 'string')
      ).rejects.toMatchObject({ code: 'META_KEY_NOT_ALLOWED' });
    });

    test('without allowlist any key is allowed', async () => {
      const pack = await Pack.create({ tenantId });
      await setEntityMeta(tenantId, 'pack', pack.packId, 'anything', 'ok', 'string');
      const meta = await Meta.findOne({ tenantId, entityId: pack.packId, key: 'anything' });
      expect(meta?.value).toBe('ok');
    });

    test('register unique rejects key outside allowlist', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['key', 'channel'],
        mode: 'allowed'
      });

      await expect(
        registerDefinition(tenantId, 'pack', { keys: ['externalId'], mode: 'unique' })
      ).rejects.toMatchObject({ code: 'INDEX_KEYS_NOT_IN_ALLOWLIST' });
    });

    test('register conditional rule rejects when.key outside allowlist', async () => {
      await registerDefinition(tenantId, 'pack', {
        keys: ['key', 'phone'],
        mode: 'allowed'
      });

      await expect(
        registerDefinition(tenantId, 'pack', {
          keys: ['phone'],
          mode: 'required',
          when: { key: 'type', op: 'eq', value: 'telegram' }
        })
      ).rejects.toMatchObject({ code: 'INDEX_KEYS_NOT_IN_ALLOWLIST' });
    });

    test('register allowlist rejects existing extra meta keys', async () => {
      const pack = await Pack.create({ tenantId });
      await Meta.create({
        tenantId,
        entityType: 'pack',
        entityId: pack.packId,
        key: 'legacy',
        value: 'x',
        dataType: 'string'
      });

      await expect(
        registerDefinition(tenantId, 'pack', { keys: ['key'], mode: 'allowed' })
      ).rejects.toMatchObject({ code: 'SCHEMA_CONFLICT_EXISTING_DATA' });
    });

    test('register allowlist rejects empty keys', async () => {
      await expect(
        registerDefinition(tenantId, 'pack', { keys: [], mode: 'allowed' })
      ).rejects.toMatchObject({ code: 'INVALID_INDEX_SPEC' });
    });

    test('idempotent allowlist register with same keys', async () => {
      const first = await registerDefinition(tenantId, 'pack', {
        keys: ['key', 'label'],
        mode: 'allowed'
      });
      const second = await registerDefinition(tenantId, 'pack', {
        keys: ['label', 'key'],
        mode: 'allowed'
      });
      expect(second.indexId).toBe(first.indexId);
      expect(await MetaIndexDefinition.countDocuments({ tenantId, mode: 'allowed' })).toBe(1);
    });
  });

  describe('cascade', () => {
    test('deleteAllMetaForEntity releases unique slots', async () => {
      await registerDefinition(tenantId, 'pack', { keys: ['key'], mode: 'unique' });
      const pack = await Pack.create({ tenantId });
      await setEntityMetaBulk(tenantId, 'pack', pack.packId, { key: 1111 });

      await deleteAllMetaForEntity(tenantId, 'pack', pack.packId);
      expect(await MetaIndex.countDocuments({ tenantId, entityId: pack.packId })).toBe(0);
      expect(await Meta.countDocuments({ tenantId, entityId: pack.packId })).toBe(0);
    });
  });
});
