/**
 * P1 этап 4: monotonic UserStatsUpdate (statsVersion) после message.create → markAllRead.
 */
import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import { packController } from '../packController.js';
import messageController from '../messageController.js';
import { Tenant, Update, User } from '@chat3/models';
import { shouldApplyUserStatsUpdate } from '@chat3/utils/updateUtils.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import {
  flushCounterEvents,
  runCounterStackPipeline
} from '../../utils/__tests__/counterTestHelpers.js';

const tenantId = 'tnt_p1_ws_mono';
const OPERATOR_ID = 'usr_p1_ws_operator';
const CONTACT_ID = 'cnt_p1_ws_contact';

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

function pickMonotonicState(updateRow) {
  const stats = updateRow?.data?.user?.stats ?? {};
  return {
    statsVersion: stats.statsVersion,
    lastUpdatedAt: stats.lastUpdatedAt,
    'packs.messages.lastUpdatedAt': stats['packs.messages.lastUpdatedAt'],
    'packs.messages.totalUnreadCount': stats['packs.messages.totalUnreadCount']
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
  if (!rabbitmqUtils.getRabbitMQInfo().connected) {
    const amqplib = await import('amqplib');
    amqplib.default.connect = fakeAmqp.connect;
    await rabbitmqUtils.initRabbitMQ();
  }
  await Tenant.create({
    tenantId,
    name: 'P1 WS Monotonic',
    domain: 'p1-ws.chat3.com',
    type: 'client',
    isActive: true,
    createdAt: generateTimestamp()
  });
  await User.create([
    { tenantId, userId: OPERATOR_ID, type: 'user' },
    { tenantId, userId: CONTACT_ID, type: 'contact' }
  ]);
});

describe('P1 WS monotonic UserStatsUpdate', () => {
  test('markAllRead UserStatsUpdate новее message.create — stale отклоняется', async () => {
    const resPack = createMockRes();
    await packController.create(createReq(), resPack);
    const packId = resPack.body?.data?.packId;

    const resDlgA = createMockRes();
    await dialogController.create(
      createReq({
        body: {
          members: [
            { userId: OPERATOR_ID, type: 'user' },
            { userId: CONTACT_ID, type: 'contact' }
          ]
        }
      }),
      resDlgA
    );
    const dialogIdA = resDlgA.body?.data?.dialogId;

    const resDlgB = createMockRes();
    await dialogController.create(
      createReq({
        body: {
          members: [
            { userId: OPERATOR_ID, type: 'user' },
            { userId: CONTACT_ID, type: 'contact' }
          ]
        }
      }),
      resDlgB
    );
    const dialogIdB = resDlgB.body?.data?.dialogId;

    await packController.addDialog(
      createReq({ params: { packId }, body: { dialogId: dialogIdA } }),
      createMockRes()
    );
    await packController.addDialog(
      createReq({ params: { packId }, body: { dialogId: dialogIdB } }),
      createMockRes()
    );

    await messageController.createMessage(
      createReq({
        params: { dialogId: dialogIdA },
        body: { senderId: CONTACT_ID, content: 'Inbound', type: 'internal.text' }
      }),
      createMockRes()
    );
    await runCounterStackPipeline();

    const createUpdate = await Update.findOne({
      tenantId,
      userId: OPERATOR_ID,
      updateType: 'update.user',
      sourceEventType: 'message.create'
    }).lean();
    expect(createUpdate).toBeTruthy();
    const stateAfterCreate = pickMonotonicState(createUpdate);
    expect(stateAfterCreate['packs.messages.totalUnreadCount']).toBeGreaterThanOrEqual(1);
    expect(stateAfterCreate.statsVersion).toBeGreaterThanOrEqual(1);

    await messageController.createMessage(
      createReq({
        params: { dialogId: dialogIdB },
        body: { senderId: OPERATOR_ID, content: 'Outbound', type: 'internal.text' }
      }),
      createMockRes()
    );
    await flushCounterEvents();

    await packController.markAllReadForAllUsers(
      createReq({ params: { packId }, query: { memberType: 'user' } }),
      createMockRes()
    );
    await runCounterStackPipeline();

    const markReadUpdate = await Update.findOne({
      tenantId,
      userId: OPERATOR_ID,
      updateType: 'update.user',
      sourceEventType: 'dialog.messages.bulk_read'
    })
      .sort({ createdAt: -1 })
      .lean();
    expect(markReadUpdate).toBeTruthy();

    const stateAfterMarkRead = pickMonotonicState(markReadUpdate);
    expect(stateAfterMarkRead['packs.messages.totalUnreadCount']).toBe(0);
    expect(stateAfterMarkRead.statsVersion).toBeGreaterThan(stateAfterCreate.statsVersion ?? 0);

    expect(shouldApplyUserStatsUpdate(stateAfterMarkRead, stateAfterCreate)).toBe(false);
    expect(shouldApplyUserStatsUpdate(stateAfterCreate, stateAfterMarkRead)).toBe(true);

    let applied = stateAfterCreate;
    if (shouldApplyUserStatsUpdate(applied, stateAfterMarkRead)) {
      applied = stateAfterMarkRead;
    }
    if (shouldApplyUserStatsUpdate(applied, stateAfterCreate)) {
      applied = stateAfterCreate;
    }
    expect(applied['packs.messages.totalUnreadCount']).toBe(0);
    expect(applied.statsVersion).toBe(stateAfterMarkRead.statsVersion);
  });
});
