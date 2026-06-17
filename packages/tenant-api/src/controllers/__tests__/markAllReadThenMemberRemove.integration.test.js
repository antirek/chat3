/**
 * P4: markAllReadForAllUsers → dialog.member.remove не восстанавливает pack contact unread.
 * См. docs/proposal/PACK_UNREAD_P4_MEMBER_REMOVE_AFTER_MARK_ALL_READ_PLAN.md
 */
import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import { packController } from '../packController.js';
import dialogMemberController from '../dialogMemberController.js';
import messageController from '../messageController.js';
import {
  DialogMember,
  OutboxEvent,
  Tenant,
  User,
  UserDialogStats,
  UserDialogUnreadBySenderType,
  UserPackUnreadBySenderType,
  UserPackedMessagesUnreadBySenderType,
  UserStats
} from '@chat3/models';
import { isCounterEventType } from '@chat3/utils/counterProcessor/counterEvents.js';
import { processCounterEvent } from '@chat3/utils/counterProcessor/processCounterEvent.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { flushCounterEvents } from '../../utils/__tests__/counterTestHelpers.js';

const tenantId = 'tnt_p4_mark_remove';
const OPERATOR_ID = 'usr_p4_operator';
const CONTACT_ID = 'cnt_p4_contact';

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

async function sumPackContactUnread(userId, packId) {
  const rows = await UserPackUnreadBySenderType.find({
    tenantId,
    userId,
    packId,
    fromType: 'contact'
  }).lean();
  return rows.reduce((sum, row) => sum + (row.countUnread || 0), 0);
}

async function sumPackedMessagesContactUnread(userId, packId) {
  const rows = await UserPackedMessagesUnreadBySenderType.find({
    tenantId,
    userId,
    packId,
    fromType: 'contact'
  }).lean();
  return rows.reduce((sum, row) => sum + (row.countUnread || 0), 0);
}

async function setupProposalPack() {
  const resPack = createMockRes();
  await packController.create(createReq(), resPack);
  expect(resPack.statusCode).toBe(201);
  const packId = resPack.body?.data?.packId;

  const resDlgA = createMockRes();
  await dialogController.create(
    createReq({
      body: {
        members: [
          { userId: OPERATOR_ID, type: 'user' },
          { userId: CONTACT_ID, type: 'contact' }
        ]
      }
    }),
    resDlgA
  );
  expect(resDlgA.statusCode).toBe(201);
  const dialogIdA = resDlgA.body?.data?.dialogId;

  const resDlgB = createMockRes();
  await dialogController.create(
    createReq({
      body: {
        members: [
          { userId: OPERATOR_ID, type: 'user' },
          { userId: CONTACT_ID, type: 'contact' }
        ]
      }
    }),
    resDlgB
  );
  expect(resDlgB.statusCode).toBe(201);
  const dialogIdB = resDlgB.body?.data?.dialogId;

  await packController.addDialog(
    createReq({ params: { packId }, body: { dialogId: dialogIdA } }),
    createMockRes()
  );
  await packController.addDialog(
    createReq({ params: { packId }, body: { dialogId: dialogIdB } }),
    createMockRes()
  );

  const resInbound = createMockRes();
  await messageController.createMessage(
    createReq({
      params: { dialogId: dialogIdA },
      body: {
        senderId: CONTACT_ID,
        content: 'Inbound from contact',
        type: 'internal.text'
      }
    }),
    resInbound
  );
  expect(resInbound.statusCode).toBe(201);

  const resOutbound = createMockRes();
  await messageController.createMessage(
    createReq({
      params: { dialogId: dialogIdB },
      body: {
        senderId: OPERATOR_ID,
        content: 'Outbound from operator',
        type: 'internal.text'
      }
    }),
    resOutbound
  );
  expect(resOutbound.statusCode).toBe(201);

  await flushCounterEvents();

  return { packId, dialogIdA, dialogIdB };
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
    name: 'P4 Mark Remove Tenant',
    domain: 'p4-mark-remove.chat3.com',
    type: 'client',
    isActive: true,
    createdAt: generateTimestamp()
  });
  await User.create([
    { tenantId, userId: OPERATOR_ID, type: 'user' },
    { tenantId, userId: CONTACT_ID, type: 'contact' }
  ]);
});

