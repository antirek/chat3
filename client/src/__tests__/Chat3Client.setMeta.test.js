// Мокаем axios перед импортом Chat3Client
const mockAxiosInstance = {
  put: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  defaults: {
    headers: {
      common: {}
    }
  },
  interceptors: {
    request: {
      use: jest.fn()
    },
    response: {
      use: jest.fn()
    }
  }
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance)
}));

const { Chat3Client } = require('../Chat3Client.js');

describe('Chat3Client.setMeta', () => {
  let client;

  beforeEach(() => {
    // Очищаем все моки перед каждым тестом
    jest.clearAllMocks();
    
    // Создаем новый клиент для каждого теста
    client = new Chat3Client({
      baseURL: 'http://localhost:3000',  // Без /api, префикс добавляется автоматически
      apiKey: 'test-api-key',
      tenantId: 'tnt_test',
      debug: false
    });
  });

  describe('Базовое использование', () => {
    test('должен установить мета-тег с простым значением', async () => {
      const mockResponse = {
        data: {
          data: {
            tenantId: 'tnt_test',
            entityType: 'message',
            entityId: 'msg_123',
            key: 'state',
            value: 'verified',
            dataType: 'string'
          },
          message: 'Meta set successfully'
        }
      };

      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await client.setMeta('message', 'msg_123', 'state', 'verified');

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/message/msg_123/state',
        {
          value: 'verified'
        }
      );

      expect(result).toEqual(mockResponse.data);
    });

    test('должен установить мета-тег с указанным dataType', async () => {
      const mockResponse = {
        data: {
          data: {
            tenantId: 'tnt_test',
            entityType: 'user',
            entityId: 'carl',
            key: 'score',
            value: 100,
            dataType: 'number'
          },
          message: 'Meta set successfully'
        }
      };

      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await client.setMeta('user', 'carl', 'score', 100, { dataType: 'number' });

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/user/carl/score',
        {
          value: 100,
          dataType: 'number'
        }
      );

      expect(result).toEqual(mockResponse.data);
    });

    test('должен установить мета-тег с объектом', async () => {
      const metaValue = { status: 'active', priority: 'high' };
      const mockResponse = {
        data: {
          data: {
            tenantId: 'tnt_test',
            entityType: 'dialog',
            entityId: 'dlg_123',
            key: 'settings',
            value: metaValue,
            dataType: 'object'
          },
          message: 'Meta set successfully'
        }
      };

      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await client.setMeta('dialog', 'dlg_123', 'settings', metaValue, { dataType: 'object' });

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/dialog/dlg_123/settings',
        {
          value: metaValue,
          dataType: 'object'
        }
      );

      expect(result).toEqual(mockResponse.data);
    });

    test('должен установить мета-тег с массивом', async () => {
      const metaValue = ['tag1', 'tag2', 'tag3'];
      const mockResponse = {
        data: {
          data: {
            tenantId: 'tnt_test',
            entityType: 'message',
            entityId: 'msg_123',
            key: 'tags',
            value: metaValue,
            dataType: 'array'
          },
          message: 'Meta set successfully'
        }
      };

      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await client.setMeta('message', 'msg_123', 'tags', metaValue, { dataType: 'array' });

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/message/msg_123/tags',
        {
          value: metaValue,
          dataType: 'array'
        }
      );

      expect(result).toEqual(mockResponse.data);
    });

    test('должен установить мета-тег с boolean значением', async () => {
      const mockResponse = {
        data: {
          data: {
            tenantId: 'tnt_test',
            entityType: 'user',
            entityId: 'carl',
            key: 'isVerified',
            value: true,
            dataType: 'boolean'
          },
          message: 'Meta set successfully'
        }
      };

      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await client.setMeta('user', 'carl', 'isVerified', true, { dataType: 'boolean' });

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/user/carl/isVerified',
        {
          value: true,
          dataType: 'boolean'
        }
      );

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Обратная совместимость со старым форматом', () => {
    test('должен поддерживать старый формат с объектом {value, dataType}', async () => {
      const mockResponse = {
        data: {
          data: {
            tenantId: 'tnt_test',
            entityType: 'message',
            entityId: 'msg_123',
            key: 'state',
            value: 'verified',
            dataType: 'string'
          },
          message: 'Meta set successfully'
        }
      };

      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await client.setMeta('message', 'msg_123', 'state', { value: 'verified', dataType: 'string' });

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/message/msg_123/state',
        {
          value: 'verified',
          dataType: 'string'
        }
      );

      expect(result).toEqual(mockResponse.data);
    });

    test('должен использовать dataType из options при старом формате', async () => {
      const mockResponse = {
        data: {
          data: {
            tenantId: 'tnt_test',
            entityType: 'user',
            entityId: 'carl',
            key: 'score',
            value: 100,
            dataType: 'number'
          },
          message: 'Meta set successfully'
        }
      };

      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await client.setMeta('user', 'carl', 'score', { value: 100 }, { dataType: 'number' });

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/user/carl/score',
        {
          value: 100,
          dataType: 'number'
        }
      );

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('DialogMember entityId формат', () => {
    test('должен корректно обрабатывать составной entityId для dialogMember', async () => {
      const mockResponse = {
        data: {
          data: {
            tenantId: 'tnt_test',
            entityType: 'dialogMember',
            entityId: 'dlg_123:carl',
            key: 'role',
            value: 'admin',
            dataType: 'string'
          },
          message: 'Meta set successfully'
        }
      };

      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await client.setMeta('dialogMember', 'dlg_123:carl', 'role', 'admin');

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/dialogMember/dlg_123:carl/role',
        {
          value: 'admin'
        }
      );

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Обработка ошибок', () => {
    test('должен пробросить ошибку при 404 (entity not found)', async () => {
      const error = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: {
            error: 'Not Found',
            message: 'Message not found'
          }
        }
      };

      mockAxiosInstance.put.mockRejectedValue(error);

      await expect(
        client.setMeta('message', 'msg_nonexistent', 'state', 'verified')
      ).rejects.toEqual(error);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/message/msg_nonexistent/state',
        {
          value: 'verified'
        }
      );
    });

    test('должен пробросить ошибку при 400 (validation error)', async () => {
      const error = {
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: {
            error: 'Bad Request',
            message: 'Invalid dataType'
          }
        }
      };

      mockAxiosInstance.put.mockRejectedValue(error);

      await expect(
        client.setMeta('message', 'msg_123', 'state', 'verified', { dataType: 'invalid' })
      ).rejects.toEqual(error);
    });

    test('должен пробросить ошибку при сетевой ошибке', async () => {
      const error = new Error('Network Error');
      mockAxiosInstance.put.mockRejectedValue(error);

      await expect(
        client.setMeta('message', 'msg_123', 'state', 'verified')
      ).rejects.toThrow('Network Error');
    });
  });

  describe('Различные типы сущностей', () => {
    test('должен работать с user', async () => {
      const mockResponse = { data: { data: {}, message: 'Meta set successfully' } };
      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      await client.setMeta('user', 'carl', 'theme', 'dark');

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/user/carl/theme',
        { value: 'dark' }
      );
    });

    test('должен работать с dialog', async () => {
      const mockResponse = { data: { data: {}, message: 'Meta set successfully' } };
      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      await client.setMeta('dialog', 'dlg_123', 'channelType', 'whatsapp');

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/dialog/dlg_123/channelType',
        { value: 'whatsapp' }
      );
    });

    test('должен работать с message', async () => {
      const mockResponse = { data: { data: {}, message: 'Meta set successfully' } };
      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      await client.setMeta('message', 'msg_123', 'state', 'verified');

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/message/msg_123/state',
        { value: 'verified' }
      );
    });

    test('должен работать с tenant', async () => {
      const mockResponse = { data: { data: {}, message: 'Meta set successfully' } };
      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      await client.setMeta('tenant', 'tnt_test', 'plan', 'premium');

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/tenant/tnt_test/plan',
        { value: 'premium' }
      );
    });

    test('должен работать с system', async () => {
      const mockResponse = { data: { data: {}, message: 'Meta set successfully' } };
      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      await client.setMeta('system', 'config', 'maintenance', false);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/system/config/maintenance',
        { value: false }
      );
    });
  });

  describe('Значения по умолчанию', () => {
    test('должен использовать dataType="string" по умолчанию если не указан', async () => {
      const mockResponse = { data: { data: {}, message: 'Meta set successfully' } };
      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      await client.setMeta('message', 'msg_123', 'state', 'verified');

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/meta/message/msg_123/state',
        { value: 'verified' }
      );
    });
  });
});

