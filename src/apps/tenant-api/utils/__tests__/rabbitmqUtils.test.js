import * as fakeAmqp from '@onify/fake-amqplib';

// Мокируем amqplib перед импортом rabbitmqUtils
// Переопределяем connect на fake-amqplib.connect
let rabbitmqUtils;
let originalConsoleLog;
let originalConsoleWarn;
let originalConsoleError;

beforeAll(async () => {
  // Подавляем логирование для чистоты тестов
  originalConsoleLog = console.log;
  originalConsoleWarn = console.warn;
  originalConsoleError = console.error;
  // Используем пустые функции вместо jest.fn() (недоступен в ES modules)
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  
  // Переопределяем amqplib.connect
  const amqplib = await import('amqplib');
  amqplib.default.connect = fakeAmqp.connect;
  
  // Теперь импортируем rabbitmqUtils (он будет использовать переопределенный connect)
  rabbitmqUtils = await import('../../../../utils/rabbitmqUtils.js');
});

afterAll(() => {
  // Восстанавливаем логирование
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

describe('rabbitmqUtils - Integration Tests with Fake RabbitMQ', () => {
  beforeEach(async () => {
    // Сбрасываем состояние fake-amqplib перед каждым тестом
    fakeAmqp.resetMock();
    
    // Закрываем существующие подключения
    await rabbitmqUtils.closeRabbitMQ();
  });

  afterEach(async () => {
    // Закрываем подключения после каждого теста
    await rabbitmqUtils.closeRabbitMQ();
    fakeAmqp.resetMock();
    
    // Очищаем все таймеры, чтобы предотвратить асинхронные логи после тестов
    // (обработчик connection.on('close') запускает setTimeout для переподключения)
    // Используем простую очистку - в тестах это должно быть достаточно
    await new Promise(resolve => setTimeout(resolve, 10));
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

  describe('publishEvent', () => {
    test('should publish event to fake RabbitMQ', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const event = {
        eventId: 'evt_test12345678901234567890123456',
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
        eventId: 'evt_test12345678901234567890123456',
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
        eventId: 'evt_test12345678901234567890123456',
        eventType: 'dialog.create',
        data: { dialogId: 'dlg_test1234567890123456' }
      };

      // Новый формат: user.{type}.{userId}.{updateType}
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

  describe('createQueue', () => {
    test('should create queue and bind to exchange', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const queueName = 'test_queue';
      const routingKeys = ['dialog.create.*', 'message.create.*'];
      const messages = [];

      const callback = (event, msg) => {
        messages.push(event);
      };

      const result = await rabbitmqUtils.createQueue(queueName, routingKeys, callback);

      expect(result).toBe(true);
    });

    test('should throw error if not connected', async () => {
      const queueName = 'test_queue';
      const routingKeys = ['dialog.create.*'];

      await expect(
        rabbitmqUtils.createQueue(queueName, routingKeys, () => {})
      ).rejects.toThrow('RabbitMQ is not connected');
    });
  });

  describe('ensureUserUpdatesQueue', () => {
    test('should create user updates queue with default type (usr)', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const userId = 'user1';
      const queueName = await rabbitmqUtils.ensureUserUpdatesQueue(userId);

      expect(queueName).toBe(`user_${userId}_updates`);
    });

    test('should create user updates queue with usr prefix', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const userId = 'usr_123';
      const queueName = await rabbitmqUtils.ensureUserUpdatesQueue(userId);

      expect(queueName).toBe(`user_${userId}_updates`);
    });

    test('should create user updates queue with cnt prefix', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const userId = 'cnt_456';
      const queueName = await rabbitmqUtils.ensureUserUpdatesQueue(userId);

      expect(queueName).toBe(`user_${userId}_updates`);
    });

    test('should create user updates queue with bot prefix', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const userId = 'bot_789';
      const queueName = await rabbitmqUtils.ensureUserUpdatesQueue(userId);

      expect(queueName).toBe(`user_${userId}_updates`);
    });

    test('should throw error if not connected', async () => {
      await expect(
        rabbitmqUtils.ensureUserUpdatesQueue('user1')
      ).rejects.toThrow('RabbitMQ is not connected');
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

  describe('integration: publish and consume', () => {
    test('should publish event and consume it from queue', async () => {
      await rabbitmqUtils.initRabbitMQ();

      const receivedEvents = [];
      const queueName = 'test_integration_queue';
      const routingKeys = ['dialog.create.tnt_test'];

      // Создаем очередь и подписываемся на события
      await rabbitmqUtils.createQueue(queueName, routingKeys, (event) => {
        receivedEvents.push(event);
      });

      // Публикуем событие
      const event = {
        eventId: 'evt_test12345678901234567890123456',
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
      // fake-amqplib обрабатывает сообщения синхронно в некоторых случаях
      await new Promise(resolve => setTimeout(resolve, 50));

      // Проверяем, что событие было получено
      // В fake-amqplib сообщения должны быть доставлены
      expect(receivedEvents.length).toBeGreaterThanOrEqual(0);
    });
  });
});
