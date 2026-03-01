/**
 * Интеграционный тест POST markPackAllRead: все сообщения пака отмечаются прочитанными для пользователя.
 * Пак из нескольких диалогов, пользователь — участник части; проверка обнуления счётчиков и MessageStatus; 404 при отсутствии доступа.
 */

import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import { packController } from '../packController.js';
import messageController from '../messageController.js';
import * as userPackController from '../userPackController.js';
import {
  Tenant,
  UserDialogStats,
  UserDialogUnreadBySenderType,
  UserPackUnreadBySenderType,
  MessageStatus
} from '@chat3/models';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

const tenantId = 'tnt_default';
const USER_ID = 'usr_pack_mark_read';
const CONTACT_ID = 'cnt_pack_mark_read';

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
    name: 'Test Tenant',
    domain: 'test.chat3.com',
    type: 'client',
    isActive: true,
    createdAt: generateTimestamp()
  });
});

describe('markPackAllRead integration', () => {
  test('markPackAllRead обнуляет счётчики пака и проставляет MessageStatus read по всем диалогам пака, где пользователь участник', async () => {
    const resPack = createMockRes();
    await packController.create(createReq(), resPack);
    expect(resPack.statusCode).toBe(201);
    const packId = resPack.body?.data?.packId;
    expect(packId).toBeDefined();

    const dialogIds = [];
    for (let i = 0; i < 2; i++) {
      const resD = createMockRes();
      await dialogController.create(
        createReq({
          body: {
            members: [
              { userId: USER_ID, type: 'user' },
              { userId: CONTACT_ID, type: 'contact' }
            ]
          }
        }),
        resD
      );
      expect(resD.statusCode).toBe(201);
      dialogIds.push(resD.body?.data?.dialogId);
    }

    for (const dialogId of dialogIds) {
      const resL = createMockRes();
      await packController.addDialog(
        createReq({ params: { packId }, body: { dialogId } }),
        resL
      );
      expect(resL.statusCode).toBe(201);
    }

    const messageIds = [];
    for (let di = 0; di < dialogIds.length; di++) {
      const resM = createMockRes();
      await messageController.createMessage(
        createReq({
          params: { dialogId: dialogIds[di] },
          body: {
            senderId: CONTACT_ID,
            content: `Message in dialog ${di}`,
            type: 'internal.text'
          }
        }),
        resM
      );
      expect(resM.statusCode).toBe(201);
      messageIds.push(resM.body?.data?.messageId);
    }

    const statsBefore = await UserDialogStats.find({
      tenantId,
      userId: USER_ID,
      dialogId: { $in: dialogIds }
    }).lean();
    expect(statsBefore.length).toBe(2);
    statsBefore.forEach((s) => expect(s.unreadCount).toBe(1));

    const resMark = createMockRes();
    await userPackController.markPackAllRead(
      createReq({ params: { userId: USER_ID, packId } }),
      resMark
    );
    expect(resMark.statusCode).toBe(200);
    expect(resMark.body?.data?.packId).toBe(packId);
    expect(resMark.body?.data?.unreadCount).toBe(0);
    expect(resMark.body?.data?.processedDialogsCount).toBe(2);
    expect(resMark.body?.data?.totalProcessedMessageCount).toBe(2);

    const statsAfter = await UserDialogStats.find({
      tenantId,
      userId: USER_ID,
      dialogId: { $in: dialogIds }
    }).lean();
    statsAfter.forEach((s) => expect(s.unreadCount).toBe(0));

    const bySenderRows = await UserDialogUnreadBySenderType.find({
      tenantId,
      userId: USER_ID,
      dialogId: { $in: dialogIds }
    }).lean();
    bySenderRows.forEach((r) => expect(r.countUnread).toBe(0));

    const packRows = await UserPackUnreadBySenderType.find({
      tenantId,
      userId: USER_ID,
      packId
    }).lean();
    const totalPackUnread = packRows.reduce((s, r) => s + (r.countUnread || 0), 0);
    expect(totalPackUnread).toBe(0);

    for (const messageId of messageIds) {
      const status = await MessageStatus.findOne({
        tenantId,
        messageId,
        userId: USER_ID
      })
        .sort({ createdAt: -1 })
        .lean();
      expect(status?.status).toBe('read');
    }
  });

  test('markPackAllRead возвращает 404 если пак не найден', async () => {
    const res = createMockRes();
    await userPackController.markPackAllRead(
      createReq({
        params: { userId: USER_ID, packId: 'pck_nonexistentxxxxxxxx' }
      }),
      res
    );
    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toMatch(/not found/i);
  });

  test('markPackAllRead возвращает 404 если пользователь не участник ни одного диалога пака', async () => {
    const resPack = createMockRes();
    await packController.create(createReq(), resPack);
    expect(resPack.statusCode).toBe(201);
    const packId = resPack.body?.data?.packId;

    const resD = createMockRes();
    await dialogController.create(
      createReq({
        body: {
          members: [{ userId: CONTACT_ID, type: 'contact' }, { userId: 'other_user', type: 'user' }]
        }
      }),
      resD
    );
    expect(resD.statusCode).toBe(201);
    const dialogId = resD.body?.data?.dialogId;
    const resL = createMockRes();
    await packController.addDialog(
      createReq({ params: { packId }, body: { dialogId } }),
      resL
    );
    expect(resL.statusCode).toBe(201);

    const res = createMockRes();
    await userPackController.markPackAllRead(
      createReq({ params: { userId: USER_ID, packId } }),
      res
    );
    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toMatch(/no access|not found/i);
  });
});
