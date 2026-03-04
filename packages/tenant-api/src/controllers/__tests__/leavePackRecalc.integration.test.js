/**
 * Интеграционный тест: пользователь покидает пак с непрочитанными — проверка счётчиков и что полный пересчёт их исправляет.
 * Воспроизводит сценарий: leavePack → счётчик остаётся неправильным → полный пересчёт должен помочь.
 */

import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import { packController } from '../packController.js';
import messageController from '../messageController.js';
import * as userPackController from '../userPackController.js';
import {
  Tenant,
  User,
  UserStats,
  UserDialogStats,
  UserDialogUnreadBySenderType,
  UserPackUnreadBySenderType,
  Pack
} from '@chat3/models';
import { recalculateUserStats } from '@chat3/utils/counterUtils.js';
import {
  recalculateUserPackUnreadBySenderType,
  recalculateUserUnreadBySenderType
} from '@chat3/utils/packStatsUtils.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

const tenantId = 'tnt_default';
const USER_ID = 'usr_leave_recalc';
const CONTACT_ID = 'cnt_leave_recalc';

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

describe('leavePack and full recalculate', () => {
  test('после leavePack счётчики пользователя и пака обнуляются для покинувшего; полный пересчёт сохраняет корректное состояние', async () => {
    await User.create([
      { tenantId, userId: USER_ID, type: 'user' },
      { tenantId, userId: CONTACT_ID, type: 'contact' }
    ]);

    const resPack = createMockRes();
    await packController.create(createReq(), resPack);
    expect(resPack.statusCode).toBe(201);
    const packId = resPack.body?.data?.packId;

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
    const dialogId = resD.body?.data?.dialogId;

    const resL = createMockRes();
    await packController.addDialog(
      createReq({ params: { packId }, body: { dialogId } }),
      resL
    );
    expect(resL.statusCode).toBe(201);

    const resM = createMockRes();
    await messageController.createMessage(
      createReq({
        params: { dialogId },
        body: {
          senderId: CONTACT_ID,
          content: 'Unread in pack',
          type: 'internal.text'
        }
      }),
      resM
    );
    expect(resM.statusCode).toBe(201);

    await recalculateUserPackUnreadBySenderType(tenantId, packId, {
      sourceOperation: 'test-setup',
      sourceEntityId: packId
    });

    const statsBefore = await UserStats.findOne({ tenantId, userId: USER_ID }).lean();
    expect(statsBefore?.totalUnreadCount).toBeGreaterThanOrEqual(1);
    const packUnreadBefore = await UserPackUnreadBySenderType.find({
      tenantId,
      userId: USER_ID,
      packId
    }).lean();
    const totalPackUnreadBefore = packUnreadBefore.reduce((s, r) => s + (r.countUnread || 0), 0);
    expect(totalPackUnreadBefore).toBeGreaterThanOrEqual(1);

    const resLeave = createMockRes();
    await userPackController.leavePack(
      createReq({ params: { userId: USER_ID, packId } }),
      resLeave
    );
    expect(resLeave.statusCode).toBe(200);
    expect(resLeave.body?.data?.leftDialogsCount).toBe(1);

    const statsAfterLeave = await UserStats.findOne({ tenantId, userId: USER_ID }).lean();
    expect(statsAfterLeave?.totalUnreadCount).toBe(0);
    expect(statsAfterLeave?.unreadDialogsCount).toBe(0);

    const packRowsAfterLeave = await UserPackUnreadBySenderType.find({
      tenantId,
      userId: USER_ID,
      packId
    }).lean();
    const totalPackUnreadAfterLeave = packRowsAfterLeave.reduce((s, r) => s + (r.countUnread || 0), 0);
    expect(totalPackUnreadAfterLeave).toBeLessThanOrEqual(totalPackUnreadBefore);
    // UserPackUnreadBySenderType может обнуляться воркером по dialog.member.remove; без воркера — обнулится полным пересчётом ниже

    const dialogUnreadAfterLeave = await UserDialogUnreadBySenderType.find({
      tenantId,
      userId: USER_ID,
      dialogId
    }).lean();
    expect(dialogUnreadAfterLeave.length).toBe(0);

    const packStatsAfterLeave = await UserDialogStats.findOne({
      tenantId,
      userId: USER_ID,
      dialogId
    }).lean();
    expect(packStatsAfterLeave).toBeNull();

    const users = await User.find({ tenantId }).select('userId').lean();
    for (const user of users) {
      await recalculateUserStats(tenantId, user.userId);
    }
    const packIds = await Pack.find({ tenantId }).distinct('packId').exec();
    for (const pId of packIds) {
      await recalculateUserPackUnreadBySenderType(tenantId, pId, {
        sourceOperation: 'full-recalculate-stats',
        sourceEntityId: pId
      });
    }

    const statsAfterRecalc = await UserStats.findOne({ tenantId, userId: USER_ID }).lean();
    expect(statsAfterRecalc?.totalUnreadCount).toBe(0);
    expect(statsAfterRecalc?.unreadDialogsCount).toBe(0);

    const packRowsAfterRecalc = await UserPackUnreadBySenderType.find({
      tenantId,
      userId: USER_ID,
      packId
    }).lean();
    const totalPackUnreadAfterRecalc = packRowsAfterRecalc.reduce((s, r) => s + (r.countUnread || 0), 0);
    expect(totalPackUnreadAfterRecalc).toBe(0);
    // Главная проверка: полный пересчёт обнуляет счётчики пака для покинувшего пользователя
  });

  test('при сиротских UserDialogUnreadBySenderType recalculateUserStats после очистки сирот даёт totalUnreadCount=0 (см. PACK_LEAVE_RECALC_PLAN.md)', async () => {
    await User.create([
      { tenantId, userId: USER_ID, type: 'user' },
      { tenantId, userId: CONTACT_ID, type: 'contact' }
    ]);

    const resPack = createMockRes();
    await packController.create(createReq(), resPack);
    expect(resPack.statusCode).toBe(201);
    const packId = resPack.body?.data?.packId;

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
    const dialogId = resD.body?.data?.dialogId;

    await packController.addDialog(
      createReq({ params: { packId }, body: { dialogId } }),
      createMockRes()
    );

    await messageController.createMessage(
      createReq({
        params: { dialogId },
        body: { senderId: CONTACT_ID, content: 'M', type: 'internal.text' }
      }),
      createMockRes()
    );

    await userPackController.leavePack(
      createReq({ params: { userId: USER_ID, packId } }),
      createMockRes()
    );

    const now = generateTimestamp();
    await UserDialogUnreadBySenderType.create({
      tenantId,
      userId: USER_ID,
      dialogId,
      fromType: 'contact',
      countUnread: 1,
      lastUpdatedAt: now,
      createdAt: now
    });

    await recalculateUserUnreadBySenderType(tenantId, USER_ID);
    const statsWithOrphan = await UserStats.findOne({ tenantId, userId: USER_ID }).lean();
    expect(statsWithOrphan?.totalUnreadCount).toBe(1);

    await recalculateUserStats(tenantId, USER_ID);
    const statsAfterRecalc = await UserStats.findOne({ tenantId, userId: USER_ID }).lean();
    expect(statsAfterRecalc?.totalUnreadCount).toBe(0);
  });
});
