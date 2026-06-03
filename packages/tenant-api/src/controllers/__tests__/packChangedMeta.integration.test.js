/**
 * pack meta change → pack.changed → DialogUpdate (dialogs.list) для участников диалогов пака.
 */
import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import { packController } from '../packController.js';
import metaController from '../metaController.js';
import {
  OutboxEvent,
  Tenant,
  User,
  UserDialogStats,
  Update
} from '@chat3/models';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { flushUpdateEvents } from '../../utils/__tests__/counterTestHelpers.js';

const tenantId = 'tnt_pack_meta_upd';
const VIEWER_ID = 'usr_pack_meta_view';
const OTHER_ID = 'usr_pack_meta_other';
const SENDER_ID = 'cnt_pack_meta_snd';

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
  if (!rabbitmqUtils.getRabbitMQInfo().connected) {
    const amqplib = await import('amqplib');
    amqplib.default.connect = fakeAmqp.connect;
    await rabbitmqUtils.initRabbitMQ();
  }
  await Tenant.create({
    tenantId,
    name: 'Pack Meta Update Tenant',
    domain: 'pack-meta.chat3.com',
    type: 'client',
    isActive: true,
    createdAt: generateTimestamp()
  });
  await User.create([
    { tenantId, userId: VIEWER_ID, type: 'user' },
    { tenantId, userId: OTHER_ID, type: 'user' },
    { tenantId, userId: SENDER_ID, type: 'contact' }
  ]);
});

describe('pack.changed from meta API', () => {
  test('setMeta pack → DialogUpdate участнику диалога в паке, outsider без update', async () => {
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
    const dialogId = resDialog.body?.data?.dialogId;

    const resDialog2 = createMockRes();
    await dialogController.create(
      createReq({
        body: {
          members: [
            { userId: OTHER_ID, type: 'user' },
            { userId: SENDER_ID, type: 'contact' }
          ]
        }
      }),
      resDialog2
    );
    const otherDialogId = resDialog2.body?.data?.dialogId;

    const resPack = createMockRes();
    await packController.create(createReq({ body: {} }), resPack);
    const packId = resPack.body?.data?.packId;

    const resAdd = createMockRes();
    await packController.addDialog(
      createReq({ params: { packId }, body: { dialogId } }),
      resAdd
    );
    expect(resAdd.statusCode).toBe(201);

    const unreadBefore = await UserDialogStats.findOne({
      tenantId,
      userId: VIEWER_ID,
      dialogId
    }).lean();

    const resMeta = createMockRes();
    await metaController.setMeta(
      createReq({
        params: { entityType: 'pack', entityId: packId, key: 'channel' },
        body: { value: 'whatsapp', dataType: 'string' }
      }),
      resMeta
    );
    expect(resMeta.statusCode).toBe(200);

    const outbox = await OutboxEvent.findOne({ tenantId, eventType: 'pack.changed' }).lean();
    expect(outbox?.eventId).toBeDefined();

    await flushUpdateEvents();

    const viewerUpdate = await Update.findOne({
      tenantId,
      userId: VIEWER_ID,
      entityId: dialogId,
      eventId: outbox.eventId
    }).lean();
    expect(viewerUpdate?.updateType).toBe('update.dialog');
    expect(viewerUpdate?.sourceEventType).toBe('pack.changed');
    expect(viewerUpdate?.data?.context?.uiTarget).toBe('dialogs.list');
    expect(viewerUpdate?.data?.pack?.meta?.channel).toBe('whatsapp');

    const outsiderUpdate = await Update.findOne({
      tenantId,
      userId: OTHER_ID,
      entityId: otherDialogId,
      eventId: outbox.eventId
    }).lean();
    expect(outsiderUpdate).toBeNull();

    const unreadAfter = await UserDialogStats.findOne({
      tenantId,
      userId: VIEWER_ID,
      dialogId
    }).lean();
    expect(unreadAfter?.unreadCount ?? 0).toBe(unreadBefore?.unreadCount ?? 0);
  });
});
