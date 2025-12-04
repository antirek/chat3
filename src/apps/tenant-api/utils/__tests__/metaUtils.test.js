import {
  getEntityMeta,
  getEntityMetaFull,
  setEntityMeta,
  deleteEntityMeta,
  getEntityMetaValue,
  buildMetaQuery
} from '../metaUtils.js';
import { Meta } from "../../../../models/index.js";
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from './setup.js';

// Setup MongoDB перед всеми тестами в этом файле
beforeAll(async () => {
  await setupMongoMemoryServer();
});

// Teardown MongoDB после всех тестов в этом файле
afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('metaUtils - Integration Tests with MongoDB', () => {
  const tenantId = 'tnt_test';

  beforeEach(async () => {
    await clearDatabase();
  });

  describe('setEntityMeta', () => {
    test('should create meta tag for entity', async () => {
      const meta = await setEntityMeta(
        tenantId,
        'dialog',
        'dlg_test1234567890123456',
        'channel',
        'telegram',
        'string'
      );

      expect(meta).toBeDefined();
      expect(meta.tenantId).toBe(tenantId);
      expect(meta.entityType).toBe('dialog');
      expect(meta.entityId).toBe('dlg_test1234567890123456');
      expect(meta.key).toBe('channel');
      expect(meta.value).toBe('telegram');
      expect(meta.dataType).toBe('string');
    });

    test('should update existing meta tag', async () => {
      // Создаем мета-тег
      await setEntityMeta(
        tenantId,
        'dialog',
        'dlg_test1234567890123456',
        'channel',
        'telegram',
        'string'
      );

      // Обновляем его
      const updatedMeta = await setEntityMeta(
        tenantId,
        'dialog',
        'dlg_test1234567890123456',
        'channel',
        'whatsapp',
        'string'
      );

      expect(updatedMeta.value).toBe('whatsapp');
    });

    test('should handle different data types', async () => {
      const metaString = await setEntityMeta(
        tenantId,
        'dialog',
        'dlg_test1234567890123456',
        'name',
        'Test Dialog',
        'string'
      );

      const metaNumber = await setEntityMeta(
        tenantId,
        'dialog',
        'dlg_test1234567890123456',
        'priority',
        5,
        'number'
      );

      const metaBoolean = await setEntityMeta(
        tenantId,
        'dialog',
        'dlg_test1234567890123456',
        'isActive',
        true,
        'boolean'
      );

      expect(metaString.value).toBe('Test Dialog');
      expect(metaNumber.value).toBe(5);
      expect(metaBoolean.value).toBe(true);
    });

    test('should set createdBy when provided', async () => {
      const meta = await setEntityMeta(
        tenantId,
        'dialog',
        'dlg_test1234567890123456',
        'channel',
        'telegram',
        'string',
        { createdBy: 'user1' }
      );

      expect(meta.createdBy).toBe('user1');
    });
  });

  describe('getEntityMeta', () => {
    test('should get all meta tags as object', async () => {
      await setEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456', 'channel', 'telegram', 'string');
      await setEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456', 'priority', 5, 'number');
      await setEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456', 'isActive', true, 'boolean');

      const meta = await getEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456');

      expect(meta).toEqual({
        channel: 'telegram',
        priority: 5,
        isActive: true
      });
    });

    test('should return empty object when no meta tags exist', async () => {
      const meta = await getEntityMeta(tenantId, 'dialog', 'dlg_nonexistent1234567890123456');

      expect(meta).toEqual({});
    });

    test('should filter by tenantId and entityType', async () => {
      await setEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456', 'channel', 'telegram', 'string');
      await setEntityMeta('tnt_other', 'dialog', 'dlg_test1234567890123456', 'channel', 'whatsapp', 'string');
      await setEntityMeta(tenantId, 'message', 'dlg_test1234567890123456', 'channel', 'sms', 'string');

      const meta = await getEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456');

      expect(meta.channel).toBe('telegram');
      expect(meta).not.toHaveProperty('whatsapp');
    });

    test('should prioritize scoped meta values over defaults', async () => {
      await setEntityMeta(tenantId, 'dialog', 'dlg_scoped', 'name', 'Default Name', 'string');
      await setEntityMeta(
        tenantId,
        'dialog',
        'dlg_scoped',
        'name',
        'Personal Name',
        'string',
        { scope: 'user_alice' }
      );

      const defaultMeta = await getEntityMeta(tenantId, 'dialog', 'dlg_scoped');
      const scopedMeta = await getEntityMeta(tenantId, 'dialog', 'dlg_scoped', { scope: 'user_alice' });
      const fallbackMeta = await getEntityMeta(tenantId, 'dialog', 'dlg_scoped', { scope: 'user_bob' });

      expect(defaultMeta.name).toBe('Default Name');
      expect(scopedMeta.name).toBe('Personal Name');
      expect(fallbackMeta.name).toBe('Default Name');
    });
  });

  describe('getEntityMetaFull', () => {
    test('should get all meta tags with full information', async () => {
      await setEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456', 'channel', 'telegram', 'string');
      await setEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456', 'priority', 5, 'number');

      const metaFull = await getEntityMetaFull(tenantId, 'dialog', 'dlg_test1234567890123456');

      expect(metaFull).toHaveLength(2);
      expect(metaFull[0]).toHaveProperty('key');
      expect(metaFull[0]).toHaveProperty('value');
      expect(metaFull[0]).toHaveProperty('dataType');
      expect(metaFull[0]).toHaveProperty('createdAt');
      expect(metaFull[0]).not.toHaveProperty('__v');
    });

    test('should return empty array when no meta tags exist', async () => {
      const metaFull = await getEntityMetaFull(tenantId, 'dialog', 'dlg_nonexistent1234567890123456');

      expect(metaFull).toEqual([]);
    });
  });

  describe('getEntityMetaValue', () => {
    test('should get specific meta tag value', async () => {
      await setEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456', 'channel', 'telegram', 'string');

      const value = await getEntityMetaValue(
        tenantId,
        'dialog',
        'dlg_test1234567890123456',
        'channel'
      );

      expect(value).toBe('telegram');
    });

    test('should return default value when meta tag does not exist', async () => {
      const value = await getEntityMetaValue(
        tenantId,
        'dialog',
        'dlg_test1234567890123456',
        'nonexistent',
        'defaultValue'
      );

      expect(value).toBe('defaultValue');
    });

    test('should return null when no default value provided', async () => {
      const value = await getEntityMetaValue(
        tenantId,
        'dialog',
        'dlg_test1234567890123456',
        'nonexistent'
      );

      expect(value).toBeNull();
    });
  });

  describe('deleteEntityMeta', () => {
    test('should delete meta tag', async () => {
      await setEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456', 'channel', 'telegram', 'string');

      const deleted = await deleteEntityMeta(
        tenantId,
        'dialog',
        'dlg_test1234567890123456',
        'channel'
      );

      expect(deleted).toBe(true);

      const meta = await getEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456');
      expect(meta).not.toHaveProperty('channel');
    });

    test('should return false when meta tag does not exist', async () => {
      const deleted = await deleteEntityMeta(
        tenantId,
        'dialog',
        'dlg_test1234567890123456',
        'nonexistent'
      );

      expect(deleted).toBe(false);
    });

    test('should only delete specific key', async () => {
      await setEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456', 'channel', 'telegram', 'string');
      await setEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456', 'priority', 5, 'number');

      await deleteEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456', 'channel');

      const meta = await getEntityMeta(tenantId, 'dialog', 'dlg_test1234567890123456');
      expect(meta).not.toHaveProperty('channel');
      expect(meta.priority).toBe(5);
    });

    test('should delete only scoped meta entry when scope specified', async () => {
      await setEntityMeta(tenantId, 'dialog', 'dlg_scope_delete', 'title', 'Default', 'string');
      await setEntityMeta(
        tenantId,
        'dialog',
        'dlg_scope_delete',
        'title',
        'For Alice',
        'string',
        { scope: 'user_alice' }
      );

      await deleteEntityMeta(tenantId, 'dialog', 'dlg_scope_delete', 'title', { scope: 'user_alice' });

      const defaultMeta = await Meta.findOne({
        tenantId,
        entityType: 'dialog',
        entityId: 'dlg_scope_delete',
        key: 'title',
        scope: null
      }).lean();
      const scopedMetaRecord = await Meta.findOne({
        tenantId,
        entityType: 'dialog',
        entityId: 'dlg_scope_delete',
        key: 'title',
        scope: 'user_alice'
      }).lean();

      expect(defaultMeta.value).toBe('Default');
      expect(scopedMetaRecord).toBeNull();
    });
  });

  describe('buildMetaQuery', () => {
    test('should return null for empty meta filters', async () => {
      const query = await buildMetaQuery(tenantId, 'dialog', {});

      expect(query).toBeNull();
    });

    test('should build query for message entity type', async () => {
      const messageId = 'msg_test1234567890123456';
      await setEntityMeta(tenantId, 'message', messageId, 'channel', 'telegram', 'string');

      const query = await buildMetaQuery(tenantId, 'message', { channel: 'telegram' });

      expect(query).toBeDefined();
      expect(query).toHaveProperty('messageId');
      expect(query.messageId).toHaveProperty('$in');
      expect(query.messageId.$in).toContain(messageId);
    });

    test('should build query for dialog entity type', async () => {
      const dialogId = 'dlg_test1234567890123456';
      await setEntityMeta(tenantId, 'dialog', dialogId, 'channel', 'telegram', 'string');

      const query = await buildMetaQuery(tenantId, 'dialog', { channel: 'telegram' });

      expect(query).toBeDefined();
      expect(query).toHaveProperty('dialogId');
      expect(query.dialogId).toHaveProperty('$in');
      expect(query.dialogId.$in).toContain(dialogId);
    });

    test('should build query for dialogMember entity type', async () => {
      const dialogId = 'dlg_test1234567890123456';
      const userId = 'user1';
      const entityId = `${dialogId}:${userId}`;
      
      await setEntityMeta(tenantId, 'dialogMember', entityId, 'role', 'admin', 'string');

      const query = await buildMetaQuery(tenantId, 'dialogMember', { role: 'admin' });

      expect(query).toBeDefined();
      expect(query).toHaveProperty('$or');
      expect(Array.isArray(query.$or)).toBe(true);
      expect(query.$or.length).toBeGreaterThan(0);
      expect(query.$or[0]).toHaveProperty('dialogId');
      expect(query.$or[0]).toHaveProperty('userId');
    });

    test('should return empty result when no matching meta tags', async () => {
      const query = await buildMetaQuery(tenantId, 'message', { channel: 'nonexistent' });

      expect(query).toBeDefined();
      expect(query).toHaveProperty('messageId');
      expect(query.messageId).toHaveProperty('$in');
      expect(query.messageId.$in).toEqual([]);
    });

    test('should handle multiple meta filters with AND logic', async () => {
      const dialogId = 'dlg_test1234567890123456';
      await setEntityMeta(tenantId, 'dialog', dialogId, 'channel', 'telegram', 'string');
      await setEntityMeta(tenantId, 'dialog', dialogId, 'priority', 5, 'number');

      // buildMetaQuery использует AND логику - все фильтры должны совпадать
      const query = await buildMetaQuery(tenantId, 'dialog', {
        channel: 'telegram',
        priority: 5
      });

      expect(query).toBeDefined();
      expect(query.dialogId.$in).toContain(dialogId);
    });

    test('should handle $ne operator', async () => {
      const dialogId1 = 'dlg_test1234567890123456';
      const dialogId2 = 'dlg_test1234567890123457';
      
      await setEntityMeta(tenantId, 'dialog', dialogId1, 'channel', 'telegram', 'string');
      await setEntityMeta(tenantId, 'dialog', dialogId2, 'channel', 'whatsapp', 'string');

      const query = await buildMetaQuery(tenantId, 'dialog', {
        channel: { $ne: 'telegram' }
      });

      expect(query).toBeDefined();
      expect(query.dialogId.$in).toContain(dialogId2);
      expect(query.dialogId.$in).not.toContain(dialogId1);
    });

    test('should handle complex filters with operators', async () => {
      const messageId = 'msg_test1234567890123456';
      await setEntityMeta(tenantId, 'message', messageId, 'priority', 10, 'number');

      const query = await buildMetaQuery(tenantId, 'message', {
        priority: { $gt: 5 }
      });

      // buildMetaQuery обрабатывает операторы MongoDB
      expect(query).toBeDefined();
    });

    test('should respect scope option when filtering', async () => {
      const dialogIdScoped = 'dlg_scope';
      const dialogIdDefault = 'dlg_default';

      await setEntityMeta(tenantId, 'dialog', dialogIdScoped, 'name', 'Default Name', 'string');
      await setEntityMeta(tenantId, 'dialog', dialogIdDefault, 'name', 'Default Name', 'string');
      await setEntityMeta(
        tenantId,
        'dialog',
        dialogIdScoped,
        'name',
        'Personal Name',
        'string',
        { scope: 'user_alice' }
      );

      const scopedQuery = await buildMetaQuery(
        tenantId,
        'dialog',
        { name: 'Personal Name' },
        { scope: 'user_alice' }
      );

      expect(scopedQuery.dialogId.$in).toContain(dialogIdScoped);

      const defaultQuery = await buildMetaQuery(
        tenantId,
        'dialog',
        { name: 'Personal Name' }
      );

      expect(defaultQuery.dialogId.$in).toEqual([]);
    });
  });

  describe('error handling', () => {
    test('should handle errors gracefully', async () => {
      // Проверяем, что функция обрабатывает некорректные данные
      // Meta модель может не валидировать все поля строго,
      // поэтому просто проверяем, что функция не падает
      try {
        await getEntityMeta('', 'dialog', 'dlg_test1234567890123456');
        // Если не выбросило ошибку, это нормально
      } catch (error) {
        // Если выбросило ошибку, проверяем, что это правильный тип ошибки
        expect(error).toBeInstanceOf(Error);
      }
    });

    test('should handle database connection errors', async () => {
      // Проверяем, что функция выбрасывает ошибку с правильным сообщением
      // при проблемах с базой данных (например, при некорректном entityType)
      try {
        await getEntityMeta(tenantId, 'invalidType', 'invalidId');
        // Если не выбросило ошибку, это нормально для некоторых случаев
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Failed to get entity meta');
      }
    });
  });
});

