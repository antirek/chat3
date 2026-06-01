/**
 * pack.dialog.remove → counter-worker пересчитывает паковые unread,
 * не трогая unread по диалогу (пользователь остаётся участником).
 *
 * mongodb-memory-server + @onify/fake-amqplib (AGENTS.md).
 */
import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import { packController } from '../packController.js';
import messageController from '../messageController.js';
import {
  OutboxEvent,
  ProcessedCounterEvent,
  Tenant,
  User,
  UserDialogStats,
  UserDialogUnreadBySenderType,
  UserPackUnreadBySenderType,
  UserPackedMessagesUnreadBySenderType,
  UserStats
} from '@chat3/models';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { flushCounterEvents } from '../../utils/__tests__/counterTestHelpers.js';
import { buildUserPackStatsFromBySenderRows } from '@chat3/utils/packStatsUtils.js';

const tenantId = 'tnt_pack_rm_recalc';
const VIEWER_ID = 'usr_pack_remove_viewer';
const SENDER_ID = 'cnt_pack_remove_sender';

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

async function sumUserPackUnread(tenant, packId, userId) {
  const rows = await UserPackUnreadBySenderType.find({ tenantId: tenant, packId, userId }).lean();
  return buildUserPackStatsFromBySenderRows(rows).unreadCount;
}

async function sumUserPackedMessagesUnread(tenant, userId) {
  const rows = await UserPackedMessagesUnreadBySenderType.find({ tenantId: tenant, userId }).lean();
  return rows.reduce((s, r) => s + (r.countUnread ?? 0), 0);
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
    name: 'Pack Remove Recalc Tenant',
    domain: 'pack-remove.chat3.com',
    type: 'client',
    isActive: true,
    createdAt: generateTimestamp()
  });
  await User.create([
    { tenantId, userId: VIEWER_ID, type: 'user' },
    { tenantId, userId: SENDER_ID, type: 'contact' }
  ]);
});

describe('pack.dialog.remove counter recalc', () => {
  test('после удаления диалога из пака packed unread обнуляется, unread по диалогу сохраняется', async () => {
    const resDialog = createMockRes();
    await dialogController.create(
      createReq({
        body: {
          members: [
            { userId: VIEWER_ID, type: 'user' },
            { userId: SENDER_ID, type: 'contact' }
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
          senderId: SENDER_ID,
          content: 'unread in pack',
          type: 'internal.text'
        }
      }),
      resMessage
    );
    expect(resMessage.statusCode).toBe(201);
    await flushCounterEvents();

    const dialogUnreadBefore = await UserDialogStats.findOne({
      tenantId,
      userId: VIEWER_ID,
      dialogId
    }).lean();
    expect(dialogUnreadBefore?.unreadCount).toBe(1);

    const resPack = createMockRes();
    await packController.create(createReq({ body: {} }), resPack);
    expect(resPack.statusCode).toBe(201);
    const packId = resPack.body?.data?.packId;

    const resAdd = createMockRes();
    await packController.addDialog(
      createReq({
        params: { packId },
        body: { dialogId }
      }),
      resAdd
    );
    expect(resAdd.statusCode).toBe(201);
    await flushCounterEvents();

    expect(await sumUserPackUnread(tenantId, packId, VIEWER_ID)).toBe(1);
    expect(await sumUserPackedMessagesUnread(tenantId, VIEWER_ID)).toBe(1);

    const userStatsBeforeRemove = await UserStats.findOne({ tenantId, userId: VIEWER_ID }).lean();
    expect(userStatsBeforeRemove?.totalUnreadCount).toBe(1);

    const resRemove = createMockRes();
    await packController.removeDialog(
      createReq({
        params: { packId, dialogId }
      }),
      resRemove
    );
    expect(resRemove.statusCode).toBe(200);

    const removeOutbox = await OutboxEvent.findOne({ tenantId, eventType: 'pack.dialog.remove' }).lean();
    expect(removeOutbox?.eventId).toBeDefined();

    await flushCounterEvents();

    const processed = await ProcessedCounterEvent.findOne({
      tenantId,
      eventId: removeOutbox.eventId
    }).lean();
    expect(processed?.eventType).toBe('pack.dialog.remove');

    expect(await sumUserPackUnread(tenantId, packId, VIEWER_ID)).toBe(0);
    expect(await sumUserPackedMessagesUnread(tenantId, VIEWER_ID)).toBe(0);

    const dialogUnreadAfter = await UserDialogStats.findOne({
      tenantId,
      userId: VIEWER_ID,
      dialogId
    }).lean();
    expect(dialogUnreadAfter?.unreadCount).toBe(1);

    const dialogBySender = await UserDialogUnreadBySenderType.findOne({
      tenantId,
      userId: VIEWER_ID,
      dialogId,
      fromType: 'contact'
    }).lean();
    expect(dialogBySender?.countUnread).toBe(1);

    const userStatsAfterRemove = await UserStats.findOne({ tenantId, userId: VIEWER_ID }).lean();
    expect(userStatsAfterRemove?.totalUnreadCount).toBe(1);
  });
});
