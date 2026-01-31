import * as fakeAmqp from '@onify/fake-amqplib';
import { topicController } from '../topicController.js';
import { Topic, Dialog, Meta } from '@chat3/models';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { generateTopicId } from '@chat3/utils/topicUtils.js';

const tenantId = 'tnt_test';

function generateDialogId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const createMockReq = ({
  params = {},
  body = {},
  query = {},
  apiKey = { name: 'test-key' }
} = {}) => ({
  tenantId,
  params,
  body,
  query,
  apiKey
});

const createMockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

beforeAll(async () => {
  await setupMongoMemoryServer();
  const rabbitmqUtils = await import('@chat3/utils/rabbitmqUtils.js');
  const amqplib = await import('amqplib');
  amqplib.default.connect = fakeAmqp.connect;
  await rabbitmqUtils.initRabbitMQ();
});

afterAll(async () => {
  const rabbitmqUtils = await import('@chat3/utils/rabbitmqUtils.js');
  await rabbitmqUtils.closeRabbitMQ();
  await teardownMongoMemoryServer();
});

beforeEach(async () => {
  await clearDatabase();
  fakeAmqp.resetMock();
  const rabbitmqUtils = await import('@chat3/utils/rabbitmqUtils.js');
  const rabbitmqInfo = rabbitmqUtils.getRabbitMQInfo();
  if (!rabbitmqInfo.connected) {
    const amqplib = await import('amqplib');
    amqplib.default.connect = fakeAmqp.connect;
    await rabbitmqUtils.initRabbitMQ();
  }
});

