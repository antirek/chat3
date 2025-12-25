import { getUserType } from '../userTypeUtils.js';
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

