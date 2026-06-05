/**
 * dialog.member.remove → counter-worker пересчитывает user/dialog stats.
 * mongodb-memory-server + @onify/fake-amqplib (AGENTS.md).
 */
import * as fakeAmqp from '@onify/fake-amqplib';
import { dialogController } from '../dialogController.js';
import dialogMemberController from '../dialogMemberController.js';
import messageController from '../messageController.js';
import { packController } from '../packController.js';
import {
  DialogMember,
  DialogStats,
  OutboxEvent,
  ProcessedCounterEvent,
  Tenant,
  User,
  UserDialogStats,
  UserDialogUnreadBySenderType,
  UserPackUnreadBySenderType,
  UserStats
} from '@chat3/models';
import { recalculateUserPackUnreadBySenderType } from '@chat3/utils/packStatsUtils.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import {
  flushCounterEvents,
  runCounterStackPipeline
} from '../../utils/__tests__/counterTestHelpers.js';

const tenantId = 'tnt_member_rm_recalc';
const VIEWER_ID = 'usr_member_remove_viewer';
const STAYER_ID = 'usr_member_remove_stayer';
const SENDER_ID = 'cnt_member_remove_sender';

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
  if (!rabbitmqUtils.getRabbitMQInfo().connected) {
    const amqplib = await import('amqplib');
    amqplib.default.connect = fakeAmqp.connect;
    await rabbitmqUtils.initRabbitMQ();
  }
  await Tenant.create({
    tenantId,
    name: 'Member Remove Recalc Tenant',
    domain: 'member-remove.chat3.com',
    type: 'client',
    isActive: true,
    createdAt: generateTimestamp()
  });
  await User.create([
    { tenantId, userId: VIEWER_ID, type: 'user' },
    { tenantId, userId: STAYER_ID, type: 'user' },
    { tenantId, userId: SENDER_ID, type: 'contact' }
  ]);
});

