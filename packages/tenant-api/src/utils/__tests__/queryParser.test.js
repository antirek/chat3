import { parseFilter, parseFilters, extractMetaFilters, parseMemberSort, parseSort, FilterValidationError } from '../queryParser.js';

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

    test('should reject meta key with dot (use underscore)', () => {
      expect(() => parseFilter('(meta.contact.phone,eq,+7999)')).toThrow(FilterValidationError);
      expect(() => parseFilter('(meta.contact.phone,eq,+7999)')).toThrow(/Meta key cannot contain a dot/);
    });

    test('should accept meta key with underscore', () => {
      const result = parseFilter('(meta.contact_phone,eq,+7999)');
      expect(result).toEqual({ meta: { contact_phone: '+7999' } });
    });

    test('should reject topic.meta key with dot', () => {
      expect(() => parseFilter('(topic.meta.contact.phone,eq,x)')).toThrow(FilterValidationError);
      expect(() => parseFilter('(topic.meta.contact.phone,eq,x)')).toThrow(/Topic meta key/);
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
      // В TypeScript версии число конвертируется в строку для regex
      expect(result).toEqual({ name: { $regex: '123', $options: 'i' } });
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

    test('should parse OR: (type,eq,a)|(type,eq,b) -> $or', () => {
      const result = parseFilters('(type,eq,a)|(type,eq,b)');
      expect(result.$or).toBeDefined();
      expect(result.$or).toHaveLength(2);
      expect(result.$or[0]).toEqual({ type: 'a' });
      expect(result.$or[1]).toEqual({ type: 'b' });
    });

    test('should parse ((a)&(b))|(c) -> $or with AND branch', () => {
      const result = parseFilters('((type,eq,a)&(senderId,eq,c))|(type,eq,system)');
      expect(result.$or).toBeDefined();
      expect(result.$or).toHaveLength(2);
      expect(result.$or[0].type).toBe('a');
      expect(result.$or[0].senderId).toBe('c');
      expect(result.$or[1]).toEqual({ type: 'system' });
    });

    test('should reject a&b|c without parentheses (mixed & and | at depth 0)', () => {
      expect(() => parseFilters('(type,eq,a)&(senderId,eq,c)|(type,eq,system)')).toThrow(FilterValidationError);
      expect(() => parseFilters('(type,eq,a)&(senderId,eq,c)|(type,eq,system)')).toThrow(/use parentheses to group/);
    });

    test('should reject (a&b|c) mixed operators in one group', () => {
      expect(() => parseFilters('((type,eq,a)&(senderId,eq,c)|(type,eq,system))')).toThrow(FilterValidationError);
      expect(() => parseFilters('((type,eq,a)&(senderId,eq,c)|(type,eq,system))')).toThrow(/use parentheses to group/);
    });

    test('should reject more than 5 OR branches', () => {
      const sixOr = '(a,eq,1)|(a,eq,2)|(a,eq,3)|(a,eq,4)|(a,eq,5)|(a,eq,6)';
      expect(() => parseFilters(sixOr)).toThrow(FilterValidationError);
      expect(() => parseFilters(sixOr)).toThrow(/too many OR branches/);
    });

    test('should reject more than 5 operands in AND group', () => {
      const sixAnd = '(a,eq,1)&(a,eq,2)&(a,eq,3)&(a,eq,4)&(a,eq,5)&(a,eq,6)';
      expect(() => parseFilters(sixAnd)).toThrow(FilterValidationError);
      expect(() => parseFilters(sixAnd)).toThrow(/too many conditions in group/);
    });

    test('should allow exactly 5 OR branches', () => {
      const fiveOr = '(a,eq,1)|(a,eq,2)|(a,eq,3)|(a,eq,4)|(a,eq,5)';
      const result = parseFilters(fiveOr);
      expect(result.$or).toHaveLength(5);
    });

    test('should allow exactly 5 AND operands', () => {
      const fiveAnd = '(a,eq,1)&(a,eq,2)&(a,eq,3)&(a,eq,4)&(a,eq,5)';
      const result = parseFilters(fiveAnd);
      expect(result.$and).toBeDefined();
      expect(result.$and.length).toBeGreaterThanOrEqual(1);
    });

    describe('OR combinations and nesting (two levels)', () => {
      test('OR with 3 branches: (a)|(b)|(c)', () => {
        const result = parseFilters('(type,eq,a)|(type,eq,b)|(type,eq,c)');
        expect(result.$or).toHaveLength(3);
        expect(result.$or[0]).toEqual({ type: 'a' });
        expect(result.$or[1]).toEqual({ type: 'b' });
        expect(result.$or[2]).toEqual({ type: 'c' });
      });

      test('OR with 4 branches: (meta.name,eq,a)|...|(meta.name,eq,d)', () => {
        const result = parseFilters('(meta.name,eq,a)|(meta.name,eq,b)|(meta.name,eq,c)|(meta.name,eq,d)');
        expect(result.$or).toHaveLength(4);
        expect(result.$or[0].meta).toEqual({ name: 'a' });
        expect(result.$or[1].meta).toEqual({ name: 'b' });
        expect(result.$or[2].meta).toEqual({ name: 'c' });
        expect(result.$or[3].meta).toEqual({ name: 'd' });
      });

      test('(a|b)|c — OR of two atoms and one atom', () => {
        const result = parseFilters('(type,eq,a)|(type,eq,b)|(type,eq,c)');
        expect(result.$or).toHaveLength(3);
        expect(result.$or.map((b) => b.type)).toEqual(['a', 'b', 'c']);
      });

      test('((a|b)|c) — outer parentheses around OR', () => {
        const result = parseFilters('((type,eq,a)|(type,eq,b)|(type,eq,c))');
        expect(result.$or).toHaveLength(3);
        expect(result.$or.map((b) => b.type)).toEqual(['a', 'b', 'c']);
      });

      test('((a&b)|c) — (AND group) OR atom', () => {
        const result = parseFilters('((status,eq,active)&(age,gte,18))|(status,eq,draft)');
        expect(result.$or).toHaveLength(2);
        expect(result.$or[0].status).toBe('active');
        expect(result.$or[0].age).toEqual({ $gte: 18 });
        expect(result.$or[1]).toEqual({ status: 'draft' });
      });

      test('((a&b)&c)|d — nested AND in first branch', () => {
        const result = parseFilters('((status,eq,active)&(age,gte,18)&(role,eq,user))|(status,eq,admin)');
        expect(result.$or).toHaveLength(2);
        expect(result.$or[0].status).toBe('active');
        expect(result.$or[0].age).toEqual({ $gte: 18 });
        expect(result.$or[0].role).toBe('user');
        expect(result.$or[1]).toEqual({ status: 'admin' });
      });

      test('(a|b|c|d)&e — AND with first operand as OR group: top-level status applies to all branches', () => {
        const result = parseFilters('((type,eq,a)|(type,eq,b)|(type,eq,c)|(type,eq,d))&(status,eq,active)');
        expect(result.$or).toBeDefined();
        expect(result.$or).toHaveLength(4);
        expect(result.status).toBe('active');
        expect(result.$or.map((b) => b.type)).toEqual(['a', 'b', 'c', 'd']);
      });

      test('(a|b)|(c|d) — OR of two OR-groups: two top-level branches, each branch is $or', () => {
        const result = parseFilters('((type,eq,a)|(type,eq,b))|((type,eq,c)|(type,eq,d))');
        expect(result.$or).toHaveLength(2);
        expect(result.$or[0].$or).toHaveLength(2);
        expect(result.$or[0].$or[0].type).toBe('a');
        expect(result.$or[0].$or[1].type).toBe('b');
        expect(result.$or[1].$or).toHaveLength(2);
        expect(result.$or[1].$or[0].type).toBe('c');
        expect(result.$or[1].$or[1].type).toBe('d');
      });

      test('single atom with outer parentheses unchanged', () => {
        const result = parseFilters('(meta.name,eq,personal)');
        expect(result.meta).toEqual({ name: 'personal' });
        expect(result.$or).toBeUndefined();
      });

      test('AND only without OR unchanged', () => {
        const result = parseFilters('(meta.name,eq,a)&(meta.channel,eq,whatsapp)');
        expect(result.meta).toBeDefined();
        expect(result.$and).toBeDefined();
        expect(result.$or).toBeUndefined();
      });

      test('reject 6 OR branches', () => {
        const six = '(x,eq,1)|(x,eq,2)|(x,eq,3)|(x,eq,4)|(x,eq,5)|(x,eq,6)';
        expect(() => parseFilters(six)).toThrow(FilterValidationError);
        expect(() => parseFilters(six)).toThrow(/too many OR branches/);
      });

      test('reject 6 operands in one AND group', () => {
        const six = '(x,eq,1)&(x,eq,2)&(x,eq,3)&(x,eq,4)&(x,eq,5)&(x,eq,6)';
        expect(() => parseFilters(six)).toThrow(FilterValidationError);
        expect(() => parseFilters(six)).toThrow(/too many conditions in group/);
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

    test('should extract meta key with underscore (contact_phone)', () => {
      const filter = {
        'meta.contact_phone': '+7999',
        status: 'active'
      };
      const result = extractMetaFilters(filter);
      expect(result.metaFilters).toEqual({
        contact_phone: '+7999'
      });
      expect(result.regularFilters).toEqual({ status: 'active' });
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

    test('should return branches when filter has $or', () => {
      const filter = {
        $or: [
          { type: 'a', 'meta.name': 'x' },
          { type: 'b' }
        ]
      };
      const result = extractMetaFilters(filter);
      expect(result.branches).toBeDefined();
      expect(result.branches).toHaveLength(2);
      expect(result.branches[0].metaFilters).toEqual({ name: 'x' });
      expect(result.branches[0].regularFilters).toEqual({ type: 'a' });
      expect(result.branches[1].metaFilters).toEqual({});
      expect(result.branches[1].regularFilters).toEqual({ type: 'b' });
    });

    test('should merge common filters into OR branches', () => {
      const filter = {
        'meta.channelId': 'whatsapp.chn_123',
        status: 'active',
        $or: [
          { 'meta.phone': 73437452389 },
          { 'meta.contact_phone': 83437452389 }
        ]
      };
      const result = extractMetaFilters(filter);
      expect(result.branches).toBeDefined();
      expect(result.branches).toHaveLength(2);
      // Первая ветка: channelId + phone
      expect(result.branches[0].metaFilters).toEqual({ channelId: 'whatsapp.chn_123', phone: 73437452389 });
      expect(result.branches[0].regularFilters).toEqual({ status: 'active' });
      // Вторая ветка: channelId + contact_phone
      expect(result.branches[1].metaFilters).toEqual({ channelId: 'whatsapp.chn_123', contact_phone: 83437452389 });
      expect(result.branches[1].regularFilters).toEqual({ status: 'active' });
    });

    test('should return branches when $or has $and in a branch', () => {
      const filter = {
        $or: [
          { $and: [{ 'meta.name': 'a' }, { 'meta.channel': 'whatsapp' }] },
          { type: 'b' }
        ]
      };
      const result = extractMetaFilters(filter);
      expect(result.branches).toBeDefined();
      expect(result.branches).toHaveLength(2);
      expect(result.branches[0].metaFilters).toEqual({ name: 'a', channel: 'whatsapp' });
      expect(result.branches[0].regularFilters).toEqual({});
      expect(result.branches[1].regularFilters).toEqual({ type: 'b' });
      expect(result.branches[1].metaFilters).toEqual({});
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
      // Note: parseMemberSort trims the string before parsing but preserves original in originalString
      const result = parseMemberSort('  (member[carl].unreadCount,desc)  ');
      expect(result).toEqual({
        userId: 'carl',
        field: 'unreadCount',
        direction: -1,
        originalString: '  (member[carl].unreadCount,desc)  ' // original string preserved
      });
    });
  });

  describe('parseSort', () => {
    test('should parse sort string with desc direction', () => {
      const result = parseSort('(createdAt,desc)');
      expect(result).toBe('-createdAt');
    });

    test('should parse sort string with asc direction', () => {
      const result = parseSort('(createdAt,asc)');
      expect(result).toBe('createdAt');
    });

    test('should parse sort string with numeric directions', () => {
      expect(parseSort('(createdAt,1)')).toBe('createdAt');
      expect(parseSort('(createdAt,-1)')).toBe('-createdAt');
    });

    test('should handle whitespace in sort string', () => {
      expect(parseSort('  (createdAt,desc)  ')).toBe('-createdAt');
      expect(parseSort('( createdAt , desc )')).toBe('-createdAt');
    });

    test('should return null for invalid format', () => {
      expect(parseSort('invalid')).toBeNull();
      expect(parseSort('createdAt,desc')).toBeNull();
      expect(parseSort('(createdAt,invalid)')).toBeNull();
      expect(parseSort('(createdAt)')).toBeNull();
    });

    test('should return null for empty string', () => {
      expect(parseSort('')).toBeNull();
      expect(parseSort(null)).toBeNull();
      expect(parseSort(undefined)).toBeNull();
    });

    test('should handle different field names', () => {
      expect(parseSort('(createdAt,desc)')).toBe('-createdAt');
      expect(parseSort('(messageId,asc)')).toBe('messageId');
      expect(parseSort('(senderId,desc)')).toBe('-senderId');
    });
  });
});

