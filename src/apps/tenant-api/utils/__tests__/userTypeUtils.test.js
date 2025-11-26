import { extractUserType, getUserType } from '../userTypeUtils.js';
import { Tenant, User } from "../../../../models/index.js";
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from './setup.js';
import { generateTimestamp } from '../../../../utils/timestampUtils.js';

describe('userTypeUtils', () => {
  let mongoUri;
  const tenantId = 'tnt_test';

  beforeAll(async () => {
    mongoUri = await setupMongoMemoryServer();
    
    // Create test tenant
    await Tenant.create({
      tenantId,
      name: 'Test Tenant',
      domain: 'test.chat3.com',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
    
    // Recreate tenant after clearing
    await Tenant.create({
      tenantId,
      name: 'Test Tenant',
      domain: 'test.chat3.com',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });
  });

  describe('extractUserType', () => {
    test('extracts type from userId with prefix', () => {
      expect(extractUserType('usr_123')).toBe('usr');
      expect(extractUserType('cnt_456')).toBe('cnt');
      expect(extractUserType('bot_789')).toBe('bot');
    });

    test('extracts type only up to first underscore', () => {
      expect(extractUserType('usr_abc_def')).toBe('usr');
      expect(extractUserType('cnt_123_456')).toBe('cnt');
      expect(extractUserType('bot_test_more')).toBe('bot');
    });

    test('returns usr as default when no underscore', () => {
      expect(extractUserType('carl')).toBe('usr');
      expect(extractUserType('marta')).toBe('usr');
      expect(extractUserType('john')).toBe('usr');
    });

    test('returns usr for empty string', () => {
      expect(extractUserType('')).toBe('usr');
    });

    test('returns usr for null', () => {
      expect(extractUserType(null)).toBe('usr');
    });

    test('returns usr for undefined', () => {
      expect(extractUserType(undefined)).toBe('usr');
    });

    test('returns usr for non-string values', () => {
      expect(extractUserType(123)).toBe('usr');
      expect(extractUserType({})).toBe('usr');
      expect(extractUserType([])).toBe('usr');
    });

    test('handles various prefix types', () => {
      expect(extractUserType('admin_1')).toBe('admin');
      expect(extractUserType('guest_2')).toBe('guest');
      expect(extractUserType('api_3')).toBe('api');
      expect(extractUserType('test_4')).toBe('test');
    });

    test('handles userId starting with underscore', () => {
      expect(extractUserType('_user123')).toBe('');
      // Пустая строка до первого подчеркивания, но это edge case
      // В реальности такого не должно быть, но функция должна корректно обработать
    });

    test('handles userId with only underscore', () => {
      expect(extractUserType('_')).toBe('');
    });
  });

  describe('getUserType', () => {
    test('should return type from User model if exists', async () => {
      await User.create({
        tenantId,
        userId: 'test_user',
        name: 'Test User',
        type: 'bot',
        createdAt: generateTimestamp()
      });

      const userType = await getUserType(tenantId, 'test_user');
      expect(userType).toBe('bot');
    });

    test('should return default type from User model if type is not set', async () => {
      await User.create({
        tenantId,
        userId: 'test_user',
        name: 'Test User',
        createdAt: generateTimestamp()
      });

      const userType = await getUserType(tenantId, 'test_user');
      expect(userType).toBe('user'); // default from schema
    });

    test('should return default user type if user not found', async () => {
      const userType = await getUserType(tenantId, 'usr_123');
      expect(userType).toBe('user'); // default from User model
    });

    test('should return default user type if user not found (no prefix)', async () => {
      const userType = await getUserType(tenantId, 'carl');
      expect(userType).toBe('user'); // default from User model
    });

    test('should handle different user types', async () => {
      await User.create({
        tenantId,
        userId: 'contact_1',
        name: 'Contact',
        type: 'contact',
        createdAt: generateTimestamp()
      });

      const userType = await getUserType(tenantId, 'contact_1');
      expect(userType).toBe('contact');
    });

    test('should handle error gracefully and return default', async () => {
      // Pass invalid tenantId to trigger error
      const userType = await getUserType('invalid_tenant', 'user1');
      expect(userType).toBe('user'); // default from User model
    });
  });
  });

