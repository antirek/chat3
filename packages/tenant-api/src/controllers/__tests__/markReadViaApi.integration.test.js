/**
 * Интеграционный тест сценария: контакт отправляет сообщение, user отмечает прочитанным,
 * в списке паков у user в stats.unreadBySenderType для fromType=contact должно быть 0.
 *
 * Все шаги выполняются через вызовы контроллеров (как при HTTP API), с mongodb-memory-server
 * и @onify/fake-amqplib по правилам проекта (AGENTS.md).
 */

import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import { packController } from '../packController.js';
import messageController from '../messageController.js';
import userDialogController from '../userDialogController.js';
import * as userPackController from '../userPackController.js';
import { Tenant } from '@chat3/models';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

const tenantId = 'tnt_default';
const USER_ID = 'usr_test_mark_read';
const CONTACT_ID = 'cnt_test_mark_read';

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

describe('mark read via API flow', () => {
  test('после отметки сообщения от contact как read у user в packs stats.unreadBySenderType[contact] = 0', async () => {
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
    await packController.create(createReq(), res2);
    expect(res2.statusCode).toBe(201);
    const packId = res2.body?.data?.packId;
    expect(packId).toBeDefined();

    const res3 = createMockRes();
    await packController.addDialog(
      createReq({ params: { packId }, body: { dialogId } }),
      res3
    );
    expect(res3.statusCode).toBe(201);

    const res4 = createMockRes();
    await messageController.createMessage(
      createReq({
        params: { dialogId },
        body: {
          senderId: CONTACT_ID,
          content: 'Test message from contact',
          type: 'internal.text'
        }
      }),
      res4
    );
    expect(res4.statusCode).toBe(201);
    const messageId = res4.body?.data?.messageId;
    expect(messageId).toBeDefined();

    const res5 = createMockRes();
    await userDialogController.updateMessageStatus(
      createReq({
        params: {
          userId: USER_ID,
          dialogId,
          messageId,
          status: 'read'
        }
      }),
      res5
    );
    expect(res5.statusCode).toBe(200);

    const res6 = createMockRes();
    await userPackController.getUserPacks(
      createReq({ params: { userId: USER_ID } }),
      res6
    );
    expect(res6.statusCode).toBe(200);
    const packs = res6.body?.data ?? [];
    const pack = packs.find((p) => p.packId === packId);
    expect(pack).toBeDefined();

    const unreadBySenderType = pack?.stats?.unreadBySenderType ?? [];
    const contactEntry = unreadBySenderType.find((e) => e.fromType === 'contact');
    const countContact = contactEntry?.countUnread ?? null;

    expect(countContact).toBe(0);
  });
});
