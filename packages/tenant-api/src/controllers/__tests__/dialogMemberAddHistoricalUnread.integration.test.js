/**
 * dialog.member.add — unread только после join (DialogMember.createdAt).
 * mongodb-memory-server + @onify/fake-amqplib (AGENTS.md).
 */
import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import dialogMemberController from '../dialogMemberController.js';
import messageController from '../messageController.js';
import { packController } from '../packController.js';
import * as userPackController from '../userPackController.js';
import {
  DialogMember,
  OutboxEvent,
  Tenant,
  User,
  UserDialogStats,
  UserDialogUnreadBySenderType,
  UserPackUnreadBySenderType,
  UserPackedMessagesUnreadBySenderType,
  UserStats,
  UserUnreadBySenderType
} from '@chat3/models';
import { recalculateUserStats } from '@chat3/utils/counterUtils.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { flushCounterEvents } from '../../utils/__tests__/counterTestHelpers.js';

const tenantId = 'tnt_member_add_hist';
const ALICE = 'usr_add_hist_alice';
const BOB = 'usr_add_hist_bob';
const CAROL = 'usr_add_hist_carol';
const CONTACT = 'cnt_add_hist_contact';

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

async function sumPackUnread(userId, packId) {
  const rows = await UserPackUnreadBySenderType.find({ tenantId, userId, packId }).lean();
  return rows.reduce((s, r) => s + (r.countUnread || 0), 0);
}

async function sumPackedMessagesUnread(userId) {
  const rows = await UserPackedMessagesUnreadBySenderType.find({ tenantId, userId }).lean();
  return rows.reduce((s, r) => s + (r.countUnread || 0), 0);
}

async function sumUserUnreadBySender(userId) {
  const rows = await UserUnreadBySenderType.find({ tenantId, userId }).lean();
  return rows.reduce((s, r) => s + (r.countUnread || 0), 0);
}

async function expectUserCounters({
  userId,
  dialogId,
  packId,
  totalUnread,
  unreadDialogs,
  dialogCount,
  dialogUnread,
  packUnread,
  packedMessagesUnread
}) {
  const stats = await UserStats.findOne({ tenantId, userId }).lean();
  if (totalUnread != null) {
    expect(stats?.totalUnreadCount).toBe(totalUnread);
  }
  if (unreadDialogs != null) {
    expect(stats?.unreadDialogsCount).toBe(unreadDialogs);
  }
  if (dialogCount != null) {
    expect(stats?.dialogCount).toBe(dialogCount);
  }
  if (dialogId != null && dialogUnread != null) {
    const ds = await UserDialogStats.findOne({ tenantId, userId, dialogId }).lean();
    expect(ds?.unreadCount).toBe(dialogUnread);
  }
  if (dialogId != null && packId == null) {
    const bySender = await UserDialogUnreadBySenderType.find({ tenantId, userId, dialogId }).lean();
    const bySenderSum = bySender.reduce((s, r) => s + (r.countUnread || 0), 0);
    if (dialogUnread != null) {
      expect(bySenderSum).toBe(dialogUnread);
    }
  }
  if (packId != null && packUnread != null) {
    expect(await sumPackUnread(userId, packId)).toBe(packUnread);
  }
  if (packedMessagesUnread != null) {
    expect(await sumPackedMessagesUnread(userId)).toBe(packedMessagesUnread);
  }
  if (totalUnread != null) {
    expect(await sumUserUnreadBySender(userId)).toBe(totalUnread);
  }
}

async function createDialogWithMembers(memberIds) {
  const res = createMockRes();
  await dialogController.create(
    createReq({
      body: {
        members: memberIds.map((userId) => ({
          userId,
          type: userId.startsWith('cnt_') ? 'contact' : 'user'
        }))
      }
    }),
    res
  );
  expect(res.statusCode).toBe(201);
  return res.body?.data?.dialogId;
}

async function sendMessages(dialogId, count, senderId = CONTACT) {
  for (let i = 0; i < count; i++) {
    const res = createMockRes();
    await messageController.createMessage(
      createReq({
        params: { dialogId },
        body: {
          senderId,
          content: `msg ${i}`,
          type: 'internal.text'
        }
      }),
      res
    );
    expect(res.statusCode).toBe(201);
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
  if (!rabbitmqUtils.getRabbitMQInfo().connected) {
    const amqplib = await import('amqplib');
    amqplib.default.connect = fakeAmqp.connect;
    await rabbitmqUtils.initRabbitMQ();
  }
  await Tenant.create({
    tenantId,
    name: 'Member Add Hist Tenant',
    domain: 'member-add-hist.chat3.com',
    type: 'client',
    isActive: true,
    createdAt: generateTimestamp()
  });
  await User.create([
    { tenantId, userId: ALICE, type: 'user' },
    { tenantId, userId: BOB, type: 'user' },
    { tenantId, userId: CAROL, type: 'user' },
    { tenantId, userId: CONTACT, type: 'contact' }
  ]);
});

