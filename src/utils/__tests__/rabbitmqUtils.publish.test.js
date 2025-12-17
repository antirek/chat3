import * as fakeAmqp from '@onify/fake-amqplib';

// Тесты для публикации событий и updates
let rabbitmqUtils;
let originalConsoleLog;
let originalConsoleWarn;
let originalConsoleError;

beforeAll(async () => {
  // Подавляем логирование
  originalConsoleLog = console.log;
  originalConsoleWarn = console.warn;
  originalConsoleError = console.error;
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  
  // Переопределяем amqplib.connect
  const amqplib = await import('amqplib');
  amqplib.default.connect = fakeAmqp.connect;
  
  // Импортируем rabbitmqUtils
  rabbitmqUtils = await import('../rabbitmqUtils.js');
});

afterAll(async () => {
  // Полная очистка
  await rabbitmqUtils.closeRabbitMQ();
  fakeAmqp.resetMock();
  
  // Восстанавливаем логирование
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  
  if (global.gc) {
    global.gc();
  }
});

describe('rabbitmqUtils - Publish Tests', () => {
  beforeEach(async () => {
    // Полная очистка перед каждым тестом
    fakeAmqp.resetMock();
    await rabbitmqUtils.closeRabbitMQ();
    await new Promise(resolve => setTimeout(resolve, 50));
    if (global.gc) global.gc();
  });

  afterEach(async () => {
    await rabbitmqUtils.closeRabbitMQ();
    fakeAmqp.resetMock();
    await new Promise(resolve => setTimeout(resolve, 50));
    if (global.gc) global.gc();
  });

  describe('publishEvent', () => {
    test('should publish event to fake RabbitMQ', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const event = {
        eventId: `evt_test_${Date.now()}`,
        tenantId: 'tnt_test',
        eventType: 'dialog.create',
        entityType: 'dialog',
        entityId: 'dlg_test1234567890123456',
        actorId: 'user1',
        actorType: 'user',
        data: { dialogId: 'dlg_test1234567890123456' }
      };

      const result = await rabbitmqUtils.publishEvent(event);
      expect(result).toBe(true);
    });

    test('should return false if not connected', async () => {
      const event = {
        eventId: `evt_test_${Date.now()}`,
        tenantId: 'tnt_test',
        eventType: 'dialog.create',
        entityType: 'dialog',
        entityId: 'dlg_test1234567890123456',
        actorId: 'user1'
      };

      const result = await rabbitmqUtils.publishEvent(event);
      expect(result).toBe(false);
    });
  });

  describe('publishUpdate', () => {
    test('should publish update to fake RabbitMQ', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const update = {
        tenantId: 'tnt_test',
        userId: 'user1',
        dialogId: 'dlg_test1234567890123456',
        entityId: 'dlg_test1234567890123456',
        eventId: `evt_test_${Date.now()}`,
        eventType: 'dialog.create',
        data: { dialogId: 'dlg_test1234567890123456' }
      };

      const routingKey = 'user.usr.user1.dialogupdate';
      const result = await rabbitmqUtils.publishUpdate(update, routingKey);
      expect(result).toBe(true);
    });

    test('should return false if not connected', async () => {
      const update = {
        tenantId: 'tnt_test',
        userId: 'user1',
        dialogId: 'dlg_test1234567890123456',
        eventType: 'dialog.create',
        data: {}
      };

      const result = await rabbitmqUtils.publishUpdate(update, 'user.usr.user1.dialogupdate');
      expect(result).toBe(false);
    });
  });
});