describe('dialog.member.remove counter recalc', () => {
  test('после remove участника counter-worker обнуляет unread и уменьшает dialogCount', async () => {
    const resDialog = createMockRes();
    await dialogController.create(
      createReq({
        body: {
          members: [
            { userId: VIEWER_ID, type: 'user' },
            { userId: SENDER_ID, type: 'contact' }
          ]
        }
      }),
      resDialog
    );
    expect(resDialog.statusCode).toBe(201);
    const dialogId = resDialog.body?.data?.dialogId;

    const resMessage = createMockRes();
    await messageController.createMessage(
      createReq({
        params: { dialogId },
        body: {
          senderId: SENDER_ID,
          content: 'unread before leave',
          type: 'internal.text'
        }
      }),
      resMessage
    );
    expect(resMessage.statusCode).toBe(201);
    await flushCounterEvents();

    const statsBefore = await UserStats.findOne({ tenantId, userId: VIEWER_ID }).lean();
    expect(statsBefore?.totalUnreadCount).toBe(1);
    expect(statsBefore?.dialogCount).toBeGreaterThanOrEqual(1);

    const resRemove = createMockRes();
    await dialogMemberController.removeDialogMember(
      createReq({
        params: { dialogId, userId: VIEWER_ID }
      }),
      resRemove
    );
    expect(resRemove.statusCode).toBe(200);

    const removeOutbox = await OutboxEvent.findOne({
      tenantId,
      eventType: 'dialog.member.remove'
    }).lean();
    expect(removeOutbox?.eventId).toBeDefined();
    expect(removeOutbox.data?.context?.userId).toBe(VIEWER_ID);
    expect(removeOutbox.data?.member?.userId).toBe(VIEWER_ID);

    expect(
      await UserDialogUnreadBySenderType.countDocuments({
        tenantId,
        userId: VIEWER_ID,
        dialogId
      })
    ).toBe(0);

    await flushCounterEvents();

    const processed = await ProcessedCounterEvent.findOne({
      tenantId,
      eventId: removeOutbox.eventId
    }).lean();
    expect(processed?.eventType).toBe('dialog.member.remove');

    const statsAfter = await UserStats.findOne({ tenantId, userId: VIEWER_ID }).lean();
    expect(statsAfter?.totalUnreadCount).toBe(0);
    expect(statsAfter?.unreadDialogsCount).toBe(0);
    expect(statsAfter?.dialogCount).toBe((statsBefore?.dialogCount ?? 1) - 1);

    expect(
      await UserDialogUnreadBySenderType.countDocuments({
        tenantId,
        userId: VIEWER_ID,
        dialogId
      })
    ).toBe(0);
    expect(
      await UserDialogStats.findOne({ tenantId, userId: VIEWER_ID, dialogId }).lean()
    ).toBeNull();
    expect(
      await DialogMember.findOne({ tenantId, userId: VIEWER_ID, dialogId }).lean()
    ).toBeNull();

    const dialogStats = await DialogStats.findOne({ tenantId, dialogId }).lean();
    expect(dialogStats?.memberCount).toBe(1);
  });

  test('при remove одного участника счётчики остальных не меняются', async () => {
    const resDialog = createMockRes();
    await dialogController.create(
      createReq({
        body: {
          members: [
            { userId: VIEWER_ID, type: 'user' },
            { userId: STAYER_ID, type: 'user' },
            { userId: SENDER_ID, type: 'contact' }
          ]
        }
      }),
      resDialog
    );
    expect(resDialog.statusCode).toBe(201);
    const dialogId = resDialog.body?.data?.dialogId;

    await messageController.createMessage(
      createReq({
        params: { dialogId },
        body: {
          senderId: SENDER_ID,
          content: 'unread for both users',
          type: 'internal.text'
        }
      }),
      createMockRes()
    );
    await flushCounterEvents();

    const leaverStatsBefore = await UserStats.findOne({ tenantId, userId: VIEWER_ID }).lean();
    const stayerStatsBefore = await UserStats.findOne({ tenantId, userId: STAYER_ID }).lean();
    expect(leaverStatsBefore?.totalUnreadCount).toBe(1);
    expect(stayerStatsBefore?.totalUnreadCount).toBe(1);
    expect(stayerStatsBefore?.unreadDialogsCount).toBe(1);
    expect(stayerStatsBefore?.dialogCount).toBeGreaterThanOrEqual(1);

    const stayerDialogStatsBefore = await UserDialogStats.findOne({
      tenantId,
      userId: STAYER_ID,
      dialogId
    }).lean();
    expect(stayerDialogStatsBefore?.unreadCount).toBe(1);

    const stayerUnreadRowsBefore = await UserDialogUnreadBySenderType.countDocuments({
      tenantId,
      userId: STAYER_ID,
      dialogId
    });
    expect(stayerUnreadRowsBefore).toBeGreaterThan(0);

    await dialogMemberController.removeDialogMember(
      createReq({ params: { dialogId, userId: VIEWER_ID } }),
      createMockRes()
    );
    await flushCounterEvents();

    const leaverStatsAfter = await UserStats.findOne({ tenantId, userId: VIEWER_ID }).lean();
    expect(leaverStatsAfter?.totalUnreadCount).toBe(0);
    expect(leaverStatsAfter?.unreadDialogsCount).toBe(0);
    expect(leaverStatsAfter?.dialogCount).toBe((leaverStatsBefore?.dialogCount ?? 1) - 1);

    const stayerStatsAfter = await UserStats.findOne({ tenantId, userId: STAYER_ID }).lean();
    expect(stayerStatsAfter?.totalUnreadCount).toBe(stayerStatsBefore?.totalUnreadCount);
    expect(stayerStatsAfter?.unreadDialogsCount).toBe(stayerStatsBefore?.unreadDialogsCount);
    expect(stayerStatsAfter?.dialogCount).toBe(stayerStatsBefore?.dialogCount);

    const stayerDialogStatsAfter = await UserDialogStats.findOne({
      tenantId,
      userId: STAYER_ID,
      dialogId
    }).lean();
    expect(stayerDialogStatsAfter?.unreadCount).toBe(1);

    expect(
      await UserDialogUnreadBySenderType.countDocuments({
        tenantId,
        userId: STAYER_ID,
        dialogId
      })
    ).toBe(stayerUnreadRowsBefore);

    expect(
      await DialogMember.findOne({ tenantId, userId: STAYER_ID, dialogId }).lean()
    ).toBeTruthy();
    expect(
      await DialogMember.findOne({ tenantId, userId: VIEWER_ID, dialogId }).lean()
    ).toBeNull();

    const dialogStats = await DialogStats.findOne({ tenantId, dialogId }).lean();
    expect(dialogStats?.memberCount).toBe(2);
  });

  test('после remove участника диалога в паке counter-worker обнуляет UserPackUnreadBySenderType', async () => {
    const resPack = createMockRes();
    await packController.create(createReq(), resPack);
    expect(resPack.statusCode).toBe(201);
    const packId = resPack.body?.data?.packId;

    const resDialog = createMockRes();
    await dialogController.create(
      createReq({
        body: {
          members: [
            { userId: VIEWER_ID, type: 'user' },
            { userId: SENDER_ID, type: 'contact' }
          ]
        }
      }),
      resDialog
    );
    expect(resDialog.statusCode).toBe(201);
    const dialogId = resDialog.body?.data?.dialogId;

    const resLink = createMockRes();
    await packController.addDialog(
      createReq({ params: { packId }, body: { dialogId } }),
      resLink
    );
    expect(resLink.statusCode).toBe(201);

    await messageController.createMessage(
      createReq({
        params: { dialogId },
        body: {
          senderId: SENDER_ID,
          content: 'unread in pack dialog',
          type: 'internal.text'
        }
      }),
      createMockRes()
    );
    await flushCounterEvents();
    await recalculateUserPackUnreadBySenderType(tenantId, packId, {
      sourceOperation: 'test-setup',
      sourceEntityId: packId
    });

    const statsBefore = await UserStats.findOne({ tenantId, userId: VIEWER_ID }).lean();
    expect(statsBefore?.totalUnreadCount).toBeGreaterThanOrEqual(1);

    const packUnreadBefore = await UserPackUnreadBySenderType.find({
      tenantId,
      userId: VIEWER_ID,
      packId
    }).lean();
    const totalPackUnreadBefore = packUnreadBefore.reduce(
      (sum, row) => sum + (row.countUnread || 0),
      0
    );
    expect(totalPackUnreadBefore).toBeGreaterThanOrEqual(1);

    await dialogMemberController.removeDialogMember(
      createReq({ params: { dialogId, userId: VIEWER_ID } }),
      createMockRes()
    );
    await flushCounterEvents();

    const statsAfter = await UserStats.findOne({ tenantId, userId: VIEWER_ID }).lean();
    expect(statsAfter?.totalUnreadCount).toBe(0);
    expect(statsAfter?.unreadDialogsCount).toBe(0);

    const packUnreadAfter = await UserPackUnreadBySenderType.find({
      tenantId,
      userId: VIEWER_ID,
      packId
    }).lean();
    const totalPackUnreadAfter = packUnreadAfter.reduce(
      (sum, row) => sum + (row.countUnread || 0),
      0
    );
    expect(totalPackUnreadAfter).toBe(0);
  });

  test('runCounterStackPipeline обрабатывает dialog.member.remove из outbox', async () => {
    const resDialog = createMockRes();
    await dialogController.create(
      createReq({
        body: {
          members: [
            { userId: VIEWER_ID, type: 'user' },
            { userId: SENDER_ID, type: 'contact' }
          ]
        }
      }),
      resDialog
    );
    const dialogId = resDialog.body?.data?.dialogId;

    await messageController.createMessage(
      createReq({
        params: { dialogId },
        body: { senderId: SENDER_ID, content: 'hi', type: 'internal.text' }
      }),
      createMockRes()
    );
    await flushCounterEvents();

    await dialogMemberController.removeDialogMember(
      createReq({ params: { dialogId, userId: VIEWER_ID } }),
      createMockRes()
    );

    const removeOutbox = await OutboxEvent.findOne({
      tenantId,
      eventType: 'dialog.member.remove'
    }).lean();

    await runCounterStackPipeline();

    const processed = await ProcessedCounterEvent.findOne({
      tenantId,
      eventId: removeOutbox.eventId
    }).lean();
    expect(processed).toBeTruthy();

    const statsAfter = await UserStats.findOne({ tenantId, userId: VIEWER_ID }).lean();
    expect(statsAfter?.totalUnreadCount).toBe(0);
  });
});
