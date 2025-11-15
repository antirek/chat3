import {
  createMessageSchema,
  createUserSchema,
  createTenantSchema,
  updateTenantSchema,
  setMetaSchema
} from '../schemas/bodySchemas.js';
import {
  paginationSchema,
  queryWithFilterSchema,
  userDialogsQuerySchema,
  messagesQuerySchema,
  reactionsQuerySchema
} from '../schemas/querySchemas.js';

describe('bodySchemas.createMessageSchema', () => {
  const validate = (payload) => createMessageSchema.validate(payload, { abortEarly: false });

  test('accepts internal.text with non-empty content', () => {
    const { error, value } = validate({
      senderId: 'user_1',
      type: 'internal.text',
      content: 'hello'
    });

    expect(error).toBeUndefined();
    expect(value.content).toBe('hello');
  });

  test('requires content for internal.text', () => {
    const { error } = validate({
      senderId: 'user_1',
      type: 'internal.text'
    });

    expect(error).toBeDefined();
    expect(error?.details?.[0]?.message).toContain('"content" is required');
  });

  test('allows media type with required meta.url', () => {
    const { error, value } = validate({
      senderId: 'user_1',
      type: 'internal.image',
      meta: { url: 'https://cdn.example.com/pic.jpg' }
    });

    expect(error).toBeUndefined();
    expect(value.meta).toEqual({ url: 'https://cdn.example.com/pic.jpg' });
    expect(value.content).toBe('');
  });

  test('rejects media type without meta.url', () => {
    const { error } = validate({
      senderId: 'user_1',
      type: 'internal.image'
    });

    expect(error).toBeDefined();
    const messages = error?.details?.map((detail) => detail.message) ?? [];
    expect(messages.some((message) => message.includes('"meta" is required') || message.includes('"url" is required'))).toBe(true);
  });

  test('accepts system.* message type', () => {
    const { error, value } = validate({
      senderId: 'user_1',
      type: 'system.announcement',
      content: ''
    });

    expect(error).toBeUndefined();
    expect(value.type).toBe('system.announcement');
  });

  test('rejects invalid message type', () => {
    const { error } = validate({
      senderId: 'user_1',
      type: 'invalid-type',
      content: ''
    });

    expect(error).toBeDefined();
    expect(error?.details?.[0]?.message).toContain('type must be one of the predefined internal.* values');
  });

  test('defaults meta to empty object for non-media types', () => {
    const { error, value } = validate({
      senderId: 'user_1',
      type: 'system.info',
      content: ''
    });

    expect(error).toBeUndefined();
    expect(value.meta).toEqual({});
  });

  test('accepts valid quotedMessageId', () => {
    const { error, value } = validate({
      senderId: 'user_1',
      type: 'internal.text',
      content: 'hello',
      quotedMessageId: 'msg_abc123def456ghi789jk'
    });

    expect(error).toBeUndefined();
    expect(value.quotedMessageId).toBe('msg_abc123def456ghi789jk');
  });

  test('rejects invalid quotedMessageId format', () => {
    const { error } = validate({
      senderId: 'user_1',
      type: 'internal.text',
      content: 'hello',
      quotedMessageId: 'invalid_format'
    });

    expect(error).toBeDefined();
    expect(error?.details?.[0]?.message).toContain('quotedMessageId must be in format msg_');
  });

  test('allows null or empty quotedMessageId', () => {
    const { error: error1, value: value1 } = validate({
      senderId: 'user_1',
      type: 'internal.text',
      content: 'hello',
      quotedMessageId: null
    });

    expect(error1).toBeUndefined();
    // Joi с .allow(null) и .optional() может вернуть undefined или удалить поле
    expect(value1.quotedMessageId === undefined || value1.quotedMessageId === null).toBe(true);

    const { error: error2, value: value2 } = validate({
      senderId: 'user_1',
      type: 'internal.text',
      content: 'hello',
      quotedMessageId: ''
    });

    expect(error2).toBeUndefined();
    expect(value2.quotedMessageId).toBe('');
  });

  test('normalizes quotedMessageId to lowercase', () => {
    const { error, value } = validate({
      senderId: 'user_1',
      type: 'internal.text',
      content: 'hello',
      quotedMessageId: 'MSG_ABC123DEF456GHI789JK'
    });

    expect(error).toBeUndefined();
    expect(value.quotedMessageId).toBe('msg_abc123def456ghi789jk');
  });
});

describe('bodySchemas.createUserSchema', () => {
  test('normalizes userId to lowercase', () => {
    const { error, value } = createUserSchema.validate({
      userId: 'Agent_ABC',
      name: 'Agent'
    });

    expect(error).toBeUndefined();
    expect(value.userId).toBe('agent_abc');
  });
});

describe('bodySchemas.createTenantSchema', () => {
  test('applies defaults and allows optional fields', () => {
    const { error, value } = createTenantSchema.validate({
      name: 'Tenant',
      domain: 'chat.example.com'
    });

    expect(error).toBeUndefined();
    expect(value.isActive).toBe(true);
  });

  test('rejects missing name', () => {
    const { error } = createTenantSchema.validate({
      domain: 'chat.example.com'
    });

    expect(error).toBeDefined();
    expect(error?.details?.[0]?.message).toContain('"name" is required');
  });
});

describe('bodySchemas.updateTenantSchema', () => {
  test('permits optional fields only', () => {
    const { error, value } = updateTenantSchema.validate({
      isActive: false
    });

    expect(error).toBeUndefined();
    expect(value.isActive).toBe(false);
  });
});

describe('bodySchemas.setMetaSchema', () => {
  test('accepts any JSON-compatible value', () => {
    const { error, value } = setMetaSchema.validate({
      value: { nested: ['x', 'y'] },
      dataType: 'object'
    });

    expect(error).toBeUndefined();
    expect(value.dataType).toBe('object');
  });

  test('accepts optional scope', () => {
    const { error, value } = setMetaSchema.validate({
      value: 'test',
      scope: 'user_alice'
    });

    expect(error).toBeUndefined();
    expect(value.scope).toBe('user_alice');
  });
});

describe('querySchemas', () => {
  test('paginationSchema applies defaults', () => {
    const { error, value } = paginationSchema.validate({});

    expect(error).toBeUndefined();
    expect(value.page).toBe(1);
    expect(value.limit).toBe(10);
  });

  test('queryWithFilterSchema accepts empty filter', () => {
    const { error } = queryWithFilterSchema.validate({
      page: 2,
      limit: 15,
      filter: '',
      sort: ''
    });

    expect(error).toBeUndefined();
  });

  test('userDialogsQuerySchema validates unreadCount patterns', () => {
    const { error, value } = userDialogsQuerySchema.validate({
      unreadCount: 'gte:5'
    });

    expect(error).toBeUndefined();
    expect(value.unreadCount).toBe('gte:5');
  });

  test('messagesQuerySchema accepts valid sort pattern', () => {
    const { error, value } = messagesQuerySchema.validate({
      sort: '(createdAt,asc)'
    });

    expect(error).toBeUndefined();
    expect(value.sort).toBe('(createdAt,asc)');
  });

  test('reactionsQuerySchema allows optional params', () => {
    const { error } = reactionsQuerySchema.validate({
      reaction: '👍',
      userId: 'user_1'
    });

    expect(error).toBeUndefined();
  });
});


