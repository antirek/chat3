/**
 * Интеграционный тест POST markAllRead: все сообщения диалога отмечаются прочитанными для пользователя.
 * Проверяет обнуление счётчиков и проставление MessageStatus = read.
 */

import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import messageController from '../messageController.js';
import userDialogController from '../userDialogController.js';
import { Tenant, UserDialogStats, MessageStatus, UserDialogUnreadBySenderType } from '@chat3/models';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

const tenantId = 'tnt_default';
const USER_ID = 'usr_mark_all_read';
const CONTACT_ID = 'cnt_mark_all_read';

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

describe('markAllRead integration', () => {
  test('markAllRead обнуляет счётчики и проставляет MessageStatus read для всех сообщений диалога', async () => {
    const res1 = createMockRes();
    await dialogController.create(
      createReq({
        body: {
          members: [
            { userId: USER_ID, type: 'user' },
            { userId: CONTACT_ID, type: 'contact' }
          ]
        }
      }),
      res1
    );
    expect(res1.statusCode).toBe(201);
    const dialogId = res1.body?.data?.dialogId;
    expect(dialogId).toBeDefined();

    const res2 = createMockRes();
    await messageController.createMessage(
      createReq({
        params: { dialogId },
        body: {
          senderId: CONTACT_ID,
          content: 'Message 1',
          type: 'internal.text'
        }
      }),
      res2
    );
    expect(res2.statusCode).toBe(201);
    const messageId1 = res2.body?.data?.messageId;

    const res3 = createMockRes();
    await messageController.createMessage(
      createReq({
        params: { dialogId },
        body: {
          senderId: CONTACT_ID,
          content: 'Message 2',
          type: 'internal.text'
        }
      }),
      res3
    );
    expect(res3.statusCode).toBe(201);
    const messageId2 = res3.body?.data?.messageId;

    const statsBefore = await UserDialogStats.findOne({
      tenantId,
      userId: USER_ID,
      dialogId
    }).lean();
    expect(statsBefore?.unreadCount).toBe(2);

    const resMark = createMockRes();
    await userDialogController.markAllRead(
      createReq({
        params: { userId: USER_ID, dialogId }
      }),
      resMark
    );
    expect(resMark.statusCode).toBe(200);
    expect(resMark.body?.data?.unreadCount).toBe(0);
    expect(resMark.body?.data?.processedMessageCount).toBe(2);

    const statsAfter = await UserDialogStats.findOne({
      tenantId,
      userId: USER_ID,
      dialogId
    }).lean();
    expect(statsAfter?.unreadCount).toBe(0);

    const rowsBySender = await UserDialogUnreadBySenderType.find({
      tenantId,
      userId: USER_ID,
      dialogId
    }).lean();
    rowsBySender.forEach((row) => {
      expect(row.countUnread).toBe(0);
    });

    const status1 = await MessageStatus.findOne({
      tenantId,
      messageId: messageId1,
      userId: USER_ID
    }).sort({ createdAt: -1 }).lean();
    expect(status1?.status).toBe('read');

    const status2 = await MessageStatus.findOne({
      tenantId,
      messageId: messageId2,
      userId: USER_ID
    }).sort({ createdAt: -1 }).lean();
    expect(status2?.status).toBe('read');
  });

  test('markAllRead возвращает 403 если userId не участник диалога', async () => {
    const res1 = createMockRes();
    await dialogController.create(
      createReq({
        body: {
          members: [
            { userId: USER_ID, type: 'user' },
            { userId: CONTACT_ID, type: 'contact' }
          ]
        }
      }),
      res1
    );
    expect(res1.statusCode).toBe(201);
    const dialogId = res1.body?.data?.dialogId;

    const resMark = createMockRes();
    await userDialogController.markAllRead(
      createReq({
        params: { userId: 'other_user_not_member', dialogId }
      }),
      resMark
    );
    expect(resMark.statusCode).toBe(403);
    expect(resMark.body?.message).toMatch(/not a member/i);
  });

  test('markAllRead возвращает 404 если диалог не найден', async () => {
    const resMark = createMockRes();
    await userDialogController.markAllRead(
      createReq({
        params: { userId: USER_ID, dialogId: 'dlg_xxxxxxxxxxxxxxxxxxxx' }
      }),
      resMark
    );
    expect(resMark.statusCode).toBe(404);
    expect(resMark.body?.message).toMatch(/not found/i);
  });
});
