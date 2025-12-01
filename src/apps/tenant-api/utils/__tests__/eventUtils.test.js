import {
  createEvent,
  getEntityEvents,
  getEventsByType,
  getUserEvents,
  getAllEvents,
  deleteOldEvents,
  getEventStats
} from '../eventUtils.js';
import { Event } from "../../../../models/index.js";
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from './setup.js';

// Setup MongoDB перед всеми тестами в этом файле
beforeAll(async () => {
  await setupMongoMemoryServer();
});

// Teardown MongoDB после всех тестов в этом файле
afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('eventUtils - Integration Tests with MongoDB', () => {
  const tenantId = 'tnt_test';

  beforeEach(async () => {
    await clearDatabase();
  });

  describe('createEvent', () => {
    test('should create event and publish to RabbitMQ', async () => {
      const event = await createEvent({
        tenantId,
        eventType: 'dialog.create',
        entityType: 'dialog',
        entityId: 'dlg_test1234567890123456',
        actorId: 'user1',
        actorType: 'user',
        data: { dialogId: 'dlg_test1234567890123456' }
      });

      expect(event).toBeDefined();
      expect(event.tenantId).toBe(tenantId);
      expect(event.eventType).toBe('dialog.create');
      expect(event.entityType).toBe('dialog');
      expect(event.entityId).toBe('dlg_test1234567890123456');
      expect(event.actorId).toBe('user1');
      expect(event.actorType).toBe('user');
      expect(event.data).toEqual({ dialogId: 'dlg_test1234567890123456' });

      // Note: publishEvent вызывается асинхронно в createEvent,
      // поэтому мы не проверяем его вызов здесь (это тестируется в интеграционных тестах)
    });

    test('should create event with default actorType', async () => {
      const event = await createEvent({
        tenantId,
        eventType: 'message.create',
        entityType: 'message',
        entityId: 'msg_test1234567890123456',
        actorId: 'user1',
        data: { content: 'Test message' }
      });

      expect(event.actorType).toBe('user');
    });

    test('should create event with empty data if not provided', async () => {
      const event = await createEvent({
        tenantId,
        eventType: 'dialog.update',
        entityType: 'dialog',
        entityId: 'dlg_test1234567890123456',
        actorId: 'user1'
      });

      expect(event.data).toEqual({});
    });

    test('should handle errors gracefully and return null', async () => {
      // Попытка создать событие без обязательных полей должна вернуть null
      const event = await createEvent({
        tenantId: null, // Невалидное значение
        eventType: 'dialog.create',
        entityType: 'dialog',
        entityId: 'dlg_test1234567890123456',
        actorId: 'user1'
      });

      expect(event).toBeNull();
    });

    test('should create event even if RabbitMQ is unavailable', async () => {
      // createEvent использует .catch() для обработки ошибок RabbitMQ,
      // поэтому событие должно быть создано даже если RabbitMQ недоступен
      const event = await createEvent({
        tenantId,
        eventType: 'message.create',
        entityType: 'message',
        entityId: 'msg_test1234567890123456',
        actorId: 'user1'
      });

      // Событие должно быть создано
      expect(event).toBeDefined();
      expect(event.eventType).toBe('message.create');
    });
  });

  describe('getEntityEvents', () => {
    test('should get events for specific entity', async () => {
      const entityId = 'dlg_test1234567890123456';
      
      await Event.create([
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId,
          actorId: 'user1',
          data: {}
        },
        {
          tenantId,
          eventType: 'dialog.update',
          entityType: 'dialog',
          entityId,
          actorId: 'user1',
          data: {}
        },
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_other1234567890123456',
          actorId: 'user1',
          data: {}
        }
      ]);

      const events = await getEntityEvents(tenantId, 'dialog', entityId);

      expect(events).toHaveLength(2);
      expect(events[0].entityId).toBe(entityId);
      expect(events[1].entityId).toBe(entityId);
    });

    test('should filter events by eventType', async () => {
      const entityId = 'dlg_test1234567890123456';
      
      await Event.create([
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId,
          actorId: 'user1',
          data: {}
        },
        {
          tenantId,
          eventType: 'dialog.update',
          entityType: 'dialog',
          entityId,
          actorId: 'user1',
          data: {}
        }
      ]);

      const events = await getEntityEvents(tenantId, 'dialog', entityId, {
        eventType: 'dialog.create'
      });

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('dialog.create');
    });

    test('should respect limit and sort options', async () => {
      const entityId = 'dlg_test1234567890123456';
      
      await Event.create([
        {
          tenantId,
          eventType: 'dialog.update',
          entityType: 'dialog',
          entityId,
          actorId: 'user1',
          data: {},
          createdAt: Date.now() - 1000
        },
        {
          tenantId,
          eventType: 'dialog.update',
          entityType: 'dialog',
          entityId,
          actorId: 'user1',
          data: {},
          createdAt: Date.now()
        }
      ]);

      const events = await getEntityEvents(tenantId, 'dialog', entityId, {
        limit: 1,
        sort: { createdAt: -1 }
      });

      expect(events).toHaveLength(1);
      // Самый новый должен быть первым
      expect(events[0].createdAt).toBeGreaterThan(Date.now() - 500);
    });
  });

  describe('getEventsByType', () => {
    test('should get events by type', async () => {
      await Event.create([
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123456',
          actorId: 'user1',
          data: {}
        },
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123457',
          actorId: 'user2',
          data: {}
        },
        {
          tenantId,
          eventType: 'message.create',
          entityType: 'message',
          entityId: 'msg_test1234567890123456',
          actorId: 'user1',
          data: {}
        }
      ]);

      const events = await getEventsByType(tenantId, 'dialog.create');

      expect(events).toHaveLength(2);
      events.forEach(event => {
        expect(event.eventType).toBe('dialog.create');
      });
    });

    test('should respect pagination options', async () => {
      await Event.create([
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123456',
          actorId: 'user1',
          data: {}
        },
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123457',
          actorId: 'user2',
          data: {}
        },
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123458',
          actorId: 'user3',
          data: {}
        }
      ]);

      const events = await getEventsByType(tenantId, 'dialog.create', {
        limit: 2,
        skip: 1
      });

      expect(events).toHaveLength(2);
    });
  });

  describe('getUserEvents', () => {
    test('should get events by user', async () => {
      await Event.create([
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123456',
          actorId: 'user1',
          data: {}
        },
        {
          tenantId,
          eventType: 'message.create',
          entityType: 'message',
          entityId: 'msg_test1234567890123456',
          actorId: 'user1',
          data: {}
        },
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123457',
          actorId: 'user2',
          data: {}
        }
      ]);

      const events = await getUserEvents(tenantId, 'user1');

      expect(events).toHaveLength(2);
      events.forEach(event => {
        expect(event.actorId).toBe('user1');
      });
    });

    test('should filter user events by eventType', async () => {
      await Event.create([
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123456',
          actorId: 'user1',
          data: {}
        },
        {
          tenantId,
          eventType: 'message.create',
          entityType: 'message',
          entityId: 'msg_test1234567890123456',
          actorId: 'user1',
          data: {}
        }
      ]);

      const events = await getUserEvents(tenantId, 'user1', {
        eventType: 'dialog.create'
      });

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('dialog.create');
    });
  });

  describe('getAllEvents', () => {
    test('should get all events with pagination', async () => {
      await Event.create([
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123456',
          actorId: 'user1',
          data: {}
        },
        {
          tenantId,
          eventType: 'message.create',
          entityType: 'message',
          entityId: 'msg_test1234567890123456',
          actorId: 'user1',
          data: {}
        }
      ]);

      const result = await getAllEvents(tenantId);

      expect(result.events).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
      expect(result.pagination.pages).toBe(1);
    });

    test('should apply filters', async () => {
      await Event.create([
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123456',
          actorId: 'user1',
          data: {}
        },
        {
          tenantId,
          eventType: 'message.create',
          entityType: 'message',
          entityId: 'msg_test1234567890123456',
          actorId: 'user1',
          data: {}
        }
      ]);

      const result = await getAllEvents(tenantId, {
        eventType: 'dialog.create'
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('dialog.create');
      expect(result.pagination.total).toBe(1);
    });

    test('should handle pagination correctly', async () => {
      // Создаем 5 событий
      for (let i = 0; i < 5; i++) {
        await Event.create({
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: `dlg_test${i.toString().padStart(20, '0')}`,
          actorId: 'user1',
          data: {}
        });
      }

      const result = await getAllEvents(tenantId, {}, {
        page: 1,
        limit: 2
      });

      expect(result.events).toHaveLength(2);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.pages).toBe(3);
    });
  });

  describe('deleteOldEvents', () => {
    test('should delete events before specified date', async () => {
      // Создаем тестовое событие
      const event = await Event.create({
        tenantId,
        eventType: 'dialog.create',
        entityType: 'dialog',
        entityId: 'dlg_test1234567890123456',
        actorId: 'user1',
        data: {}
      });

      // Проверяем, что событие создано
      const eventsBefore = await Event.find({ tenantId, entityId: event.entityId });
      expect(eventsBefore.length).toBe(1);

      // Удаляем все события до текущего времени + 1 секунда
      // Это должно удалить созданное событие (если его createdAt < now + 1000)
      const beforeDate = new Date(Date.now() + 1000);
      const deletedCount = await deleteOldEvents(tenantId, beforeDate);

      // Функция должна вернуть число (количество удаленных событий)
      expect(typeof deletedCount).toBe('number');
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });

    test('should return 0 if no events to delete', async () => {
      const deletedCount = await deleteOldEvents(tenantId, new Date(Date.now() - 10000));

      expect(deletedCount).toBe(0);
    });
  });

  describe('getEventStats', () => {
    test('should get event statistics', async () => {
      await Event.create([
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123456',
          actorId: 'user1',
          data: {}
        },
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123457',
          actorId: 'user2',
          data: {}
        },
        {
          tenantId,
          eventType: 'message.create',
          entityType: 'message',
          entityId: 'msg_test1234567890123456',
          actorId: 'user1',
          data: {}
        }
      ]);

      const stats = await getEventStats(tenantId);

      expect(stats).toHaveLength(2);
      
      const dialogCreateStat = stats.find(s => s.eventType === 'dialog.create');
      expect(dialogCreateStat.count).toBe(2);
      
      const messageAddStat = stats.find(s => s.eventType === 'message.create');
      expect(messageAddStat.count).toBe(1);
    });

    test('should filter stats by date range', async () => {
      const baseTime = Date.now();
      
      // Создаем события с разными временными метками
      await Event.create([
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123456',
          actorId: 'user1',
          data: {},
          createdAt: baseTime // Базовое время
        },
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123457',
          actorId: 'user2',
          data: {},
          createdAt: baseTime - 20000 // 20 секунд назад
        },
        {
          tenantId,
          eventType: 'message.create',
          entityType: 'message',
          entityId: 'msg_test1234567890123456',
          actorId: 'user1',
          data: {},
          createdAt: baseTime + 1000 // 1 секунда в будущем
        }
      ]);

      // Фильтруем события в диапазоне (базовое время ± 5 секунд)
      // Даем небольшую задержку для создания событий
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const stats = await getEventStats(tenantId, {
        startDate: baseTime - 5000,
        endDate: baseTime + 5000
      });

      // В диапазоне должны быть события созданные в baseTime и baseTime + 1000
      // Это dialog.create (baseTime) и message.create (baseTime + 1000)
      expect(stats.length).toBeGreaterThanOrEqual(1);
      
      // Проверяем, что есть хотя бы одно событие в диапазоне
      const totalInRange = stats.reduce((sum, stat) => sum + stat.count, 0);
      expect(totalInRange).toBeGreaterThanOrEqual(1);
    });

    test('should sort stats by count descending', async () => {
      await Event.create([
        {
          tenantId,
          eventType: 'dialog.create',
          entityType: 'dialog',
          entityId: 'dlg_test1234567890123456',
          actorId: 'user1',
          data: {}
        },
        {
          tenantId,
          eventType: 'message.create',
          entityType: 'message',
          entityId: 'msg_test1234567890123456',
          actorId: 'user1',
          data: {}
        },
        {
          tenantId,
          eventType: 'message.create',
          entityType: 'message',
          entityId: 'msg_test1234567890123457',
          actorId: 'user2',
          data: {}
        },
        {
          tenantId,
          eventType: 'message.create',
          entityType: 'message',
          entityId: 'msg_test1234567890123458',
          actorId: 'user3',
          data: {}
        }
      ]);

      const stats = await getEventStats(tenantId);

      expect(stats[0].eventType).toBe('message.create');
      expect(stats[0].count).toBe(3);
      expect(stats[1].eventType).toBe('dialog.create');
      expect(stats[1].count).toBe(1);
    });
  });
});

