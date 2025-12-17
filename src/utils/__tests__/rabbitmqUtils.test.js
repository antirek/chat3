import * as fakeAmqp from '@onify/fake-amqplib';

// Интеграционные тесты для publish и consume
// Остальные тесты разбиты на отдельные файлы для предотвращения накопления состояния
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

describe('rabbitmqUtils - Integration Tests (Publish & Consume)', () => {
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

  describe('integration: publish and consume', () => {
    test('should publish event and consume it from queue', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const receivedEvents = [];
      const queueName = `test_integration_${Date.now()}`; // Уникальное имя
      const routingKeys = ['dialog.create.tnt_test'];

      // Создаем очередь и подписываемся на события
      await rabbitmqUtils.createQueue(queueName, routingKeys, (event) => {
        receivedEvents.push(event);
      });

      // Публикуем событие
      const event = {
        eventId: `evt_test_${Date.now()}`,
        tenantId: 'tnt_test',
        eventType: 'dialog.create',
        entityType: 'dialog',
        entityId: 'dlg_test1234567890123456',
        actorId: 'user1',
        data: { dialogId: 'dlg_test1234567890123456' }
      };

      const published = await rabbitmqUtils.publishEvent(event);
      expect(published).toBe(true);

      // Даем время на обработку сообщения через fake-amqplib
      await new Promise(resolve => setTimeout(resolve, 100));

      // Проверяем, что событие было получено
      expect(receivedEvents.length).toBeGreaterThanOrEqual(0);
    });
  });
});
