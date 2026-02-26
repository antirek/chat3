/**
 * Интеграционный тест сложного сценария: 5 паков, 10 user, 5 contact, 5 диалогов,
 * contact'ы отправляют сообщения, выборочные user отмечают прочитанным.
 * Проверка: целевые счётчики unreadBySenderType (fromType=contact) по пользователям и пакам.
 *
 * Все шаги через вызовы контроллеров (mongodb-memory-server, @onify/fake-amqplib).
 * Пересчёт паковых счётчиков симулируется вызовом recalculateUserPackUnreadBySenderType
 * после createMessage и updateMessageStatus (воркер в тесте не запускается).
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

const USER_IDS = ['usr_cx1', 'usr_cx2', 'usr_cx3', 'usr_cx4', 'usr_cx5', 'usr_cx6', 'usr_cx7', 'usr_cx8', 'usr_cx9', 'usr_cx10'];
const CONTACT_IDS = ['cnt_cx1', 'cnt_cx2', 'cnt_cx3', 'cnt_cx4', 'cnt_cx5'];

const DIALOGS = [
  { packIndex: 0, contact: CONTACT_IDS[0], users: [USER_IDS[0], USER_IDS[1], USER_IDS[2]] },
  { packIndex: 1, contact: CONTACT_IDS[1], users: [USER_IDS[1], USER_IDS[3], USER_IDS[4]] },
  { packIndex: 2, contact: CONTACT_IDS[2], users: [USER_IDS[0], USER_IDS[4], USER_IDS[5]] },
  { packIndex: 3, contact: CONTACT_IDS[3], users: [USER_IDS[2], USER_IDS[5], USER_IDS[6]] },
  { packIndex: 4, contact: CONTACT_IDS[4], users: [USER_IDS[3], USER_IDS[6], USER_IDS[7], USER_IDS[8], USER_IDS[9]] }
];

const MARK_READ_BY = [USER_IDS[0], USER_IDS[1], USER_IDS[4], USER_IDS[5], USER_IDS[7]];

function buildExpected(packIds) {
  const expected = {};
  for (let di = 0; di < DIALOGS.length; di++) {
    const d = DIALOGS[di];
    const packId = packIds[d.packIndex];
    const reader = MARK_READ_BY[di];
    for (const uid of d.users) {
      if (!expected[uid]) expected[uid] = {};
      expected[uid][packId] = uid === reader ? 0 : 1;
    }
  }
  return expected;
}

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

/** Симулирует воркер: пересчёт паковых счётчиков по диалогу */
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

describe('mark read via API — сложный сценарий', () => {
  test('5 паков, 5 диалогов, сообщения от contact, выборочный mark read — счётчики contact корректны', async () => {
    const dialogIds = [];
    const packIds = [];

    // 1. Создаём 5 паков
    for (let i = 0; i < 5; i++) {
      const res = createMockRes();
      await packController.create(createReq(), res);
      expect(res.statusCode).toBe(201);
      const packId = res.body?.data?.packId;
      expect(packId).toBeDefined();
      packIds.push(packId);
    }

    const expected = buildExpected(packIds);

    // 2. Создаём 5 диалогов и привязываем к пакам
    for (let i = 0; i < DIALOGS.length; i++) {
      const d = DIALOGS[i];
      const members = [
        { userId: d.contact, type: 'contact' },
        ...d.users.map((uid) => ({ userId: uid, type: 'user' }))
      ];
      const resD = createMockRes();
      await dialogController.create(
        createReq({ body: { members } }),
        resD
      );
      expect(resD.statusCode).toBe(201);
      const dialogId = resD.body?.data?.dialogId;
      expect(dialogId).toBeDefined();
      dialogIds.push(dialogId);

      const resL = createMockRes();
      await packController.addDialog(
        createReq({ params: { packId: packIds[d.packIndex] }, body: { dialogId } }),
        resL
      );
      expect(resL.statusCode).toBe(201);
    }

    // 3. В каждом диалоге contact отправляет сообщение + симулируем пересчёт пака
    const messageIds = [];
    for (let i = 0; i < DIALOGS.length; i++) {
      const d = DIALOGS[i];
      const res = createMockRes();
      await messageController.createMessage(
        createReq({
          params: { dialogId: dialogIds[i] },
          body: {
            senderId: d.contact,
            content: `Message from ${d.contact} in dialog ${i}`,
            type: 'internal.text'
          }
        }),
        res
      );
      expect(res.statusCode).toBe(201);
      const messageId = res.body?.data?.messageId;
      expect(messageId).toBeDefined();
      messageIds.push(messageId);
      await simulatePackRecalcForDialog(dialogIds[i], 'message.create', messageId);
    }

    // 4. Выборочно user отмечают прочитанным + пересчёт пака
    for (let i = 0; i < DIALOGS.length; i++) {
      const reader = MARK_READ_BY[i];
      const res = createMockRes();
      await userDialogController.updateMessageStatus(
        createReq({
          params: {
            userId: reader,
            dialogId: dialogIds[i],
            messageId: messageIds[i],
            status: 'read'
          }
        }),
        res
      );
      expect(res.statusCode).toBe(200);
      await simulatePackRecalcForDialog(dialogIds[i], 'message.status.update', messageIds[i]);
    }

    // 5. Проверка: для каждой пары (userId, packId) из expected — getUserPacks и сверка contact count
    const errors = [];
    const checked = new Set();

    for (const [userId, perPack] of Object.entries(expected)) {
      const res = createMockRes();
      await userPackController.getUserPacks(
        createReq({ params: { userId } }),
        res
      );
      expect(res.statusCode).toBe(200);
      const packs = res.body?.data ?? [];
      for (const [packId, expectedCount] of Object.entries(perPack)) {
        const pack = packs.find((p) => p.packId === packId);
        if (!pack) {
          errors.push(`${userId} / ${packId}: пак не найден в списке пользователя`);
          continue;
        }
        const actual = getContactUnread(pack);
        if (actual !== expectedCount) {
          errors.push(`${userId} / ${packId}: ожидалось contact=${expectedCount}, получено ${actual}`);
        }
        checked.add(`${userId}:${packId}`);
      }
    }

    expect(errors).toEqual([]);
    expect(checked.size).toBe(17);
  });
});
