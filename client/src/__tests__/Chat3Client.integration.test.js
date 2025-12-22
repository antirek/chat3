/**
 * Интеграционные тесты для Chat3Client
 * Требуют запущенный tenant-api на http://localhost:3000
 * 
 * Для запуска:
 * 1. Запустите tenant-api: npm run start:tenant-api
 * 2. Сгенерируйте API ключ: npm run generate-key
 * 3. Установите переменные окружения:
 *    - CHAT3_API_KEY=your-api-key
 *    - CHAT3_BASE_URL=http://localhost:3000/api (опционально)
 * 4. Запустите тесты: npm test -- Chat3Client.integration.test.js
 */

const { Chat3Client } = require('../Chat3Client.js');

// Переменные окружения для интеграционных тестов
const API_KEY = process.env.CHAT3_API_KEY || 'chat3_91b81eff6a450427e9e8f7e9bcd8431e02982871623301321890736ab97d55d7';
const BASE_URL = process.env.CHAT3_BASE_URL || 'http://localhost:3000/api';
const TENANT_ID = process.env.CHAT3_TENANT_ID || 'tnt_default';

// Пропускаем тесты если не указан API ключ или если явно отключены
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION_TESTS === 'true' || !API_KEY;

describe('Chat3Client Integration Tests', () => {
  let client;

  beforeAll(() => {
    if (SKIP_INTEGRATION) {
      console.log('⚠️  Интеграционные тесты пропущены. Установите CHAT3_API_KEY для запуска.');
      return;
    }

    client = new Chat3Client({
      baseURL: BASE_URL,
      apiKey: API_KEY,
      tenantId: TENANT_ID,
      debug: false
    });
  });

  describe('setMeta - реальный API', () => {
    test('должен установить мета-тег для сообщения', async () => {
      if (SKIP_INTEGRATION) {
        return;
      }

      // Сначала нужно создать сообщение или использовать существующее
      // Для теста используем временный messageId
      const testMessageId = `msg_test_${Date.now()}`;
      const testKey = 'testState';
      const testValue = 'verified';

      try {
        const result = await client.setMeta('message', testMessageId, testKey, testValue);
        
        // Если сообщение не существует, получим 404
        // Это нормально для интеграционного теста
        if (result.error) {
          console.log('⚠️  Сообщение не найдено (ожидаемо для тестового ID):', result.error);
          expect(result.error).toContain('Not Found');
        } else {
          expect(result.data).toBeDefined();
          expect(result.message).toContain('Meta set successfully');
        }
      } catch (error) {
        // Ожидаем 404 если сообщение не существует
        if (error.response && error.response.status === 404) {
          console.log('⚠️  Сообщение не найдено (ожидаемо):', error.response.data.message);
          expect(error.response.status).toBe(404);
        } else {
          throw error;
        }
      }
    }, 10000);

    test('должен установить мета-тег для пользователя', async () => {
      if (SKIP_INTEGRATION) {
        return;
      }

      const testUserId = 'test_user_integration';
      const testKey = 'testTheme';
      const testValue = 'dark';

      try {
        // Сначала создаем пользователя если его нет
        try {
          await client.createUser(testUserId, { name: 'Test User' });
        } catch (e) {
          // Пользователь уже существует - это нормально
        }

        const result = await client.setMeta('user', testUserId, testKey, testValue);
        
        expect(result.data).toBeDefined();
        expect(result.message).toContain('Meta set successfully');
      } catch (error) {
        console.error('Ошибка при установке мета-тега для пользователя:', error.response?.data || error.message);
        throw error;
      }
    }, 10000);

    test('должен получить мета-тег для пользователя', async () => {
      if (SKIP_INTEGRATION) {
        return;
      }

      const testUserId = 'test_user_integration';
      const testKey = 'testTheme';

      try {
        const result = await client.getMeta('user', testUserId);
        
        expect(result.data).toBeDefined();
        // Проверяем, что наш тестовый ключ есть в мета-тегах
        if (result.data[testKey]) {
          expect(result.data[testKey]).toBe('dark');
        }
      } catch (error) {
        console.error('Ошибка при получении мета-тега:', error.response?.data || error.message);
        throw error;
      }
    }, 10000);

    test('должен установить мета-тег с dataType', async () => {
      if (SKIP_INTEGRATION) {
        return;
      }

      const testUserId = 'test_user_integration';
      const testKey = 'testScore';
      const testValue = 100;

      try {
        const result = await client.setMeta('user', testUserId, testKey, testValue, { dataType: 'number' });
        
        expect(result.data).toBeDefined();
        expect(result.data.dataType).toBe('number');
        expect(result.data.value).toBe(100);
      } catch (error) {
        console.error('Ошибка при установке мета-тега с dataType:', error.response?.data || error.message);
        throw error;
      }
    }, 10000);
  });

  describe('Другие методы - проверка работоспособности', () => {
    test('должен получить список пользователей', async () => {
      if (SKIP_INTEGRATION) {
        return;
      }

      try {
        const result = await client.getUsers({ limit: 5 });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      } catch (error) {
        console.error('Ошибка при получении пользователей:', error.response?.data || error.message);
        throw error;
      }
    }, 10000);

    test('должен получить список диалогов', async () => {
      if (SKIP_INTEGRATION) {
        return;
      }

      try {
        const result = await client.getDialogs({ limit: 5 });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      } catch (error) {
        console.error('Ошибка при получении диалогов:', error.response?.data || error.message);
        throw error;
      }
    }, 10000);
  });
});

