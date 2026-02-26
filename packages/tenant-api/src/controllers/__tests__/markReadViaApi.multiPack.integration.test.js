/**
 * Интеграционный тест сценария «диалог в нескольких паках»: один диалог добавлен в несколько паков.
 * Счётчик unread (fromType=contact) растёт во всех паках с диалогом при новом сообщении
 * и уменьшается во всех этих паках при прочтении.
 *
 * Структура: 3 пака (P0, P1, P2), 2 диалога — D0 в P0 и P1, D1 в P1 и P2.
 * По 3 сообщения в каждом диалоге; проверки после всех сообщений и после каждого этапа прочтения.
 *
 * Все шаги через вызовы контроллеров (mongodb-memory-server, @onify/fake-amqplib).
 * Пересчёт паковых счётчиков симулируется вызовом recalculateUserPackUnreadBySenderType.
 */

import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import { packController } from '../packController.js';
import messageController from '../messageController.js';
import userDialogController from '../userDialogController.js';
import * as userPackController from '../userPackController.js';
import { getPackIdsForDialog, recalculateUserPackUnreadBySenderType } from '@chat3/utils/packStatsUtils.js';
import { Tenant } from '@chat3/models';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

const tenantId = 'tnt_default';
const MESSAGES_PER_DIALOG = 3;

const USER_IDS = ['usr_mp1', 'usr_mp2', 'usr_mp3'];
const CONTACT_IDS = ['cnt_mp1', 'cnt_mp2'];

const DIALOGS = [
  { contact: CONTACT_IDS[0], users: [USER_IDS[0], USER_IDS[1]], packIndexes: [0, 1] },
  { contact: CONTACT_IDS[1], users: [USER_IDS[1], USER_IDS[2]], packIndexes: [1, 2] }
];

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

function getContactUnread(pack) {
  const arr = pack?.stats?.unreadBySenderType ?? [];
  const e = arr.find((x) => x.fromType === 'contact');
  return e?.countUnread ?? 0;
}

async function getPacksByUser(userId) {
  const res = createMockRes();
  await userPackController.getUserPacks(createReq({ params: { userId } }), res);
  if (res.statusCode !== 200) throw new Error(`getUserPacks ${res.statusCode}`);
  return (res.body?.data ?? []).reduce((acc, p) => {
    acc[p.packId] = p;
    return acc;
  }, {});
}