describe('dialog.member.add join boundary', () => {
  test('I1: add в паковый диалог с историей — у нового все счётчики 0, у alice без изменений', async () => {
    const resPack = createMockRes();
    await packController.create(createReq(), resPack);
    const packId = resPack.body?.data?.packId;

    const dialogId = await createDialogWithMembers([ALICE, CONTACT]);
    await packController.addDialog(
      createReq({ params: { packId }, body: { dialogId } }),
      createMockRes()
    );

    await sendMessages(dialogId, 7);
    await flushCounterEvents();

    const aliceBefore = await UserStats.findOne({ tenantId, userId: ALICE }).lean();

    await dialogMemberController.addDialogMember(
      createReq({ params: { dialogId }, body: { userId: BOB } }),
      createMockRes()
    );
    await flushCounterEvents();

    await expectUserCounters({
      userId: BOB,
      dialogId,
      packId,
      totalUnread: 0,
      unreadDialogs: 0,
      dialogUnread: 0,
      packUnread: 0,
      packedMessagesUnread: 0
    });

    const aliceAfter = await UserStats.findOne({ tenantId, userId: ALICE }).lean();
    expect(aliceAfter?.totalUnreadCount).toBe(aliceBefore?.totalUnreadCount);
    expect(aliceAfter?.unreadDialogsCount).toBe(aliceBefore?.unreadDialogsCount);
    expect(await sumPackUnread(ALICE, packId)).toBeGreaterThanOrEqual(7);

    const contactRows = await UserDialogUnreadBySenderType.find({
      tenantId,
      userId: ALICE,
      dialogId,
      fromType: 'contact'
    }).lean();
    expect(contactRows.reduce((s, r) => s + (r.countUnread || 0), 0)).toBe(7);
  });

  test('I2: сообщение после add — у нового unread и pack = 1', async () => {
    const resPack = createMockRes();
    await packController.create(createReq(), resPack);
    const packId = resPack.body?.data?.packId;

    const dialogId = await createDialogWithMembers([ALICE, CONTACT]);
    await packController.addDialog(
      createReq({ params: { packId }, body: { dialogId } }),
      createMockRes()
    );
    await sendMessages(dialogId, 3);
    await flushCounterEvents();

    await dialogMemberController.addDialogMember(
      createReq({ params: { dialogId }, body: { userId: BOB } }),
      createMockRes()
    );
    await flushCounterEvents();

    await sendMessages(dialogId, 1);
    await flushCounterEvents();

    await expectUserCounters({
      userId: BOB,
      dialogId,
      packId,
      totalUnread: 1,
      unreadDialogs: 1,
      dialogUnread: 1,
      packUnread: 1,
      packedMessagesUnread: 1
    });
  });

  test('I3: joinPack — 2 диалога с историей, user не был member', async () => {
    const resPack = createMockRes();
    await packController.create(createReq(), resPack);
    const packId = resPack.body?.data?.packId;

    for (let d = 0; d < 2; d++) {
      const dialogId = await createDialogWithMembers([ALICE, CONTACT]);
      await packController.addDialog(
        createReq({ params: { packId }, body: { dialogId } }),
        createMockRes()
      );
      await sendMessages(dialogId, 3);
    }
    await flushCounterEvents();

    const resJoin = createMockRes();
    await userPackController.joinPack(
      createReq({ params: { userId: BOB, packId } }),
      resJoin
    );
    expect(resJoin.statusCode).toBe(200);
    expect(resJoin.body?.data?.joinedDialogsCount).toBe(2);
    await flushCounterEvents();

    await expectUserCounters({
      userId: BOB,
      packId,
      totalUnread: 0,
      unreadDialogs: 0,
      packUnread: 0,
      packedMessagesUnread: 0
    });
  });

  test('I4: повторный addDialogMember — 200 без нового outbox, dialogCount не дублируется', async () => {
    const dialogId = await createDialogWithMembers([ALICE, CONTACT]);
    await sendMessages(dialogId, 2);
    await flushCounterEvents();

    await dialogMemberController.addDialogMember(
      createReq({ params: { dialogId }, body: { userId: BOB } }),
      createMockRes()
    );
    await flushCounterEvents();

    const outboxBefore = await OutboxEvent.countDocuments({
      tenantId,
      eventType: 'dialog.member.add'
    });
    const statsBefore = await UserStats.findOne({ tenantId, userId: BOB }).lean();

    const resDup = createMockRes();
    await dialogMemberController.addDialogMember(
      createReq({ params: { dialogId }, body: { userId: BOB } }),
      resDup
    );
    expect(resDup.statusCode).toBe(200);

    const outboxAfter = await OutboxEvent.countDocuments({
      tenantId,
      eventType: 'dialog.member.add'
    });
    expect(outboxAfter).toBe(outboxBefore);

    const statsAfter = await UserStats.findOne({ tenantId, userId: BOB }).lean();
    expect(statsAfter?.dialogCount).toBe(statsBefore?.dialogCount);
    expect(statsAfter?.totalUnreadCount).toBe(0);
  });

  test('I5: частичный joinPack — dlg1 уже с unread, dlg2 с историей → pack sum сохраняет dlg1', async () => {
    const resPack = createMockRes();
    await packController.create(createReq(), resPack);
    const packId = resPack.body?.data?.packId;

    const dialog1 = await createDialogWithMembers([ALICE, CONTACT]);
    const dialog2 = await createDialogWithMembers([ALICE, CONTACT]);
    await packController.addDialog(
      createReq({ params: { packId }, body: { dialogId: dialog1 } }),
      createMockRes()
    );
    await packController.addDialog(
      createReq({ params: { packId }, body: { dialogId: dialog2 } }),
      createMockRes()
    );

    await dialogMemberController.addDialogMember(
      createReq({ params: { dialogId: dialog1 }, body: { userId: BOB } }),
      createMockRes()
    );
    await sendMessages(dialog1, 2);
    await sendMessages(dialog2, 4);
    await flushCounterEvents();

    await expectUserCounters({
      userId: BOB,
      dialogId: dialog1,
      totalUnread: 2,
      dialogUnread: 2
    });

    const resJoin = createMockRes();
    await userPackController.joinPack(
      createReq({ params: { userId: BOB, packId } }),
      resJoin
    );
    expect(resJoin.body?.data?.joinedDialogsCount).toBe(1);
    expect(resJoin.body?.data?.alreadyMemberCount).toBe(1);
    await flushCounterEvents();

    await expectUserCounters({
      userId: BOB,
      dialogId: dialog1,
      packId,
      totalUnread: 2,
      unreadDialogs: 1,
      dialogUnread: 2,
      packUnread: 2,
      packedMessagesUnread: 2
    });

    const ds2 = await UserDialogStats.findOne({
      tenantId,
      userId: BOB,
      dialogId: dialog2
    }).lean();
    expect(ds2?.unreadCount).toBe(0);
  });

  test('I6: founding members при create диалога — unread по всей истории', async () => {
    const dialogId = await createDialogWithMembers([ALICE, BOB, CONTACT]);
    await sendMessages(dialogId, 5);
    await flushCounterEvents();

    await expectUserCounters({
      userId: ALICE,
      dialogId,
      totalUnread: 5,
      unreadDialogs: 1,
      dialogUnread: 5
    });
    await expectUserCounters({
      userId: BOB,
      dialogId,
      totalUnread: 5,
      unreadDialogs: 1,
      dialogUnread: 5
    });
  });

  test('I7: recalculateUserStats после add с историей — bob unread остаётся 0', async () => {
    const dialogId = await createDialogWithMembers([ALICE, CONTACT]);
    await sendMessages(dialogId, 6);
    await flushCounterEvents();

    await dialogMemberController.addDialogMember(
      createReq({ params: { dialogId }, body: { userId: BOB } }),
      createMockRes()
    );
    await flushCounterEvents();

    await recalculateUserStats(tenantId, BOB);

    await expectUserCounters({
      userId: BOB,
      dialogId,
      totalUnread: 0,
      unreadDialogs: 0,
      dialogUnread: 0
    });
  });

  test('I8: remove → re-add → история вне unread; новое сообщение → 1', async () => {
    const dialogId = await createDialogWithMembers([ALICE, CONTACT]);
    await sendMessages(dialogId, 4);
    await flushCounterEvents();

    await dialogMemberController.addDialogMember(
      createReq({ params: { dialogId }, body: { userId: BOB } }),
      createMockRes()
    );
    await flushCounterEvents();

    await dialogMemberController.removeDialogMember(
      createReq({ params: { dialogId, userId: BOB } }),
      createMockRes()
    );
    await flushCounterEvents();

    const memberBeforeReadd = await DialogMember.findOne({
      tenantId,
      userId: BOB,
      dialogId
    }).lean();
    expect(memberBeforeReadd).toBeNull();

    await dialogMemberController.addDialogMember(
      createReq({ params: { dialogId }, body: { userId: BOB } }),
      createMockRes()
    );
    await flushCounterEvents();

    const memberAfterReadd = await DialogMember.findOne({
      tenantId,
      userId: BOB,
      dialogId
    }).lean();
    expect(memberAfterReadd?.createdAt).toBeDefined();

    await expectUserCounters({
      userId: BOB,
      dialogId,
      totalUnread: 0,
      dialogUnread: 0
    });

    await sendMessages(dialogId, 1);
    await flushCounterEvents();

    await expectUserCounters({
      userId: BOB,
      dialogId,
      totalUnread: 1,
      dialogUnread: 1
    });
  });
});
