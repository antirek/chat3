import * as fakeAmqp from '@onify/fake-amqplib';

// Тесты для подключения и базовой функциональности
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

describe('rabbitmqUtils - Connection Tests', () => {
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

  describe('initRabbitMQ', () => {
    test('should connect to fake RabbitMQ successfully', async () => {
      const result = await rabbitmqUtils.initRabbitMQ();
      expect(result).toBe(true);
      expect(rabbitmqUtils.isRabbitMQConnected()).toBe(true);
    });

    test('should create exchanges', async () => {
      await rabbitmqUtils.initRabbitMQ();
      const info = rabbitmqUtils.getRabbitMQInfo();
      expect(info.connected).toBe(true);
      expect(info.exchange).toBe('chat3_events');
      expect(info.updatesExchange).toBe('chat3_updates');
    });
  });

  describe('closeRabbitMQ', () => {
    test('should close connection successfully', async () => {
      await rabbitmqUtils.initRabbitMQ();
      expect(rabbitmqUtils.isRabbitMQConnected()).toBe(true);
      await rabbitmqUtils.closeRabbitMQ();
      expect(rabbitmqUtils.isRabbitMQConnected()).toBe(false);
    });

    test('should handle closing when not connected', async () => {
      await expect(rabbitmqUtils.closeRabbitMQ()).resolves.not.toThrow();
    });
  });

  describe('isRabbitMQConnected', () => {
    test('should return false when not connected', () => {
      expect(rabbitmqUtils.isRabbitMQConnected()).toBe(false);
    });

    test('should return true when connected', async () => {
      await rabbitmqUtils.initRabbitMQ();
      expect(rabbitmqUtils.isRabbitMQConnected()).toBe(true);
    });
  });

  describe('getRabbitMQInfo', () => {
    test('should return RabbitMQ info', async () => {
      await rabbitmqUtils.initRabbitMQ();
      const info = rabbitmqUtils.getRabbitMQInfo();
      expect(info).toHaveProperty('exchange');
      expect(info).toHaveProperty('exchangeType');
      expect(info).toHaveProperty('updatesExchange');
      expect(info).toHaveProperty('connected');
      expect(info.connected).toBe(true);
      expect(info.exchange).toBe('chat3_events');
      expect(info.updatesExchange).toBe('chat3_updates');
    });

    test('should hide credentials in URL', async () => {
      await rabbitmqUtils.initRabbitMQ();
      const info = rabbitmqUtils.getRabbitMQInfo();
      expect(info.url).not.toContain('rmpassword');
      expect(info.url).toContain('***');
    });
  });
});