describe('topicController.getTenantTopics', () => {
  test('returns empty list when no topics', async () => {
    const req = createMockReq({ query: { page: 1, limit: 10 } });
    const res = createMockRes();

    await topicController.getTenantTopics(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      pages: 1
    });
  });

  test('returns list with pagination', async () => {
    const dialogId = generateDialogId();
    await Dialog.create({
      tenantId,
      dialogId,
      createdAt: generateTimestamp()
    });
    await Topic.create({
      tenantId,
      dialogId,
      topicId: generateTopicId(),
      createdAt: generateTimestamp()
    });
    await Topic.create({
      tenantId,
      dialogId,
      topicId: generateTopicId(),
      createdAt: generateTimestamp()
    });

    const req = createMockReq({ query: { page: 1, limit: 10 } });
    const res = createMockRes();

    await topicController.getTenantTopics(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.pagination.pages).toBe(1);
    res.body.data.forEach((t) => {
      expect(t).toHaveProperty('topicId');
      expect(t).toHaveProperty('dialogId');
      expect(t).toHaveProperty('meta');
      expect(typeof t.meta).toBe('object');
    });
  });

  test('filters by topicId eq', async () => {
    const dialogId = generateDialogId();
    await Dialog.create({
      tenantId,
      dialogId,
      createdAt: generateTimestamp()
    });
    const targetTopicId = generateTopicId();
    await Topic.create({
      tenantId,
      dialogId,
      topicId: targetTopicId,
      createdAt: generateTimestamp()
    });
    await Topic.create({
      tenantId,
      dialogId,
      topicId: generateTopicId(),
      createdAt: generateTimestamp()
    });

    const req = createMockReq({
      query: { page: 1, limit: 10, filter: `(topicId,eq,${targetTopicId})` }
    });
    const res = createMockRes();

    await topicController.getTenantTopics(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].topicId).toBe(targetTopicId);
  });

  test('filters by dialogId eq', async () => {
    const dialogA = generateDialogId();
    const dialogB = generateDialogId();
    await Dialog.create({ tenantId, dialogId: dialogA, createdAt: generateTimestamp() });
    await Dialog.create({ tenantId, dialogId: dialogB, createdAt: generateTimestamp() });
    await Topic.create({
      tenantId,
      dialogId: dialogA,
      topicId: generateTopicId(),
      createdAt: generateTimestamp()
    });
    await Topic.create({
      tenantId,
      dialogId: dialogB,
      topicId: generateTopicId(),
      createdAt: generateTimestamp()
    });

    const req = createMockReq({
      query: { page: 1, limit: 10, filter: `(dialogId,eq,${dialogA})` }
    });
    const res = createMockRes();

    await topicController.getTenantTopics(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].dialogId).toBe(dialogA);
  });

  test('filters by meta.name eq', async () => {
    const dialogA = generateDialogId();
    const dialogB = generateDialogId();
    const topicIdPersonal = generateTopicId();
    const topicIdOther = generateTopicId();
    await Dialog.create({ tenantId, dialogId: dialogA, createdAt: generateTimestamp() });
    await Dialog.create({ tenantId, dialogId: dialogB, createdAt: generateTimestamp() });
    await Topic.create({
      tenantId,
      dialogId: dialogA,
      topicId: topicIdPersonal,
      createdAt: generateTimestamp()
    });
    await Topic.create({
      tenantId,
      dialogId: dialogB,
      topicId: topicIdOther,
      createdAt: generateTimestamp()
    });
    await Meta.create({
      tenantId,
      entityType: 'topic',
      entityId: topicIdPersonal,
      key: 'name',
      value: 'personal',
      dataType: 'string',
      createdBy: 'system'
    });
    await Meta.create({
      tenantId,
      entityType: 'topic',
      entityId: topicIdOther,
      key: 'name',
      value: 'work',
      dataType: 'string',
      createdBy: 'system'
    });

    const req = createMockReq({
      query: { page: 1, limit: 10, filter: '(meta.name,eq,personal)' }
    });
    const res = createMockRes();

    await topicController.getTenantTopics(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].topicId).toBe(topicIdPersonal);
    expect(res.body.data[0].meta).toHaveProperty('name', 'personal');
  });

  test('filters by meta.priority in [support,general]', async () => {
    const dialogA = generateDialogId();
    const dialogB = generateDialogId();
    const topicSupport = generateTopicId();
    const topicGeneral = generateTopicId();
    const topicOther = generateTopicId();
    await Dialog.create({ tenantId, dialogId: dialogA, createdAt: generateTimestamp() });
    await Dialog.create({ tenantId, dialogId: dialogB, createdAt: generateTimestamp() });
    await Topic.create({
      tenantId,
      dialogId: dialogA,
      topicId: topicSupport,
      createdAt: generateTimestamp()
    });
    await Topic.create({
      tenantId,
      dialogId: dialogA,
      topicId: topicGeneral,
      createdAt: generateTimestamp()
    });
    await Topic.create({
      tenantId,
      dialogId: dialogB,
      topicId: topicOther,
      createdAt: generateTimestamp()
    });
    await Meta.create({
      tenantId,
      entityType: 'topic',
      entityId: topicSupport,
      key: 'priority',
      value: 'support',
      dataType: 'string',
      createdBy: 'system'
    });
    await Meta.create({
      tenantId,
      entityType: 'topic',
      entityId: topicGeneral,
      key: 'priority',
      value: 'general',
      dataType: 'string',
      createdBy: 'system'
    });
    await Meta.create({
      tenantId,
      entityType: 'topic',
      entityId: topicOther,
      key: 'priority',
      value: 'urgent',
      dataType: 'string',
      createdBy: 'system'
    });

    const req = createMockReq({
      query: { page: 1, limit: 10, filter: '(meta.priority,in,[support,general])' }
    });
    const res = createMockRes();

    await topicController.getTenantTopics(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(2);
    const topicIds = res.body.data.map((t) => t.topicId);
    expect(topicIds).toContain(topicSupport);
    expect(topicIds).toContain(topicGeneral);
    expect(topicIds).not.toContain(topicOther);
  });

  test('filters by meta.priority ne (not equal)', async () => {
    const dialogId = generateDialogId();
    const topicA = generateTopicId();
    const topicB = generateTopicId();
    const topicC = generateTopicId();
    await Dialog.create({ tenantId, dialogId, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topicA, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topicB, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topicC, createdAt: generateTimestamp() });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topicA, key: 'priority', value: 'support', dataType: 'string', createdBy: 'system' });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topicB, key: 'priority', value: 'general', dataType: 'string', createdBy: 'system' });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topicC, key: 'priority', value: 'urgent', dataType: 'string', createdBy: 'system' });

    const req = createMockReq({ query: { page: 1, limit: 10, filter: '(meta.priority,ne,support)' } });
    const res = createMockRes();
    await topicController.getTenantTopics(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(2);
    const ids = res.body.data.map((t) => t.topicId);
    expect(ids).toContain(topicB);
    expect(ids).toContain(topicC);
    expect(ids).not.toContain(topicA);
  });

  test('filters by meta.priority nin (not in)', async () => {
    const dialogId = generateDialogId();
    const topicA = generateTopicId();
    const topicB = generateTopicId();
    const topicC = generateTopicId();
    await Dialog.create({ tenantId, dialogId, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topicA, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topicB, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topicC, createdAt: generateTimestamp() });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topicA, key: 'priority', value: 'support', dataType: 'string', createdBy: 'system' });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topicB, key: 'priority', value: 'general', dataType: 'string', createdBy: 'system' });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topicC, key: 'priority', value: 'urgent', dataType: 'string', createdBy: 'system' });

    const req = createMockReq({ query: { page: 1, limit: 10, filter: '(meta.priority,nin,[support,general])' } });
    const res = createMockRes();
    await topicController.getTenantTopics(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].topicId).toBe(topicC);
  });

  test('filters by meta.level gt and gte (numeric)', async () => {
    const dialogId = generateDialogId();
    const topic1 = generateTopicId();
    const topic2 = generateTopicId();
    const topic3 = generateTopicId();
    await Dialog.create({ tenantId, dialogId, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topic1, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topic2, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topic3, createdAt: generateTimestamp() });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topic1, key: 'level', value: 1, dataType: 'number', createdBy: 'system' });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topic2, key: 'level', value: 5, dataType: 'number', createdBy: 'system' });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topic3, key: 'level', value: 10, dataType: 'number', createdBy: 'system' });

    const req = createMockReq({ query: { page: 1, limit: 10, filter: '(meta.level,gt,1)' } });
    const res = createMockRes();
    await topicController.getTenantTopics(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(2);
    const ids = res.body.data.map((t) => t.topicId);
    expect(ids).toContain(topic2);
    expect(ids).toContain(topic3);
    expect(ids).not.toContain(topic1);
  });

  test('filters by meta.level lt and lte (numeric)', async () => {
    const dialogId = generateDialogId();
    const topic1 = generateTopicId();
    const topic2 = generateTopicId();
    const topic3 = generateTopicId();
    await Dialog.create({ tenantId, dialogId, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topic1, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topic2, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topic3, createdAt: generateTimestamp() });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topic1, key: 'level', value: 1, dataType: 'number', createdBy: 'system' });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topic2, key: 'level', value: 5, dataType: 'number', createdBy: 'system' });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topic3, key: 'level', value: 10, dataType: 'number', createdBy: 'system' });

    const req = createMockReq({ query: { page: 1, limit: 10, filter: '(meta.level,lte,5)' } });
    const res = createMockRes();
    await topicController.getTenantTopics(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(2);
    const ids = res.body.data.map((t) => t.topicId);
    expect(ids).toContain(topic1);
    expect(ids).toContain(topic2);
    expect(ids).not.toContain(topic3);
  });

  test('filters by meta.name regex', async () => {
    const dialogId = generateDialogId();
    const topicPersonal = generateTopicId();
    const topicWork = generateTopicId();
    const topicSupport = generateTopicId();
    await Dialog.create({ tenantId, dialogId, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topicPersonal, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topicWork, createdAt: generateTimestamp() });
    await Topic.create({ tenantId, dialogId, topicId: topicSupport, createdAt: generateTimestamp() });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topicPersonal, key: 'name', value: 'personal-chat', dataType: 'string', createdBy: 'system' });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topicWork, key: 'name', value: 'work-issues', dataType: 'string', createdBy: 'system' });
    await Meta.create({ tenantId, entityType: 'topic', entityId: topicSupport, key: 'name', value: 'support-ticket', dataType: 'string', createdBy: 'system' });

    const req = createMockReq({ query: { page: 1, limit: 10, filter: '(meta.name,regex,personal)' } });
    const res = createMockRes();
    await topicController.getTenantTopics(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].topicId).toBe(topicPersonal);
    expect(res.body.data[0].meta.name).toBe('personal-chat');
  });

  test('returns 400 for invalid filter format', async () => {
    const req = createMockReq({
      query: { page: 1, limit: 10, filter: '{ invalid json' }
    });
    const res = createMockRes();

    await topicController.getTenantTopics(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
  });

  test('respects page and limit', async () => {
    const dialogId = generateDialogId();
    await Dialog.create({
      tenantId,
      dialogId,
      createdAt: generateTimestamp()
    });
    for (let i = 0; i < 5; i++) {
      await Topic.create({
        tenantId,
        dialogId,
        topicId: generateTopicId(),
        createdAt: generateTimestamp() + i
      });
    }

    const req = createMockReq({ query: { page: 2, limit: 2 } });
    const res = createMockRes();

    await topicController.getTenantTopics(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.pagination.total).toBe(5);
    expect(res.body.pagination.pages).toBe(3);
  });
});