describe('P4 markAllReadForAllUsers then member.remove', () => {
  test('P4-I1: после markAllRead и remove из outbound-dialog pack contact unread остаётся 0', async () => {
    const { packId, dialogIdA, dialogIdB } = await setupProposalPack();

    const statsBefore = await UserStats.findOne({ tenantId, userId: OPERATOR_ID }).lean();
    expect(statsBefore?.totalUnreadCount).toBeGreaterThanOrEqual(1);
    const dialogCountBefore = statsBefore?.dialogCount ?? 0;
    expect(dialogCountBefore).toBeGreaterThanOrEqual(2);

    const resMark = createMockRes();
    await packController.markAllReadForAllUsers(
      createReq({ params: { packId }, query: { memberType: 'user' } }),
      resMark
    );
    expect(resMark.statusCode).toBe(200);
    await flushCounterEvents();

    const dlgAStatsAfterMark = await UserDialogStats.findOne({
      tenantId,
      userId: OPERATOR_ID,
      dialogId: dialogIdA
    }).lean();
    expect(dlgAStatsAfterMark?.unreadCount).toBe(0);
    expect(await sumPackContactUnread(OPERATOR_ID, packId)).toBe(0);

    const resRemove = createMockRes();
    await dialogMemberController.removeDialogMember(
      createReq({ params: { dialogId: dialogIdB, userId: OPERATOR_ID } }),
      resRemove
    );
    expect(resRemove.statusCode).toBe(200);
    await flushCounterEvents();

    expect(
      await DialogMember.findOne({ tenantId, userId: OPERATOR_ID, dialogId: dialogIdB }).lean()
    ).toBeNull();
    expect(
      await DialogMember.findOne({ tenantId, userId: OPERATOR_ID, dialogId: dialogIdA }).lean()
    ).toBeTruthy();

    const dlgAStatsFinal = await UserDialogStats.findOne({
      tenantId,
      userId: OPERATOR_ID,
      dialogId: dialogIdA
    }).lean();
    expect(dlgAStatsFinal?.unreadCount).toBe(0);

    expect(await sumPackContactUnread(OPERATOR_ID, packId)).toBe(0);

    const dlgABySender = await UserDialogUnreadBySenderType.find({
      tenantId,
      userId: OPERATOR_ID,
      dialogId: dialogIdA
    }).lean();
    dlgABySender.forEach((row) => expect(row.countUnread).toBe(0));

    const packRows = await UserPackUnreadBySenderType.find({
      tenantId,
      userId: OPERATOR_ID,
      packId
    }).lean();
    packRows.forEach((row) => expect(row.countUnread).toBe(0));

    const statsAfter = await UserStats.findOne({ tenantId, userId: OPERATOR_ID }).lean();
    expect(statsAfter?.totalUnreadCount).toBe(0);
    expect(statsAfter?.unreadDialogsCount).toBe(0);
    expect(statsAfter?.dialogCount).toBe(dialogCountBefore - 1);
  });

  test('P4-I2: без новых сообщений pack aggregate contact unread остаётся 0', async () => {
    const { packId, dialogIdB } = await setupProposalPack();

    await packController.markAllReadForAllUsers(
      createReq({ params: { packId }, query: { memberType: 'user' } }),
      createMockRes()
    );
    await flushCounterEvents();

    await dialogMemberController.removeDialogMember(
      createReq({ params: { dialogId: dialogIdB, userId: OPERATOR_ID } }),
      createMockRes()
    );
    await flushCounterEvents();

    expect(await sumPackContactUnread(OPERATOR_ID, packId)).toBe(0);
    expect(await sumPackedMessagesContactUnread(OPERATOR_ID, packId)).toBe(0);

    const statsAfter = await UserStats.findOne({ tenantId, userId: OPERATOR_ID }).lean();
    expect(statsAfter?.totalUnreadCount).toBe(0);
  });

  test('P4-R1: member.remove до bulk_read — финальное состояние БД contact unread = 0', async () => {
    const { packId, dialogIdB } = await setupProposalPack();

    await packController.markAllReadForAllUsers(
      createReq({ params: { packId }, query: { memberType: 'user' } }),
      createMockRes()
    );

    await dialogMemberController.removeDialogMember(
      createReq({ params: { dialogId: dialogIdB, userId: OPERATOR_ID } }),
      createMockRes()
    );

    const counterRows = await OutboxEvent.find({ tenantId })
      .sort({ createdAt: 1 })
      .lean()
      .then((rows) => rows.filter((row) => isCounterEventType(row.eventType)));

    const removeRows = counterRows.filter((row) => row.eventType === 'dialog.member.remove');
    const bulkReadRows = counterRows.filter((row) => row.eventType === 'dialog.messages.bulk_read');
    expect(removeRows.length).toBeGreaterThanOrEqual(1);
    expect(bulkReadRows.length).toBeGreaterThanOrEqual(1);

    const ordered = [...removeRows, ...bulkReadRows];
    for (const row of ordered) {
      await processCounterEvent({
        eventId: row.eventId,
        tenantId: row.tenantId,
        eventType: row.eventType,
        entityType: row.entityType,
        entityId: row.entityId,
        actorId: row.actorId,
        actorType: row.actorType,
        data: row.data,
        createdAt: row.createdAt
      });
    }

    expect(await sumPackContactUnread(OPERATOR_ID, packId)).toBe(0);

    const statsAfter = await UserStats.findOne({ tenantId, userId: OPERATOR_ID }).lean();
    expect(statsAfter?.totalUnreadCount).toBe(0);
    expect(statsAfter?.unreadDialogsCount).toBe(0);
  });
});
