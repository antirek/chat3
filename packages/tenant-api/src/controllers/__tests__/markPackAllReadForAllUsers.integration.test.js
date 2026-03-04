/**
 * Интеграционный тест POST markAllReadForAllUsers: все сообщения пака отмечаются прочитанными для всех пользователей.
 * Пак из нескольких диалогов и нескольких пользователей; проверка обнуления счётчиков и MessageStatus для каждого пользователя; 404 при отсутствии пака.
 */

import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import { packController } from '../packController.js';
import messageController from '../messageController.js';
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
const USER_A = 'usr_pack_all_a';
const USER_B = 'usr_pack_all_b';
const CONTACT_ID = 'cnt_pack_all';

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

describe('markAllReadForAllUsers integration', () => {
  test('markAllReadForAllUsers обнуляет счётчики и проставляет MessageStatus read для всех пользователей пака', async () => {
    const resPack = createMockRes();
    await packController.create(createReq(), resPack);
    expect(resPack.statusCode).toBe(201);
    const packId = resPack.body?.data?.packId;
    expect(packId).toBeDefined();

    // Диалог 1: USER_A + CONTACT_ID
    const resD1 = createMockRes();
    await dialogController.create(
      createReq({
        body: {
          members: [
            { userId: USER_A, type: 'user' },
            { userId: CONTACT_ID, type: 'contact' }
          ]
        }
      }),
      resD1
    );
    expect(resD1.statusCode).toBe(201);
    const dialogId1 = resD1.body?.data?.dialogId;

    // Диалог 2: USER_A + USER_B + CONTACT_ID
    const resD2 = createMockRes();
    await dialogController.create(
      createReq({
        body: {
          members: [
            { userId: USER_A, type: 'user' },
            { userId: USER_B, type: 'user' },
            { userId: CONTACT_ID, type: 'contact' }
          ]
        }
      }),
      resD2
    );
    expect(resD2.statusCode).toBe(201);
    const dialogId2 = resD2.body?.data?.dialogId;

    const resL1 = createMockRes();
    await packController.addDialog(
      createReq({ params: { packId }, body: { dialogId: dialogId1 } }),
      resL1
    );
    expect(resL1.statusCode).toBe(201);
    const resL2 = createMockRes();
    await packController.addDialog(
      createReq({ params: { packId }, body: { dialogId: dialogId2 } }),
      resL2
    );
    expect(resL2.statusCode).toBe(201);

    // Сообщение в диалоге 1 (от контакта) — непрочитано для USER_A
    const resM1 = createMockRes();
    await messageController.createMessage(
      createReq({
        params: { dialogId: dialogId1 },
        body: {
          senderId: CONTACT_ID,
          content: 'Message in dialog 1',
          type: 'internal.text'
        }
      }),
      resM1
    );
    expect(resM1.statusCode).toBe(201);
    const messageId1 = resM1.body?.data?.messageId;

    // Сообщение в диалоге 2 (от контакта) — непрочитано для USER_A и USER_B
    const resM2 = createMockRes();
    await messageController.createMessage(
      createReq({
        params: { dialogId: dialogId2 },
        body: {
          senderId: CONTACT_ID,
          content: 'Message in dialog 2',
          type: 'internal.text'
        }
      }),
      resM2
    );
    expect(resM2.statusCode).toBe(201);
    const messageId2 = resM2.body?.data?.messageId;

    const statsBeforeA = await UserDialogStats.find({
      tenantId,
      userId: USER_A,
      dialogId: { $in: [dialogId1, dialogId2] }
    }).lean();
    expect(statsBeforeA.length).toBe(2);
    statsBeforeA.forEach((s) => expect(s.unreadCount).toBeGreaterThanOrEqual(1));

    const statsBeforeB = await UserDialogStats.find({
      tenantId,
      userId: USER_B,
      dialogId: dialogId2
    }).lean();
    expect(statsBeforeB.length).toBe(1);
    expect(statsBeforeB[0].unreadCount).toBe(1);

    const resMark = createMockRes();
    await packController.markAllReadForAllUsers(
      createReq({ params: { packId } }),
      resMark
    );
    expect(resMark.statusCode).toBe(200);
    expect(resMark.body?.data?.packId).toBe(packId);
    // В паке 3 участника (USER_A, USER_B, CONTACT_ID) — distinct по всем DialogMember
    expect(resMark.body?.data?.processedUsersCount).toBe(3);
    // USER_A: 2 диалога, USER_B: 1, CONTACT_ID: 2 диалога
    expect(resMark.body?.data?.processedDialogsCount).toBe(5);
    // Сообщения помечаются только получателям (не отправителю): USER_A 2, USER_B 1; у CONTACT сообщения свои — 0
    expect(resMark.body?.data?.totalProcessedMessageCount).toBe(3);

    const statsAfterA = await UserDialogStats.find({
      tenantId,
      userId: USER_A,
      dialogId: { $in: [dialogId1, dialogId2] }
    }).lean();
    statsAfterA.forEach((s) => expect(s.unreadCount).toBe(0));

    const statsAfterB = await UserDialogStats.find({
      tenantId,
      userId: USER_B,
      dialogId: dialogId2
    }).lean();
    statsAfterB.forEach((s) => expect(s.unreadCount).toBe(0));

    const packRowsA = await UserPackUnreadBySenderType.find({
      tenantId,
      userId: USER_A,
      packId
    }).lean();
    const totalPackUnreadA = packRowsA.reduce((s, r) => s + (r.countUnread || 0), 0);
    expect(totalPackUnreadA).toBe(0);

    const packRowsB = await UserPackUnreadBySenderType.find({
      tenantId,
      userId: USER_B,
      packId
    }).lean();
    const totalPackUnreadB = packRowsB.reduce((s, r) => s + (r.countUnread || 0), 0);
    expect(totalPackUnreadB).toBe(0);

    const status1A = await MessageStatus.findOne({
      tenantId,
      messageId: messageId1,
      userId: USER_A
    })
      .sort({ createdAt: -1 })
      .lean();
    expect(status1A?.status).toBe('read');

    const status2A = await MessageStatus.findOne({
      tenantId,
      messageId: messageId2,
      userId: USER_A
    })
      .sort({ createdAt: -1 })
      .lean();
    expect(status2A?.status).toBe('read');

    const status2B = await MessageStatus.findOne({
      tenantId,
      messageId: messageId2,
      userId: USER_B
    })
      .sort({ createdAt: -1 })
      .lean();
    expect(status2B?.status).toBe('read');
  });

  test('markAllReadForAllUsers при пустом паке возвращает 200 с нулевыми счётчиками', async () => {
    const resPack = createMockRes();
    await packController.create(createReq(), resPack);
    expect(resPack.statusCode).toBe(201);
    const packId = resPack.body?.data?.packId;

    const res = createMockRes();
    await packController.markAllReadForAllUsers(
      createReq({ params: { packId } }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body?.data?.packId).toBe(packId);
    expect(res.body?.data?.processedUsersCount).toBe(0);
    expect(res.body?.data?.processedDialogsCount).toBe(0);
    expect(res.body?.data?.totalProcessedMessageCount).toBe(0);
  });

  test('markAllReadForAllUsers возвращает 404 если пак не найден', async () => {
    const res = createMockRes();
    await packController.markAllReadForAllUsers(
      createReq({ params: { packId: 'pck_nonexistentxxxxxxxx' } }),
      res
    );
    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toMatch(/not found/i);
  });
});

describe('markAllReadForAllUsers scale integration', () => {
  const NUM_DIALOGS = 8;
  const MESSAGES_PER_DIALOG = 3;
  const USER_IDS = ['usr_scale_0', 'usr_scale_1', 'usr_scale_2', 'usr_scale_3', 'usr_scale_4'];
  const SENDER_ID = 'cnt_scale_sender'; // во всех диалогах шлёт сообщения — непрочитано для остальных

  /** Сетка: dialogIndex -> [userId, ...]. Каждый диалог — несколько пользователей + SENDER_ID. */
  function getMembersForDialog(dialogIndex) {
    const idx = dialogIndex % NUM_DIALOGS;
    if (idx <= 2) return [USER_IDS[idx], SENDER_ID];
    if (idx <= 4) return [USER_IDS[idx - 2], USER_IDS[idx - 1], USER_IDS[idx], SENDER_ID];
    if (idx === 5) return [USER_IDS[0], USER_IDS[2], SENDER_ID];
    if (idx === 6) return [USER_IDS[1], USER_IDS[3], SENDER_ID];
    return [USER_IDS[0], USER_IDS[1], USER_IDS[2], USER_IDS[3], USER_IDS[4], SENDER_ID];
  }

  test('markAllReadForAllUsers обрабатывает пак с 8 диалогами, 6 участниками и десятками сообщений', async () => {
    const resPack = createMockRes();
    await packController.create(createReq(), resPack);
    expect(resPack.statusCode).toBe(201);
    const packId = resPack.body?.data?.packId;
    expect(packId).toBeDefined();

    const dialogIds = [];
    for (let d = 0; d < NUM_DIALOGS; d++) {
      const members = getMembersForDialog(d).map((userId) => ({
        userId,
        type: userId === SENDER_ID ? 'contact' : 'user'
      }));
      const resD = createMockRes();
      await dialogController.create(
        createReq({ body: { members } }),
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

    const allMessageIds = [];
    for (let d = 0; d < NUM_DIALOGS; d++) {
      for (let m = 0; m < MESSAGES_PER_DIALOG; m++) {
        const resM = createMockRes();
        await messageController.createMessage(
          createReq({
            params: { dialogId: dialogIds[d] },
            body: {
              senderId: SENDER_ID,
              content: `Scale message d${d} m${m}`,
              type: 'internal.text'
            }
          }),
          resM
        );
        expect(resM.statusCode).toBe(201);
        allMessageIds.push({ dialogIndex: d, messageId: resM.body?.data?.messageId });
      }
    }

    const uniqueUserIds = [...new Set(dialogIds.flatMap((_, i) => getMembersForDialog(i)))];
    const expectedUserCount = uniqueUserIds.length;

    let expectedProcessedDialogs = 0;
    let expectedProcessedMessages = 0;
    for (const uid of uniqueUserIds) {
      const memberDialogs = dialogIds.filter((_, di) => getMembersForDialog(di).includes(uid));
      expectedProcessedDialogs += memberDialogs.length;
      for (let di = 0; di < memberDialogs.length; di++) {
        if (uid !== SENDER_ID) expectedProcessedMessages += MESSAGES_PER_DIALOG;
      }
    }

    const resMark = createMockRes();
    await packController.markAllReadForAllUsers(
      createReq({ params: { packId } }),
      resMark
    );
    expect(resMark.statusCode).toBe(200);
    expect(resMark.body?.data?.packId).toBe(packId);
    expect(resMark.body?.data?.processedUsersCount).toBe(expectedUserCount);
    expect(resMark.body?.data?.processedDialogsCount).toBe(expectedProcessedDialogs);
    expect(resMark.body?.data?.totalProcessedMessageCount).toBe(expectedProcessedMessages);

    for (const uid of uniqueUserIds) {
      const memberDialogs = dialogIds.filter((_, di) => getMembersForDialog(di).includes(uid));
      const statsAfter = await UserDialogStats.find({
        tenantId,
        userId: uid,
        dialogId: { $in: memberDialogs }
      }).lean();
      statsAfter.forEach((s) => expect(s.unreadCount).toBe(0));

      const packRows = await UserPackUnreadBySenderType.find({
        tenantId,
        userId: uid,
        packId
      }).lean();
      const totalPackUnread = packRows.reduce((s, r) => s + (r.countUnread || 0), 0);
      expect(totalPackUnread).toBe(0);
    }

    for (const { dialogIndex, messageId } of allMessageIds) {
      const members = getMembersForDialog(dialogIndex).filter((id) => id !== SENDER_ID);
      for (const uid of members) {
        const status = await MessageStatus.findOne({
          tenantId,
          messageId,
          userId: uid
        })
          .sort({ createdAt: -1 })
          .lean();
        expect(status?.status).toBe('read');
      }
    }
  });
});
