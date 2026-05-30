/**
 * E2E update stack: tenant-api POST → OutboxEvent → publishOutboxBatch → processUpdateEvent (update-worker).
 */
import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import messageController from '../messageController.js';
import { Event, OutboxEvent, Tenant, Update } from '@chat3/models';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { runUpdateStackPipeline } from '../../utils/__tests__/counterTestHelpers.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

const tenantId = 'tnt_update_e2e';

function createMockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
}

function createReq(overrides = {}) {
  return {
    tenantId,
    params: {},
    query: {},
    body: {},
    apiKey: { name: 'test-key' },
    ...overrides
  };
}

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
  await Tenant.create({
    tenantId,
    name: 'Update E2E Tenant',
    domain: 'update-e2e.chat3.com',
    type: 'client',
    isActive: true,
    createdAt: generateTimestamp()
  });
});

describe('update stack E2E', () => {
  test('POST message → outbox → relay → update-worker → MessageUpdate with evt_ eventId', async () => {
    const resDialog = createMockRes();
    await dialogController.create(
      createReq({
        body: {
          members: [
            { userId: 'alice', type: 'user' },
            { userId: 'bob', type: 'user' }
          ]
        }
      }),
      resDialog
    );
    expect(resDialog.statusCode).toBe(201);
    const dialogId = resDialog.body?.data?.dialogId;

    const resMessage = createMockRes();
    await messageController.createMessage(
      createReq({
        params: { dialogId },
        body: {
          senderId: 'alice',
          content: 'hello bob',
          type: 'internal.text'
        }
      }),
      resMessage
    );
    expect(resMessage.statusCode).toBe(201);
    const messageId = resMessage.body?.data?.messageId;

    const outboxRow = await OutboxEvent.findOne({ tenantId, eventType: 'message.create' }).lean();
    expect(outboxRow?.eventId).toMatch(/^evt_/);

    const domainEvent = await Event.findOne({ tenantId, eventId: outboxRow.eventId }).lean();
    expect(domainEvent?.eventType).toBe('message.create');

    await runUpdateStackPipeline();

    const messageUpdates = await Update.find({
      tenantId,
      entityId: messageId,
      eventId: outboxRow.eventId,
      eventType: 'message.create'
    }).lean();

    expect(messageUpdates.length).toBe(2);
    messageUpdates.forEach((row) => {
      expect(row.eventId).toBe(outboxRow.eventId);
      expect(row.data?.message?.messageId).toBe(messageId);
    });
  });
});
