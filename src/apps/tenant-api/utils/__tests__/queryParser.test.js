import { parseFilter, parseFilters, extractMetaFilters, parseMemberSort } from '../queryParser.js';

describe('queryParser', () => {
  describe('parseFilter', () => {
    test('should return empty object for empty string', () => {
      expect(parseFilter('')).toEqual({});
      expect(parseFilter(null)).toEqual({});
      expect(parseFilter(undefined)).toEqual({});
    });

    test('should parse simple eq filter', () => {
      const result = parseFilter('(status,eq,active)');
      expect(result).toEqual({ status: 'active' });
    });

    test('should parse in filter with array', () => {
      const result = parseFilter('(status,in,[active,pending])');
      expect(result).toEqual({ status: { $in: ['active', 'pending'] } });
    });

    test('should parse ne filter', () => {
      const result = parseFilter('(status,ne,deleted)');
      expect(result).toEqual({ status: { $ne: 'deleted' } });
    });

    test('should parse nin filter', () => {
      const result = parseFilter('(status,nin,[deleted,archived])');
      expect(result).toEqual({ status: { $nin: ['deleted', 'archived'] } });
    });

    test('should parse all filter', () => {
      const result = parseFilter('(member,all,[alice,bob])');
      expect(result).toEqual({ member: { $all: ['alice', 'bob'] } });
    });

    test('should parse numeric values', () => {
      const result = parseFilter('(age,gte,18)');
      expect(result).toEqual({ age: { $gte: 18 } });
    });

    test('should parse decimal numbers', () => {
      const result = parseFilter('(price,lt,99.99)');
      expect(result).toEqual({ price: { $lt: 99.99 } });
    });

    test('should parse negative numbers', () => {
      const result = parseFilter('(temperature,lt,-10)');
      expect(result).toEqual({ temperature: { $lt: -10 } });
    });

    test('should parse boolean values', () => {
      expect(parseFilter('(isActive,eq,true)')).toEqual({ isActive: true });
      expect(parseFilter('(isActive,eq,false)')).toEqual({ isActive: false });
    });

    test('should parse null value', () => {
      const result = parseFilter('(deletedAt,eq,null)');
      expect(result).toEqual({ deletedAt: null });
    });

    test('should parse nested field (meta.type)', () => {
      const result = parseFilter('(meta.type,eq,internal)');
      expect(result).toEqual({ meta: { type: 'internal' } });
    });

    test('should parse nested field with operator', () => {
      const result = parseFilter('(meta.channelType,ne,telegram)');
      expect(result).toEqual({ meta: { channelType: { $ne: 'telegram' } } });
    });

    test('should parse comparison operators', () => {
      expect(parseFilter('(age,gt,18)')).toEqual({ age: { $gt: 18 } });
      expect(parseFilter('(age,gte,18)')).toEqual({ age: { $gte: 18 } });
      expect(parseFilter('(age,lt,65)')).toEqual({ age: { $lt: 65 } });
      expect(parseFilter('(age,lte,65)')).toEqual({ age: { $lte: 65 } });
    });

    test('should parse regex operator', () => {
      const result = parseFilter('(name,regex,^John)');
      expect(result).toEqual({ name: { $regex: '^John', $options: 'i' } });
    });

    test('should strip inline case-insensitive flag from regex operator', () => {
      const result = parseFilter('(name,regex,(?i).*john.*)');
      expect(result).toEqual({ name: { $regex: '.*john.*', $options: 'i' } });
    });

    test('should default to case-insensitive regex when value is not a string', () => {
      const result = parseFilter('(name,regex,123)');
      expect(result).toEqual({ name: { $regex: 123, $options: 'i' } });
    });

    test('should parse exists operator', () => {
      const result = parseFilter('(email,exists,true)');
      expect(result).toEqual({ email: { $exists: true } });
    });

    test('should parse date strings for timestamp fields', () => {
      const result = parseFilter('(createdAt,eq,2025-10-21)');
      expect(result.createdAt).toBeGreaterThan(0);
      expect(typeof result.createdAt).toBe('number');
    });

    test('should parse ISO date strings for timestamp fields', () => {
      const result = parseFilter('(createdAt,eq,2025-10-21T10:30:00Z)');
      expect(result.createdAt).toBeGreaterThan(0);
      expect(typeof result.createdAt).toBe('number');
    });

    test('should parse quoted strings', () => {
      const result = parseFilter('(name,eq,"John Doe")');
      expect(result).toEqual({ name: 'John Doe' });
    });

    test('should parse single quoted strings', () => {
      const result = parseFilter("(name,eq,'John Doe')");
      expect(result).toEqual({ name: 'John Doe' });
    });

    test('should parse JSON format', () => {
      const result = parseFilter('{"status":"active"}');
      expect(result).toEqual({ status: 'active' });
    });

    test('should throw error for invalid JSON format', () => {
      expect(() => parseFilter('{invalid json}')).toThrow('Invalid JSON filter format');
    });

    test('should throw error for unsupported operator', () => {
      expect(() => parseFilter('(status,unknown,value)')).toThrow('Unsupported operator');
    });

    test('should handle whitespace in filter string', () => {
      const result = parseFilter('  (status,eq,active)  ');
      expect(result).toEqual({ status: 'active' });
    });

    test('should handle whitespace in array values', () => {
      const result = parseFilter('(status,in,[ active , pending ])');
      expect(result).toEqual({ status: { $in: ['active', 'pending'] } });
    });
  });

  describe('parseFilters', () => {
    test('should return empty object for empty string', () => {
      expect(parseFilters('')).toEqual({});
      expect(parseFilters(null)).toEqual({});
      expect(parseFilters(undefined)).toEqual({});
    });

    test('should parse single filter', () => {
      const result = parseFilters('(status,eq,active)');
      expect(result).toEqual({ status: 'active' });
    });

    test('should parse multiple filters separated by &', () => {
      const result = parseFilters('(status,eq,active)&(age,gte,18)');
      expect(result).toEqual({
        status: 'active',
        age: { $gte: 18 }
      });
    });

    test('should handle multiple filters with same field using $and', () => {
      // When same field appears multiple times, first value is kept and second goes to $and
      const result = parseFilters('(status,eq,active)&(status,ne,deleted)');
      expect(result.status).toBe('active');
      expect(result.$and).toBeDefined();
      expect(result.$and).toHaveLength(1);
      expect(result.$and[0].status).toEqual({ $ne: 'deleted' });
    });

    test('should parse complex filters with nested fields', () => {
      // When parsing nested fields from different filters, first creates meta object, second goes to $and
      const result = parseFilters('(meta.type,eq,internal)&(meta.channelType,eq,whatsapp)');
      // First filter creates meta.type, second creates $and with meta.channelType
      expect(result.meta).toEqual({ type: 'internal' });
      expect(result.$and).toBeDefined();
      expect(result.$and).toHaveLength(1);
      expect(result.$and[0].meta.channelType).toBe('whatsapp');
    });

    test('should parse JSON format', () => {
      const result = parseFilters('{"status":"active","age":{"$gte":18}}');
      expect(result).toEqual({
        status: 'active',
        age: { $gte: 18 }
      });
    });

    test('should handle filters with arrays', () => {
      const result = parseFilters('(status,in,[active,pending])&(tags,in,[urgent,important])');
      expect(result).toEqual({
        status: { $in: ['active', 'pending'] },
        tags: { $in: ['urgent', 'important'] }
      });
    });

    test('should handle member filters', () => {
      const result = parseFilters('(member,in,[alice,bob])');
      expect(result).toEqual({
        member: { $in: ['alice', 'bob'] }
      });
    });

    test('should handle member all filters', () => {
      const result = parseFilters('(member,all,[alice,bob,eve])');
      expect(result).toEqual({
        member: { $all: ['alice', 'bob', 'eve'] }
      });
    });

    test('should handle member ne filters', () => {
      const result = parseFilters('(member,ne,carl)');
      expect(result).toEqual({
        member: { $ne: 'carl' }
      });
    });

    test('should handle member nin filters', () => {
      const result = parseFilters('(member,nin,[carl,marta])');
      expect(result).toEqual({
        member: { $nin: ['carl', 'marta'] }
      });
    });
  });

  describe('extractMetaFilters', () => {
    test('should extract meta filters from filter object', () => {
      const filter = {
        'meta.type': 'internal',
        'meta.channelType': 'whatsapp',
        status: 'active'
      };
      const result = extractMetaFilters(filter);
      expect(result.metaFilters).toEqual({
        type: 'internal',
        channelType: 'whatsapp'
      });
      expect(result.regularFilters).toEqual({
        status: 'active'
      });
      expect(result.memberFilters).toEqual({});
    });

    test('should extract old format meta filters', () => {
      const filter = {
        meta: {
          type: 'internal',
          channelType: 'whatsapp'
        },
        status: 'active'
      };
      const result = extractMetaFilters(filter);
      expect(result.metaFilters).toEqual({
        type: 'internal',
        channelType: 'whatsapp'
      });
      expect(result.regularFilters).toEqual({
        status: 'active'
      });
    });

    test('should extract member filters', () => {
      const filter = {
        member: { $in: ['alice', 'bob'] },
        status: 'active'
      };
      const result = extractMetaFilters(filter);
      expect(result.memberFilters).toEqual({
        member: { $in: ['alice', 'bob'] }
      });
      expect(result.regularFilters).toEqual({
        status: 'active'
      });
      expect(result.metaFilters).toEqual({});
    });

    test('should extract string member filter', () => {
      const filter = {
        member: 'carl',
        status: 'active'
      };
      const result = extractMetaFilters(filter);
      expect(result.memberFilters).toEqual({
        member: 'carl'
      });
      expect(result.regularFilters).toEqual({
        status: 'active'
      });
    });

    test('should extract member filters with $all', () => {
      const filter = {
        member: { $all: ['alice', 'bob'] },
        status: 'active'
      };
      const result = extractMetaFilters(filter);
      expect(result.memberFilters).toEqual({
        member: { $all: ['alice', 'bob'] }
      });
    });

    test('should extract member filters with $ne', () => {
      const filter = {
        member: { $ne: 'carl' },
        status: 'active'
      };
      const result = extractMetaFilters(filter);
      expect(result.memberFilters).toEqual({
        member: { $ne: 'carl' }
      });
    });

    test('should extract member filters with $nin', () => {
      const filter = {
        member: { $nin: ['carl', 'marta'] },
        status: 'active'
      };
      const result = extractMetaFilters(filter);
      expect(result.memberFilters).toEqual({
        member: { $nin: ['carl', 'marta'] }
      });
    });

    test('should handle $and conditions', () => {
      const filter = {
        $and: [
          { 'meta.type': 'internal' },
          { member: { $in: ['alice'] } }
        ],
        status: 'active'
      };
      const result = extractMetaFilters(filter);
      expect(result.metaFilters).toEqual({
        type: 'internal'
      });
      expect(result.memberFilters).toEqual({
        member: { $in: ['alice'] }
      });
      expect(result.regularFilters).toEqual({
        status: 'active'
      });
    });

    test('should handle nested $and conditions', () => {
      const filter = {
        $and: [
          {
            $and: [
              { 'meta.type': 'internal' },
              { member: 'alice' }
            ]
          },
          { status: 'active' }
        ]
      };
      const result = extractMetaFilters(filter);
      expect(result.metaFilters).toEqual({
        type: 'internal'
      });
      expect(result.memberFilters).toEqual({
        member: 'alice'
      });
      expect(result.regularFilters).toEqual({});
    });

    test('should handle empty filter', () => {
      const result = extractMetaFilters({});
      expect(result.metaFilters).toEqual({});
      expect(result.regularFilters).toEqual({});
      expect(result.memberFilters).toEqual({});
    });
  });

  describe('parseMemberSort', () => {
    test('should parse member sort string', () => {
      const result = parseMemberSort('(member[carl].unreadCount,desc)');
      expect(result).toEqual({
        userId: 'carl',
        field: 'unreadCount',
        direction: -1,
        originalString: '(member[carl].unreadCount,desc)'
      });
    });

    test('should parse member sort with asc direction', () => {
      const result = parseMemberSort('(member[alice].lastSeenAt,asc)');
      expect(result).toEqual({
        userId: 'alice',
        field: 'lastSeenAt',
        direction: 1,
        originalString: '(member[alice].lastSeenAt,asc)'
      });
    });

    test('should parse member sort with numeric directions', () => {
      expect(parseMemberSort('(member[bob].unreadCount,1)')).toEqual({
        userId: 'bob',
        field: 'unreadCount',
        direction: 1,
        originalString: '(member[bob].unreadCount,1)'
      });
      expect(parseMemberSort('(member[bob].unreadCount,-1)')).toEqual({
        userId: 'bob',
        field: 'unreadCount',
        direction: -1,
        originalString: '(member[bob].unreadCount,-1)'
      });
    });

    test('should return null for invalid format', () => {
      expect(parseMemberSort('invalid')).toBeNull();
      expect(parseMemberSort('(member.unreadCount,desc)')).toBeNull();
      expect(parseMemberSort('(member[carl].unreadCount,invalid)')).toBeNull();
    });

    test('should return null for empty string', () => {
      expect(parseMemberSort('')).toBeNull();
      expect(parseMemberSort(null)).toBeNull();
      expect(parseMemberSort(undefined)).toBeNull();
    });

    test('should handle whitespace in sort string', () => {
      // Note: parseMemberSort trims the string before parsing
      const result = parseMemberSort('  (member[carl].unreadCount,desc)  ');
      expect(result).toEqual({
        userId: 'carl',
        field: 'unreadCount',
        direction: -1,
        originalString: '(member[carl].unreadCount,desc)' // trimmed
      });
    });
  });
});