describe('topicController.getDialogTopics', () => {
  test('returns list of topics for dialog', async () => {
    const dialogId = generateDialogId();
    await Dialog.create({
      tenantId,
      dialogId,
      createdAt: generateTimestamp()
    });
    await Topic.create({
      tenantId,
      dialogId,
      topicId: generateTopicId(),
      createdAt: generateTimestamp()
    });
    await Topic.create({
      tenantId,
      dialogId,
      topicId: generateTopicId(),
      createdAt: generateTimestamp()
    });

    const req = createMockReq({
      params: { dialogId },
      query: { page: 1, limit: 10 }
    });
    const res = createMockRes();

    await topicController.getDialogTopics(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(2);
    res.body.data.forEach((t) => {
      expect(t.dialogId).toBe(dialogId);
      expect(t).toHaveProperty('meta');
    });
    expect(res.body.pagination.total).toBe(2);
  });

  test('returns 404 when dialog not found', async () => {
    const req = createMockReq({
      params: { dialogId: generateDialogId() },
      query: { page: 1, limit: 10 }
    });
    const res = createMockRes();

    await topicController.getDialogTopics(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.message).toBe('Dialog not found');
  });

  test('respects pagination', async () => {
    const dialogId = generateDialogId();
    await Dialog.create({
      tenantId,
      dialogId,
      createdAt: generateTimestamp()
    });
    for (let i = 0; i < 5; i++) {
      await Topic.create({
        tenantId,
        dialogId,
        topicId: generateTopicId(),
        createdAt: generateTimestamp() + i
      });
    }

    const req = createMockReq({
      params: { dialogId },
      query: { page: 2, limit: 2 }
    });
    const res = createMockRes();

    await topicController.getDialogTopics(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.total).toBe(5);
  });
});

describe('topicController.createTopic', () => {
  test('creates topic and returns 201', async () => {
    const dialogId = generateDialogId();
    await Dialog.create({
      tenantId,
      dialogId,
      createdAt: generateTimestamp()
    });

    const req = createMockReq({
      params: { dialogId },
      body: { meta: { category: 'support' } }
    });
    const res = createMockRes();

    await topicController.createTopic(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('topicId');
    expect(res.body.data.dialogId).toBe(dialogId);
    expect(res.body.data.meta).toEqual({ category: 'support' });
    expect(res.body.message).toBe('Topic created successfully');

    const created = await Topic.findOne({ tenantId, dialogId }).lean();
    expect(created).toBeTruthy();
    expect(created.topicId).toBe(res.body.data.topicId);
  });

  test('returns 404 when dialog not found', async () => {
    const req = createMockReq({
      params: { dialogId: generateDialogId() },
      body: {}
    });
    const res = createMockRes();

    await topicController.createTopic(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.message).toBe('Dialog not found');
  });

  test('creates topic without meta', async () => {
    const dialogId = generateDialogId();
    await Dialog.create({
      tenantId,
      dialogId,
      createdAt: generateTimestamp()
    });

    const req = createMockReq({
      params: { dialogId },
      body: {}
    });
    const res = createMockRes();

    await topicController.createTopic(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.meta).toEqual({});
    expect(res.body.data.topicId).toMatch(/^topic_[a-z0-9]{20}$/);
  });
});

describe('topicController.getTopic', () => {
  test('returns topic by id', async () => {
    const dialogId = generateDialogId();
    const topicId = generateTopicId();
    await Dialog.create({
      tenantId,
      dialogId,
      createdAt: generateTimestamp()
    });
    await Topic.create({
      tenantId,
      dialogId,
      topicId,
      createdAt: generateTimestamp()
    });

    const req = createMockReq({
      params: { dialogId, topicId }
    });
    const res = createMockRes();

    await topicController.getTopic(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data.topicId).toBe(topicId);
    expect(res.body.data.dialogId).toBe(dialogId);
    expect(res.body.data).toHaveProperty('meta');
  });

  test('returns 404 when topic not found', async () => {
    const dialogId = generateDialogId();
    await Dialog.create({
      tenantId,
      dialogId,
      createdAt: generateTimestamp()
    });

    const req = createMockReq({
      params: { dialogId, topicId: generateTopicId() }
    });
    const res = createMockRes();

    await topicController.getTopic(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('ERROR_NO_TOPIC');
    expect(res.body.message).toBe('Topic not found');
  });
});

describe('topicController.updateTopic', () => {
  test('updates topic meta and returns 200', async () => {
    const dialogId = generateDialogId();
    const topicId = generateTopicId();
    await Dialog.create({
      tenantId,
      dialogId,
      createdAt: generateTimestamp()
    });
    await Topic.create({
      tenantId,
      dialogId,
      topicId,
      createdAt: generateTimestamp()
    });

    const req = createMockReq({
      params: { dialogId, topicId },
      body: { meta: { priority: 'high' } }
    });
    const res = createMockRes();

    await topicController.updateTopic(req, res);

    expect(res.statusCode).toBeUndefined();
    expect(res.body.data.topicId).toBe(topicId);
    expect(res.body.data.meta).toHaveProperty('priority', 'high');
    expect(res.body.message).toBe('Topic updated successfully');
  });

  test('returns 404 when topic not found', async () => {
    const dialogId = generateDialogId();
    await Dialog.create({
      tenantId,
      dialogId,
      createdAt: generateTimestamp()
    });

    const req = createMockReq({
      params: { dialogId, topicId: generateTopicId() },
      body: { meta: { key: 'value' } }
    });
    const res = createMockRes();

    await topicController.updateTopic(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('ERROR_NO_TOPIC');
    expect(res.body.message).toBe('Topic not found');
  });

  test('returns 404 when dialog not found after topic update', async () => {
    const dialogId = generateDialogId();
    const topicId = generateTopicId();
    await Topic.create({
      tenantId,
      dialogId,
      topicId,
      createdAt: generateTimestamp()
    });
    // Dialog не создаём — после обновления топика контроллер ищет диалог для события

    const req = createMockReq({
      params: { dialogId, topicId },
      body: { meta: { key: 'value' } }
    });
    const res = createMockRes();

    await topicController.updateTopic(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.message).toBe('Dialog not found');
  });
});
