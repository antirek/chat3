import * as fakeAmqp from '@onify/fake-amqplib';

// Мокируем amqplib перед импортом rabbitmqUtils
let rabbitmqUtils;
let originalConsoleLog;
let originalConsoleWarn;
let originalConsoleError;

beforeAll(async () => {
  // Подавляем логирование для чистоты тестов
  originalConsoleLog = console.log;
  originalConsoleWarn = console.warn;
  originalConsoleError = console.error;
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  
  // Переопределяем amqplib.connect только для этих тестов
  const amqplib = await import('amqplib');
  amqplib.default.connect = fakeAmqp.connect;
  
  // Импортируем rabbitmqUtils
  rabbitmqUtils = await import('../rabbitmqUtils.js');
});

afterAll(async () => {
  // Восстанавливаем логирование
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  
  // Полная очистка перед завершением
  await rabbitmqUtils.closeRabbitMQ();
  fakeAmqp.resetMock();
  
  // Принудительная сборка мусора
  if (global.gc) {
    global.gc();
  }
});

describe('rabbitmqUtils.createConsumer - Limited Tests', () => {
  beforeEach(async () => {
    // Полная очистка перед каждым тестом
    fakeAmqp.resetMock();
    await rabbitmqUtils.closeRabbitMQ();
    
    // Даем время на полную очистку (увеличено для лучшей изоляции)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Принудительная сборка мусора
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(async () => {
    // Полная очистка после каждого теста
    await rabbitmqUtils.closeRabbitMQ();
    fakeAmqp.resetMock();
    
    // Даем время на очистку всех таймеров и асинхронных операций
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Принудительная сборка мусора
    if (global.gc) {
      global.gc();
    }
  });

  describe('Basic createConsumer functionality', () => {
    test('should create consumer successfully', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const queueName = `test_consumer_${Date.now()}`; // Уникальное имя для изоляции
      const routingKeys = ['dialog.create.*'];

      const messageHandler = async () => {};

      const consumer = await rabbitmqUtils.createConsumer(
        queueName,
        routingKeys,
        { prefetch: 1 },
        messageHandler
      );

      expect(consumer).toBeDefined();
      expect(consumer.consumerTag).toBeDefined();
      expect(typeof consumer.cancel).toBe('function');
      expect(typeof consumer.restart).toBe('function');

      await consumer.cancel();
    });

    test('should throw error if not connected', async () => {
      const queueName = `test_consumer_error_${Date.now()}`;
      const routingKeys = ['dialog.create.*'];

      await expect(
        rabbitmqUtils.createConsumer(
          queueName,
          routingKeys,
          {},
          async () => {}
        )
      ).rejects.toThrow('RabbitMQ is not connected');
    });

    test('should throw error if messageHandler is not provided', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const queueName = `test_consumer_no_handler_${Date.now()}`;
      const routingKeys = ['dialog.create.*'];

      await expect(
        rabbitmqUtils.createConsumer(queueName, routingKeys, {}, null)
      ).rejects.toThrow('messageHandler is required');

      await expect(
        rabbitmqUtils.createConsumer(queueName, routingKeys, {}, undefined)
      ).rejects.toThrow('messageHandler is required');
    });
  });

  describe('Consumer management', () => {
    test('should cancel consumer successfully', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const queueName = `test_consumer_cancel_${Date.now()}`;
      const routingKeys = ['dialog.create.*'];

      const consumer = await rabbitmqUtils.createConsumer(
        queueName,
        routingKeys,
        {},
        async () => {}
      );

      expect(consumer.consumerTag).toBeDefined();

      await consumer.cancel();

      // Consumer должен быть отменен
      expect(consumer.consumerTag).toBeDefined();
    });

    test('should restart consumer successfully', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const queueName = `test_consumer_restart_${Date.now()}`;
      const routingKeys = ['dialog.create.*'];

      const consumer = await rabbitmqUtils.createConsumer(
        queueName,
        routingKeys,
        {},
        async () => {}
      );

      const originalTag = consumer.consumerTag;
      expect(originalTag).toBeDefined();

      // Перезапускаем consumer (exchange должен существовать, т.к. соединение активно)
      // В реальном сценарии restart используется после переподключения, когда exchange уже создан
      await consumer.restart();

      // ConsumerTag должен обновиться
      expect(consumer.consumerTag).toBeDefined();
      expect(consumer.consumerTag).not.toBe(originalTag);

      await consumer.cancel();
    });
  });

  describe('Consumer options', () => {
    test('should handle consumer options (prefetch, TTL, durable)', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const queueName = `test_consumer_options_${Date.now()}`;
      const routingKeys = ['dialog.create.*'];

      const consumer = await rabbitmqUtils.createConsumer(
        queueName,
        routingKeys,
        {
          prefetch: 5,
          queueTTL: 7200000, // 2 часа
          durable: true
        },
        async () => {}
      );

      expect(consumer).toBeDefined();
      expect(consumer.consumerTag).toBeDefined();

      await consumer.cancel();
    });

    test('should use custom exchange if provided', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const queueName = `test_consumer_custom_exchange_${Date.now()}`;
      const routingKeys = ['test.*'];

      const consumer = await rabbitmqUtils.createConsumer(
        queueName,
        routingKeys,
        {
          exchange: 'chat3_updates'
        },
        async () => {}
      );

      expect(consumer).toBeDefined();
      expect(consumer.consumerTag).toBeDefined();

      await consumer.cancel();
    });
  });
});
