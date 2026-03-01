/**
 * Интеграционный тест полного пересчёта счетчиков (логика fullRecalculateStats).
 * Проверяет: recalculateUserStats для всех пользователей, затем recalculateUserPackUnreadBySenderType для всех паков;
 * после пересчёта UserStats и UserPackUnreadBySenderType содержат ожидаемые значения.
 */

import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import { packController } from '../packController.js';
import messageController from '../messageController.js';
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
import { recalculateUserPackUnreadBySenderType } from '@chat3/utils/packStatsUtils.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

const tenantId = 'tnt_default';
const USER_ID = 'usr_full_recalc';
const CONTACT_ID = 'cnt_full_recalc';

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

describe('fullRecalculateStats logic (calculation)', () => {
  test('после полного пересчёта (recalculateUserStats по пользователям + recalculateUserPackUnreadBySenderType по пакам) UserStats и UserPackUnreadBySenderType соответствуют данным', async () => {
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
          content: 'Hello',
          type: 'internal.text'
        }
      }),
      resM
    );
    expect(resM.statusCode).toBe(201);

    // Этап 1: пересчёт UserStats для всех пользователей (как в fullRecalculateStats)
    const users = await User.find({ tenantId }).select('userId').lean();
    for (const user of users) {
      await recalculateUserStats(tenantId, user.userId);
    }

    // Этап 2: синхронизация паков
    const packIds = await Pack.find({ tenantId }).distinct('packId').exec();
    for (const pId of packIds) {
      await recalculateUserPackUnreadBySenderType(tenantId, pId, {
        sourceOperation: 'full-recalculate-stats',
        sourceEntityId: pId
      });
    }

    const userStats = await UserStats.findOne({ tenantId, userId: USER_ID }).lean();
    expect(userStats).toBeTruthy();
    expect(userStats.dialogCount).toBe(1);
    expect(userStats.unreadDialogsCount).toBe(1);
    expect(userStats.totalUnreadCount).toBe(1);
    expect(userStats.totalMessagesCount).toBe(0);

    const contactStats = await UserStats.findOne({ tenantId, userId: CONTACT_ID }).lean();
    expect(contactStats).toBeTruthy();
    expect(contactStats.dialogCount).toBe(1);
    expect(contactStats.totalMessagesCount).toBe(1);

    const userDialogStats = await UserDialogStats.findOne({
      tenantId,
      userId: USER_ID,
      dialogId
    }).lean();
    expect(userDialogStats).toBeTruthy();
    expect(userDialogStats.unreadCount).toBe(1);

    const packRows = await UserPackUnreadBySenderType.find({
      tenantId,
      userId: USER_ID,
      packId
    }).lean();
    const totalPackUnread = packRows.reduce((s, r) => s + (r.countUnread || 0), 0);
    expect(totalPackUnread).toBe(1);
  });
});
