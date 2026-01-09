import * as fakeAmqp from '@onify/fake-amqplib';

// Тесты для работы с очередями
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

describe('rabbitmqUtils - Queue Tests', () => {
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

  describe('createQueue', () => {
    test('should create queue and bind to exchange', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const queueName = `test_queue_${Date.now()}`; // Уникальное имя
      const routingKeys = ['dialog.create.*', 'message.create.*'];
      const messages = [];

      const callback = (event, msg) => {
        messages.push(event);
      };

      const result = await rabbitmqUtils.createQueue(queueName, routingKeys, callback);
      expect(result).toBe(true);
    });

    test('should throw error if not connected', async () => {
      const queueName = `test_queue_${Date.now()}`;
      const routingKeys = ['dialog.create.*'];

      await expect(
        rabbitmqUtils.createQueue(queueName, routingKeys, () => {})
      ).rejects.toThrow('RabbitMQ is not connected');
    });
  });

  describe('ensureUserUpdatesQueue', () => {
    test('should create user updates queue with default type (usr)', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const userId = `user_${Date.now()}`; // Уникальное имя
      const queueName = await rabbitmqUtils.ensureUserUpdatesQueue(userId);

      expect(queueName).toBe(`user_${userId}_updates`);
    });

    test('should create user updates queue with usr prefix', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const userId = `usr_${Date.now()}`;
      const queueName = await rabbitmqUtils.ensureUserUpdatesQueue(userId);

      expect(queueName).toBe(`user_${userId}_updates`);
    });

    test('should create user updates queue with cnt prefix', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const userId = `cnt_${Date.now()}`;
      const queueName = await rabbitmqUtils.ensureUserUpdatesQueue(userId);

      expect(queueName).toBe(`user_${userId}_updates`);
    });

    test('should create user updates queue with bot prefix', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const userId = `bot_${Date.now()}`;
      const queueName = await rabbitmqUtils.ensureUserUpdatesQueue(userId);

      expect(queueName).toBe(`user_${userId}_updates`);
    });

    test('should throw error if not connected', async () => {
      await expect(
        rabbitmqUtils.ensureUserUpdatesQueue(`user_${Date.now()}`)
      ).rejects.toThrow('RabbitMQ is not connected');
    });
  });
});