async function simulatePackRecalcForDialog(dialogId, sourceOperation, sourceEntityId) {
  const packIds = await getPackIdsForDialog(tenantId, dialogId);
  for (const packId of packIds) {
    await recalculateUserPackUnreadBySenderType(tenantId, packId, {
      sourceOperation,
      sourceEntityId
    });
  }
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

describe('mark read via API — диалог в нескольких паках', () => {
  test('3 пака, 2 диалога (D0 в P0+P1, D1 в P1+P2), по 3 сообщения, прочтение по очереди — счётчики во всех паках корректны', async () => {
    const N = MESSAGES_PER_DIALOG;
    const packIds = [];
    const dialogIds = [];
    const messageIds = [[], []];

    // 1. Создаём 3 пака
    for (let i = 0; i < 3; i++) {
      const res = createMockRes();
      await packController.create(createReq(), res);
      expect(res.statusCode).toBe(201);
      const packId = res.body?.data?.packId;
      expect(packId).toBeDefined();
      packIds.push(packId);
    }

    // 2. Создаём 2 диалога и добавляем каждый в несколько паков
    for (let di = 0; di < DIALOGS.length; di++) {
      const d = DIALOGS[di];
      const members = [
        { userId: d.contact, type: 'contact' },
        ...d.users.map((uid) => ({ userId: uid, type: 'user' }))
      ];
      const resD = createMockRes();
      await dialogController.create(createReq({ body: { members } }), resD);
      expect(resD.statusCode).toBe(201);
      const dialogId = resD.body?.data?.dialogId;
      expect(dialogId).toBeDefined();
      dialogIds.push(dialogId);
      for (const packIdx of d.packIndexes) {
        const resL = createMockRes();
        await packController.addDialog(
          createReq({ params: { packId: packIds[packIdx] }, body: { dialogId } }),
          resL
        );
        expect(resL.statusCode).toBe(201);
      }
    }

    // 3. По N сообщений в каждом диалоге от contact + пересчёт паков после каждого
    for (let di = 0; di < DIALOGS.length; di++) {
      const d = DIALOGS[di];
      for (let k = 0; k < N; k++) {
        const res = createMockRes();
        await messageController.createMessage(
          createReq({
            params: { dialogId: dialogIds[di] },
            body: {
              senderId: d.contact,
              content: `Message ${k + 1}/${N} from ${d.contact} in dialog ${di}`,
              type: 'internal.text'
            }
          }),
          res
        );
        expect(res.statusCode).toBe(201);
        const messageId = res.body?.data?.messageId;
        expect(messageId).toBeDefined();
        messageIds[di].push(messageId);
        await simulatePackRecalcForDialog(dialogIds[di], 'message.create', messageId);
      }
    }

    // Проверка после всех сообщений
    const expectedAfterAllMessages = {
      [USER_IDS[0]]: { [packIds[0]]: N, [packIds[1]]: N },
      [USER_IDS[1]]: { [packIds[0]]: N, [packIds[1]]: N * 2, [packIds[2]]: N },
      [USER_IDS[2]]: { [packIds[1]]: N, [packIds[2]]: N }
    };
    for (const [userId, expected] of Object.entries(expectedAfterAllMessages)) {
      const byPack = await getPacksByUser(userId);
      for (const [packId, expectedCount] of Object.entries(expected)) {
        const actual = getContactUnread(byPack[packId]);
        expect(actual).toBe(expectedCount);
      }
    }

    // 4. user1 читает все сообщения в D0
    for (const msgId of messageIds[0]) {
      const res = createMockRes();
      await userDialogController.updateMessageStatus(
        createReq({
          params: { userId: USER_IDS[0], dialogId: dialogIds[0], messageId: msgId, status: 'read' }
        }),
        res
      );
      expect(res.statusCode).toBe(200);
      await simulatePackRecalcForDialog(dialogIds[0], 'message.status.update', msgId);
    }
    const expectedAfterU1ReadD0 = {
      [USER_IDS[0]]: { [packIds[0]]: 0, [packIds[1]]: 0 },
      [USER_IDS[1]]: { [packIds[0]]: N, [packIds[1]]: N * 2, [packIds[2]]: N },
      [USER_IDS[2]]: { [packIds[1]]: N, [packIds[2]]: N }
    };
    for (const [userId, expected] of Object.entries(expectedAfterU1ReadD0)) {
      const byPack = await getPacksByUser(userId);
      for (const [packId, expectedCount] of Object.entries(expected)) {
        expect(getContactUnread(byPack[packId])).toBe(expectedCount);
      }
    }

    // 5. user2 читает все сообщения в D0
    for (const msgId of messageIds[0]) {
      const res = createMockRes();
      await userDialogController.updateMessageStatus(
        createReq({
          params: { userId: USER_IDS[1], dialogId: dialogIds[0], messageId: msgId, status: 'read' }
        }),
        res
      );
      expect(res.statusCode).toBe(200);
      await simulatePackRecalcForDialog(dialogIds[0], 'message.status.update', msgId);
    }
    const expectedAfterU2ReadD0 = {
      [USER_IDS[0]]: { [packIds[0]]: 0, [packIds[1]]: 0 },
      [USER_IDS[1]]: { [packIds[0]]: 0, [packIds[1]]: N, [packIds[2]]: N },
      [USER_IDS[2]]: { [packIds[1]]: N, [packIds[2]]: N }
    };
    for (const [userId, expected] of Object.entries(expectedAfterU2ReadD0)) {
      const byPack = await getPacksByUser(userId);
      for (const [packId, expectedCount] of Object.entries(expected)) {
        expect(getContactUnread(byPack[packId])).toBe(expectedCount);
      }
    }

    // 6. user2 читает все сообщения в D1
    for (const msgId of messageIds[1]) {
      const res = createMockRes();
      await userDialogController.updateMessageStatus(
        createReq({
          params: { userId: USER_IDS[1], dialogId: dialogIds[1], messageId: msgId, status: 'read' }
        }),
        res
      );
      expect(res.statusCode).toBe(200);
      await simulatePackRecalcForDialog(dialogIds[1], 'message.status.update', msgId);
    }
    const expectedAfterU2ReadD1 = {
      [USER_IDS[0]]: { [packIds[0]]: 0, [packIds[1]]: 0 },
      [USER_IDS[1]]: { [packIds[0]]: 0, [packIds[1]]: 0, [packIds[2]]: 0 },
      [USER_IDS[2]]: { [packIds[1]]: N, [packIds[2]]: N }
    };
    for (const [userId, expected] of Object.entries(expectedAfterU2ReadD1)) {
      const byPack = await getPacksByUser(userId);
      for (const [packId, expectedCount] of Object.entries(expected)) {
        expect(getContactUnread(byPack[packId])).toBe(expectedCount);
      }
    }

    // 7. user3 читает все сообщения в D1 — финал: у всех 0
    for (const msgId of messageIds[1]) {
      const res = createMockRes();
      await userDialogController.updateMessageStatus(
        createReq({
          params: { userId: USER_IDS[2], dialogId: dialogIds[1], messageId: msgId, status: 'read' }
        }),
        res
      );
      expect(res.statusCode).toBe(200);
      await simulatePackRecalcForDialog(dialogIds[1], 'message.status.update', msgId);
    }
    const expectedFinal = {
      [USER_IDS[0]]: { [packIds[0]]: 0, [packIds[1]]: 0 },
      [USER_IDS[1]]: { [packIds[0]]: 0, [packIds[1]]: 0, [packIds[2]]: 0 },
      [USER_IDS[2]]: { [packIds[1]]: 0, [packIds[2]]: 0 }
    };
    for (const [userId, expected] of Object.entries(expectedFinal)) {
      const byPack = await getPacksByUser(userId);
      for (const [packId, expectedCount] of Object.entries(expected)) {
        expect(getContactUnread(byPack[packId])).toBe(expectedCount);
      }
    }
  });
});
