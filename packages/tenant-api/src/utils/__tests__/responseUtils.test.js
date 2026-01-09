import { sanitizeResponse } from '../responseUtils.js';

describe('responseUtils', () => {
  describe('sanitizeResponse', () => {
    test('should remove _id, id, and __v fields', () => {
      const input = {
        _id: '123',
        id: '456',
        __v: 0,
        name: 'Test',
        status: 'active'
      };
      
      const result = sanitizeResponse(input);
      
      expect(result._id).toBeUndefined();
      expect(result.id).toBeUndefined();
      expect(result.__v).toBeUndefined();
      expect(result.name).toBe('Test');
      expect(result.status).toBe('active');
    });

    test('should remove _id from nested objects', () => {
      const input = {
        name: 'Test',
        meta: {
          _id: '123',
          type: 'internal'
        }
      };
      
      const result = sanitizeResponse(input);
      
      expect(result.meta._id).toBeUndefined();
      expect(result.meta.type).toBe('internal');
    });

    test('should remove _id from arrays', () => {
      const input = {
        items: [
          { _id: '1', name: 'Item 1' },
          { _id: '2', name: 'Item 2' }
        ]
      };
      
      const result = sanitizeResponse(input);
      
      expect(result.items[0]._id).toBeUndefined();
      expect(result.items[1]._id).toBeUndefined();
      expect(result.items[0].name).toBe('Item 1');
      expect(result.items[1].name).toBe('Item 2');
    });

    test('should format timestamp fields with 6 decimal places', () => {
      // Timestamp должен быть > 1000000000000 для форматирования
      const input = {
        createdAt: 1734567890123.123456,
        name: 'Test'
      };
      
      const result = sanitizeResponse(input);
      
      // Проверяем, что timestamp поля отформатированы как строки с 6 знаками
      expect(typeof result.createdAt).toBe('string');
      expect(result.createdAt).toMatch(/^\d+\.\d{6}$/);
      expect(result.name).toBe('Test');
    });

    test('should format all timestamp fields from TIMESTAMP_FIELDS', () => {
      // Timestamp должен быть > 1000000000000 для форматирования
      const baseTimestamp = 1734567890123;
      const input = {
        createdAt: baseTimestamp + 0.1,
        lastSeenAt: baseTimestamp + 0.3,
        lastMessageAt: baseTimestamp + 0.4,
        publishedAt: baseTimestamp + 0.5,
        readAt: baseTimestamp + 0.6,
        deliveredAt: baseTimestamp + 0.7,
        joinedAt: baseTimestamp + 0.01,
        expiresAt: baseTimestamp + 0.11,
        lastUsedAt: baseTimestamp + 0.12,
        lastInteractionAt: baseTimestamp + 0.13,
        statusTime: baseTimestamp + 0.8, // Не в TIMESTAMP_FIELDS, не должно форматироваться
        reactionTime: baseTimestamp + 0.9, // Не в TIMESTAMP_FIELDS, не должно форматироваться
        name: 'Test'
      };
      
      const result = sanitizeResponse(input);
      
      // Проверяем, что все timestamp поля отформатированы как строки
      expect(typeof result.createdAt).toBe('string');
      expect(result.createdAt).toMatch(/^\d+\.\d{6}$/);
      expect(typeof result.lastSeenAt).toBe('string');
      expect(result.lastSeenAt).toMatch(/^\d+\.\d{6}$/);
      expect(typeof result.lastMessageAt).toBe('string');
      expect(result.lastMessageAt).toMatch(/^\d+\.\d{6}$/);
      expect(typeof result.publishedAt).toBe('string');
      expect(result.publishedAt).toMatch(/^\d+\.\d{6}$/);
      expect(typeof result.readAt).toBe('string');
      expect(result.readAt).toMatch(/^\d+\.\d{6}$/);
      expect(typeof result.deliveredAt).toBe('string');
      expect(result.deliveredAt).toMatch(/^\d+\.\d{6}$/);
      expect(typeof result.joinedAt).toBe('string');
      expect(result.joinedAt).toMatch(/^\d+\.\d{6}$/);
      expect(typeof result.expiresAt).toBe('string');
      expect(result.expiresAt).toMatch(/^\d+\.\d{6}$/);
      expect(typeof result.lastUsedAt).toBe('string');
      expect(result.lastUsedAt).toMatch(/^\d+\.\d{6}$/);
      expect(typeof result.lastInteractionAt).toBe('string');
      expect(result.lastInteractionAt).toMatch(/^\d+\.\d{6}$/);
      // statusTime и reactionTime не в TIMESTAMP_FIELDS, не должны форматироваться
      expect(typeof result.statusTime).toBe('number');
      expect(typeof result.reactionTime).toBe('number');
      expect(result.name).toBe('Test');
    });

    test('should pad timestamp fields with zeros', () => {
      // Timestamp должен быть > 1000000000000 для форматирования
      const baseTimestamp = 1734567890123;
      const input = {
        createdAt: baseTimestamp,
      };
      
      const result = sanitizeResponse(input);
      
      expect(typeof result.createdAt).toBe('string');
      expect(result.createdAt).toBe(`${baseTimestamp}.000000`);
      // Проверяем формат, а не точное значение (может быть небольшое округление)
    });

    test('should not format timestamps less than threshold', () => {
      // Timestamp < 1000000000000 не должен форматироваться
      const input = {
        createdAt: 123456789012.123456, // меньше порога
      };
      
      const result = sanitizeResponse(input);
      
      // createdAt не форматируется (меньше порога)
      expect(typeof result.createdAt).toBe('number');
      expect(result.createdAt).toBe(123456789012.123456);
      
      // updatedAt форматируется (больше порога)
    });

    test('should handle nested timestamp fields', () => {
      // Timestamp должен быть > 1000000000000 для форматирования
      const baseTimestamp = 1734567890123;
      const input = {
        name: 'Test',
        metadata: {
          createdAt: baseTimestamp + 0.123456,
        }
      };
      
      const result = sanitizeResponse(input);
      
      expect(typeof result.metadata.createdAt).toBe('string');
      expect(result.metadata.createdAt).toMatch(/^\d+\.\d{6}$/);
    });

    test('should handle timestamp fields in arrays', () => {
      // Timestamp должен быть > 1000000000000 для форматирования
      const baseTimestamp = 1734567890123;
      const input = {
        items: [
          { createdAt: baseTimestamp + 0.1, name: 'Item 1' },
          { createdAt: baseTimestamp + 0.2, name: 'Item 2' }
        ]
      };
      
      const result = sanitizeResponse(input);
      
      expect(typeof result.items[0].createdAt).toBe('string');
      expect(result.items[0].createdAt).toMatch(/^\d+\.\d{6}$/);
      expect(typeof result.items[1].createdAt).toBe('string');
      expect(result.items[1].createdAt).toMatch(/^\d+\.\d{6}$/);
      expect(result.items[0].name).toBe('Item 1');
      expect(result.items[1].name).toBe('Item 2');
    });

    test('should not format non-timestamp number fields', () => {
      // Timestamp должен быть > 1000000000000 для форматирования
      const baseTimestamp = 1734567890123;
      const input = {
        age: 25,
        count: 100,
        price: 99.99,
        createdAt: baseTimestamp + 0.123456
      };
      
      const result = sanitizeResponse(input);
      
      expect(result.age).toBe(25);
      expect(result.count).toBe(100);
      expect(result.price).toBe(99.99);
      expect(typeof result.createdAt).toBe('string');
      expect(result.createdAt).toMatch(/^\d+\.\d{6}$/);
    });

    test('should handle null and undefined values', () => {
      // Timestamp должен быть > 1000000000000 для форматирования
      const baseTimestamp = 1734567890123;
      const input = {
        name: 'Test',
        value: null,
        optional: undefined,
        createdAt: baseTimestamp + 0.123456
      };
      
      const result = sanitizeResponse(input);
      
      expect(result.name).toBe('Test');
      expect(result.value).toBeNull();
      expect(result.optional).toBeUndefined();
      expect(typeof result.createdAt).toBe('string');
      expect(result.createdAt).toMatch(/^\d+\.\d{6}$/);
    });

    test('should handle empty objects', () => {
      const input = {};
      const result = sanitizeResponse(input);
      
      expect(result).toEqual({});
    });

    test('should handle empty arrays', () => {
      const input = {
        items: []
      };
      
      const result = sanitizeResponse(input);
      
      expect(result.items).toEqual([]);
    });

    test('should handle deeply nested structures', () => {
      // Timestamp должен быть > 1000000000000 для форматирования
      const baseTimestamp = 1734567890123;
      const input = {
        level1: {
          _id: '1',
          level2: {
            _id: '2',
            level3: {
              _id: '3',
              createdAt: baseTimestamp + 0.123456,
              name: 'Deep'
            }
          }
        }
      };
      
      const result = sanitizeResponse(input);
      
      expect(result.level1._id).toBeUndefined();
      expect(result.level1.level2._id).toBeUndefined();
      expect(result.level1.level2.level3._id).toBeUndefined();
      expect(typeof result.level1.level2.level3.createdAt).toBe('string');
      expect(result.level1.level2.level3.createdAt).toMatch(/^\d+\.\d{6}$/);
      expect(result.level1.level2.level3.name).toBe('Deep');
    });

    test('should handle arrays with nested objects', () => {
      // Timestamp должен быть > 1000000000000 для форматирования
      const baseTimestamp = 1734567890123;
      const input = {
        users: [
          {
            _id: '1',
            name: 'User 1',
            createdAt: baseTimestamp + 0.1,
            meta: {
              _id: 'm1',
              type: 'admin'
            }
          },
          {
            _id: '2',
            name: 'User 2',
            createdAt: baseTimestamp + 0.2
          }
        ]
      };
      
      const result = sanitizeResponse(input);
      
      expect(result.users[0]._id).toBeUndefined();
      expect(typeof result.users[0].createdAt).toBe('string');
      expect(result.users[0].createdAt).toMatch(/^\d+\.\d{6}$/);
      expect(result.users[0].name).toBe('User 1');
      expect(result.users[0].meta._id).toBeUndefined();
      expect(result.users[0].meta.type).toBe('admin');
      
      expect(result.users[1]._id).toBeUndefined();
      expect(typeof result.users[1].createdAt).toBe('string');
      expect(result.users[1].createdAt).toMatch(/^\d+\.\d{6}$/);
      expect(result.users[1].name).toBe('User 2');
    });

    test('should handle string timestamp fields (should not format)', () => {
      // Timestamp должен быть > 1000000000000 для форматирования
      const baseTimestamp = 1734567890123;
      const input = {
        createdAt: `${baseTimestamp}.123456`, // уже строка
      };
      
      const result = sanitizeResponse(input);
      
      // Строковые timestamp не должны форматироваться (проверка только для чисел)
      expect(result.createdAt).toBe(`${baseTimestamp}.123456`);
    });

    test('should handle very large timestamp values', () => {
      const input = {
        createdAt: 9999999999999.123456
      };
      
      const result = sanitizeResponse(input);
      
      expect(typeof result.createdAt).toBe('string');
      expect(result.createdAt).toMatch(/^9999999999999\.\d{6}$/);
      // Может быть небольшое округление при форматировании
    });

    test('should handle timestamp fields with exactly 6 decimal places', () => {
      // Timestamp должен быть > 1000000000000 для форматирования
      const baseTimestamp = 1734567890123;
      const input = {
        createdAt: baseTimestamp + 0.123456
      };
      
      const result = sanitizeResponse(input);
      
      expect(typeof result.createdAt).toBe('string');
      expect(result.createdAt).toMatch(/^\d+\.\d{6}$/);
      // Проверяем, что содержит правильную дробную часть
      const parts = result.createdAt.split('.');
      expect(parts[1].length).toBe(6);
    });

    test('should handle timestamp fields with more than 6 decimal places', () => {
      // Timestamp должен быть > 1000000000000 для форматирования
      const baseTimestamp = 1734567890123;
      const input = {
        createdAt: baseTimestamp + 0.123456789
      };
      
      const result = sanitizeResponse(input);
      
      // Должно быть округлено до 6 знаков и возвращено как строка
      expect(typeof result.createdAt).toBe('string');
      expect(result.createdAt).toMatch(/^\d+\.\d{6}$/);
      const parts = result.createdAt.split('.');
      expect(parts[1].length).toBe(6);
    });

    test('should handle complex real-world object structure', () => {
      // Timestamp должен быть > 1000000000000 для форматирования
      const baseTimestamp = 1734567890123;
      const input = {
        _id: 'dialog1',
        dialogId: 'dlg_123',
        
        createdAt: baseTimestamp + 0.123456,
        members: [
          {
            _id: 'member1',
            userId: 'user1',
            joinedAt: baseTimestamp + 0.1,
            lastSeenAt: baseTimestamp + 0.2,
            unreadCount: 5
          }
        ],
        lastMessage: {
          _id: 'msg1',
          messageId: 'msg_123',
          content: 'Hello',
          createdAt: baseTimestamp + 0.3,
          senderId: 'user1'
        },
        meta: {
          _id: 'meta1',
          type: 'internal',
          channelType: 'whatsapp'
        }
      };
      
      const result = sanitizeResponse(input);
      
      // Проверяем удаление _id
      expect(result._id).toBeUndefined();
      expect(result.members[0]._id).toBeUndefined();
      expect(result.lastMessage._id).toBeUndefined();
      expect(result.meta._id).toBeUndefined();
      
      // Проверяем форматирование timestamp полей как строк
      expect(typeof result.createdAt).toBe('string');
      expect(result.createdAt).toMatch(/^\d+\.\d{6}$/);
      expect(typeof result.members[0].joinedAt).toBe('string');
      expect(result.members[0].joinedAt).toMatch(/^\d+\.\d{6}$/);
      expect(typeof result.members[0].lastSeenAt).toBe('string');
      expect(result.members[0].lastSeenAt).toMatch(/^\d+\.\d{6}$/);
      expect(typeof result.lastMessage.createdAt).toBe('string');
      expect(result.lastMessage.createdAt).toMatch(/^\d+\.\d{6}$/);
      
      // Проверяем сохранение остальных полей
      expect(result.dialogId).toBe('dlg_123');
      expect(result.members[0].userId).toBe('user1');
      expect(result.members[0].unreadCount).toBe(5);
      expect(result.lastMessage.messageId).toBe('msg_123');
      expect(result.lastMessage.content).toBe('Hello');
      expect(result.meta.type).toBe('internal');
      expect(result.meta.channelType).toBe('whatsapp');
    });

    test('should handle Date objects', () => {
      const date = new Date(1734567890123);
      const input = {
        createdAt: date,
        name: 'Test'
      };
      
      const result = sanitizeResponse(input);
      
      // Date объекты должны оставаться Date объектами
      expect(result.createdAt instanceof Date).toBe(true);
      expect(result.name).toBe('Test');
    });

    test('should handle Buffer objects', () => {
      const buffer = Buffer.from('test');
      const input = {
        data: buffer,
        name: 'Test'
      };
      
      const result = sanitizeResponse(input);
      
      // Buffer должен оставаться Buffer
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(result.name).toBe('Test');
    });

    test('should handle ObjectId-like objects', () => {
      const objectId = {
        _bsontype: 'ObjectID',
        toString: () => '507f1f77bcf86cd799439011'
      };
      
      const input = {
        _id: objectId, // _id будет удален
        userId: objectId, // userId должен конвертироваться в строку
        name: 'Test'
      };
      
      const result = sanitizeResponse(input);
      
      // _id должен быть удален
      expect(result._id).toBeUndefined();
      // ObjectId в других полях должен конвертироваться в строку
      expect(result.userId).toBe('507f1f77bcf86cd799439011');
      expect(result.name).toBe('Test');
    });

    test('should handle primitives', () => {
      expect(sanitizeResponse(null)).toBeNull();
      expect(sanitizeResponse(undefined)).toBeUndefined();
      expect(sanitizeResponse(123)).toBe(123);
      expect(sanitizeResponse('string')).toBe('string');
      expect(sanitizeResponse(true)).toBe(true);
    });

    test('should handle mixed arrays', () => {
      const baseTimestamp = 1734567890123;
      const input = {
        items: [
          { createdAt: baseTimestamp + 0.1, name: 'Item 1' },
          null,
          { createdAt: baseTimestamp + 0.2, name: 'Item 2' },
          undefined,
          'string',
          123
        ]
      };
      
      const result = sanitizeResponse(input);
      
      expect(result.items[0].createdAt).toMatch(/^\d+\.\d{6}$/);
      expect(result.items[0].name).toBe('Item 1');
      expect(result.items[1]).toBeNull();
      expect(result.items[2].createdAt).toMatch(/^\d+\.\d{6}$/);
      expect(result.items[2].name).toBe('Item 2');
      expect(result.items[3]).toBeUndefined();
      expect(result.items[4]).toBe('string');
      expect(result.items[5]).toBe(123);
    });
  });
});

