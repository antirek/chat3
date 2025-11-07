import { processMemberFilters } from '../queryParser.js';
import { DialogMember } from '../../models/index.js';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from './setup.js';

// Setup MongoDB перед всеми тестами в этом файле
beforeAll(async () => {
  await setupMongoMemoryServer();
});

// Teardown MongoDB после всех тестов в этом файле
afterAll(async () => {
  await teardownMongoMemoryServer();
});

// Вспомогательная функция для генерации валидного dialogId
function generateDialogId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

describe('queryParser - Integration Tests with MongoDB', () => {
  const tenantId = 'tnt_test';

  beforeEach(async () => {
    await clearDatabase();
  });

  describe('processMemberFilters', () => {
    test('should return null for empty member filters', async () => {
      const result = await processMemberFilters({}, tenantId);
      expect(result).toBeNull();
    });

    test('should return empty array when no members match', async () => {
      const result = await processMemberFilters({ member: 'nonexistent' }, tenantId);
      expect(result).toEqual([]);
    });

    test('should return dialogIds for simple member filter (string)', async () => {
      const dlg1 = generateDialogId();
      const dlg2 = generateDialogId();
      const dlg3 = generateDialogId();
      
      // Создаем тестовые данные
      await DialogMember.create([
        {
          tenantId,
          dialogId: dlg1,
          userId: 'carl',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg2,
          userId: 'carl',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg3,
          userId: 'alice',
          unreadCount: 0
        }
      ]);

      const result = await processMemberFilters({ member: 'carl' }, tenantId);
      
      expect(result).toHaveLength(2);
      expect(result).toContain(dlg1);
      expect(result).toContain(dlg2);
      expect(result).not.toContain(dlg3);
    });

    test('should return dialogIds for $in filter', async () => {
      const dlg1 = generateDialogId();
      const dlg2 = generateDialogId();
      const dlg3 = generateDialogId();
      
      // Создаем тестовые данные
      await DialogMember.create([
        {
          tenantId,
          dialogId: dlg1,
          userId: 'carl',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg2,
          userId: 'alice',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg3,
          userId: 'bob',
          unreadCount: 0
        }
      ]);

      const result = await processMemberFilters({ 
        member: { $in: ['carl', 'alice'] } 
      }, tenantId);
      
      expect(result).toHaveLength(2);
      expect(result).toContain(dlg1);
      expect(result).toContain(dlg2);
      expect(result).not.toContain(dlg3);
    });

    test('should return dialogIds for $ne filter', async () => {
      const dlg1 = generateDialogId();
      const dlg2 = generateDialogId();
      const dlg3 = generateDialogId();
      
      // Создаем тестовые данные
      await DialogMember.create([
        {
          tenantId,
          dialogId: dlg1,
          userId: 'carl',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg2,
          userId: 'alice',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg3,
          userId: 'bob',
          unreadCount: 0
        }
      ]);

      const result = await processMemberFilters({ 
        member: { $ne: 'carl' } 
      }, tenantId);
      
      expect(result).toHaveLength(2);
      expect(result).toContain(dlg2);
      expect(result).toContain(dlg3);
      expect(result).not.toContain(dlg1);
    });

    test('should return dialogIds for $nin filter', async () => {
      const dlg1 = generateDialogId();
      const dlg2 = generateDialogId();
      const dlg3 = generateDialogId();
      
      // Создаем тестовые данные
      await DialogMember.create([
        {
          tenantId,
          dialogId: dlg1,
          userId: 'carl',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg2,
          userId: 'alice',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg3,
          userId: 'bob',
          unreadCount: 0
        }
      ]);

      const result = await processMemberFilters({ 
        member: { $nin: ['carl', 'alice'] } 
      }, tenantId);
      
      expect(result).toHaveLength(1);
      expect(result).toContain(dlg3);
      expect(result).not.toContain(dlg1);
      expect(result).not.toContain(dlg2);
    });

    test('should return dialogIds for $all filter (all members must be present)', async () => {
      const dlg1 = generateDialogId();
      const dlg2 = generateDialogId();
      const dlg3 = generateDialogId();
      const dlg4 = generateDialogId();
      
      // Создаем диалоги с разными участниками
      // dlg1: carl, alice, bob (все трое)
      // dlg2: carl, alice (нет bob)
      // dlg3: carl, bob (нет alice)
      // dlg4: alice, bob (нет carl)
      
      await DialogMember.create([
        {
          tenantId,
          dialogId: dlg1,
          userId: 'carl',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg1,
          userId: 'alice',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg1,
          userId: 'bob',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg2,
          userId: 'carl',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg2,
          userId: 'alice',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg3,
          userId: 'carl',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg3,
          userId: 'bob',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg4,
          userId: 'alice',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg4,
          userId: 'bob',
          unreadCount: 0
        }
      ]);

      // Ищем диалоги, где есть ВСЕ трое: carl, alice, bob
      const result = await processMemberFilters({ 
        member: { $all: ['carl', 'alice', 'bob'] } 
      }, tenantId);
      
      expect(result).toHaveLength(1);
      expect(result).toContain(dlg1);
      expect(result).not.toContain(dlg2);
      expect(result).not.toContain(dlg3);
      expect(result).not.toContain(dlg4);
    });

    test('should return empty array for $all filter when no dialog has all members', async () => {
      const dlg1 = generateDialogId();
      const dlg2 = generateDialogId();
      
      await DialogMember.create([
        {
          tenantId,
          dialogId: dlg1,
          userId: 'carl',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg2,
          userId: 'alice',
          unreadCount: 0
        }
      ]);

      const result = await processMemberFilters({ 
        member: { $all: ['carl', 'alice', 'bob'] } 
      }, tenantId);
      
      expect(result).toEqual([]);
    });

    test('should filter by tenantId', async () => {
      const otherTenantId = 'tnt_other';
      const dlg1 = generateDialogId();
      const dlg2 = generateDialogId();
      
      await DialogMember.create([
        {
          tenantId,
          dialogId: dlg1,
          userId: 'carl',
          unreadCount: 0
        },
        {
          tenantId: otherTenantId,
          dialogId: dlg2,
          userId: 'carl',
          unreadCount: 0
        }
      ]);

      const result = await processMemberFilters({ member: 'carl' }, tenantId);
      
      expect(result).toHaveLength(1);
      expect(result).toContain(dlg1);
      expect(result).not.toContain(dlg2);
    });

    test('should return unique dialogIds', async () => {
      const dlg1 = generateDialogId();
      
      // Создаем несколько записей для одного диалога с разными пользователями
      // (unique индекс не позволит создать две записи с одинаковыми userId, dialogId, tenantId)
      await DialogMember.create([
        {
          tenantId,
          dialogId: dlg1,
          userId: 'carl',
          unreadCount: 0
        },
        {
          tenantId,
          dialogId: dlg1,
          userId: 'alice',
          unreadCount: 0
        }
      ]);

      const result = await processMemberFilters({ member: 'carl' }, tenantId);
      
      // Должен быть только один уникальный dialogId
      expect(result).toHaveLength(1);
      expect(result).toContain(dlg1);
    });

    test('should handle empty array for $all filter', async () => {
      const result = await processMemberFilters({ 
        member: { $all: [] } 
      }, tenantId);
      
      expect(result).toEqual([]);
    });

    test('should handle $all filter with single member', async () => {
      const dlg1 = generateDialogId();
      
      await DialogMember.create([
        {
          tenantId,
          dialogId: dlg1,
          userId: 'carl',
          unreadCount: 0
        }
      ]);

      const result = await processMemberFilters({ 
        member: { $all: ['carl'] } 
      }, tenantId);
      
      expect(result).toHaveLength(1);
      expect(result).toContain(dlg1);
    });
  });
});

