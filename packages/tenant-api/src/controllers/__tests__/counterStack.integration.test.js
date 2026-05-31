/**
 * E2E counter stack: tenant-api POST → OutboxEvent → publishOutboxBatch (relay) → processCounterEvent (counter-worker).
 *
 * mongodb-memory-server + @onify/fake-amqplib (AGENTS.md).
 */
import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import messageController from '../messageController.js';
import {
  Event,
  OutboxEvent,
  ProcessedCounterEvent,
  Tenant,
  Update,
  UserDialogStats
} from '@chat3/models';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import {
  runCounterStackPipeline
} from '../../utils/__tests__/counterTestHelpers.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { isCounterEventType } from '@chat3/utils/counterProcessor/counterEvents.js';

const tenantId = 'tnt_counter_e2e';

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
    name: 'Counter E2E Tenant',
    domain: 'e2e.chat3.com',
    type: 'client',
    isActive: true,
    createdAt: generateTimestamp()
  });
});

describe('counter stack E2E', () => {
  test('POST message → outbox → relay → counter-worker → stats + Update', async () => {
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
    expect(dialogId).toBeDefined();

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
    expect(messageId).toBeDefined();

    const bobStatsBefore = await UserDialogStats.findOne({
      tenantId,
      userId: 'bob',
      dialogId
    }).lean();
    expect(bobStatsBefore?.unreadCount ?? 0).toBe(0);

    const outboxRows = await OutboxEvent.find({ tenantId, eventType: 'message.create' }).lean();
    expect(outboxRows.length).toBeGreaterThan(0);
    expect(outboxRows.some((r) => r.published === false)).toBe(true);

    const counterOutbox = outboxRows.find((r) => isCounterEventType(r.eventType));
    expect(counterOutbox?.eventId).toBeDefined();

    const { published } = await runCounterStackPipeline();
    expect(published).toBeGreaterThanOrEqual(0);

    const processedRow = await ProcessedCounterEvent.findOne({
      tenantId,
      eventId: counterOutbox.eventId
    }).lean();
    expect(processedRow?.eventType).toBe('message.create');

    const bobStatsAfter = await UserDialogStats.findOne({
      tenantId,
      userId: 'bob',
      dialogId
    }).lean();
    expect(bobStatsAfter?.unreadCount).toBe(1);

    const domainEvent = await Event.findOne({ tenantId, eventId: counterOutbox.eventId }).lean();
    expect(domainEvent?.eventType).toBe('message.create');

    const update = await Update.findOne({
      tenantId,
      userId: 'bob',
      entityId: dialogId
    })
      .sort({ createdAt: -1 })
      .lean();
    expect(update).toBeTruthy();
    expect(update?.data?.member?.state?.unreadCount).toBe(1);

    const userStatsUpdate = await Update.findOne({
      tenantId,
      userId: 'bob',
      eventType: 'user.stats.update'
    }).lean();
    expect(userStatsUpdate).toBeTruthy();
    expect(userStatsUpdate?.data?.user?.stats?.totalUnreadCount).toBe(1);

    const userPackUpdates = await Update.countDocuments({
      tenantId,
      userId: 'bob',
      eventType: 'user.pack.stats.updated'
    });
    expect(userPackUpdates).toBe(0);

    const dupProcessed = await ProcessedCounterEvent.countDocuments({
      tenantId,
      eventId: counterOutbox.eventId
    });
    expect(dupProcessed).toBe(1);
  });
});
