import * as userPackController from '../userPackController.js';
import {
  Tenant,
  Pack,
  PackLink,
  Dialog,
  DialogMember,
  Meta,
  Message,
  User,
  UserPackUnreadBySenderType
} from '@chat3/models';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

const tenantId = 'tnt_user_pack';

function createDialogId(seed) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let value = 'dlg_';
  for (let i = 0; i < 20; i++) {
    value += chars.charAt((seed + i) % chars.length);
  }
  return value;
}

function createPackId(seed) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let value = 'pck_';
  for (let i = 0; i < 20; i++) {
    value += chars.charAt((seed + i) % chars.length);
  }
  return value;
}

const createMockReq = (userId, query = {}) => ({
  tenantId,
  params: { userId },
  query
});

/** Для getPackDialogs и getPackMessages: params { userId, packId } */
const createMockReqWithPack = (userId, packId, query = {}) => ({
  tenantId,
  params: { userId, packId },
  query
});

function messageId(seed) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let value = 'msg_';
  for (let i = 0; i < 20; i++) {
    value += chars.charAt((seed * 3 + i) % chars.length);
  }
  return value;
}

const createMockRes = () => {
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
};

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

beforeEach(async () => {
  await clearDatabase();
  await Tenant.create({ tenantId, createdAt: generateTimestamp() });
});

describe('userPackController.getUserPacks - filter by meta', () => {
  const userId = 'user_main';
  let packA; // пользователь в диалоге, meta.attention=required
  let packB; // пользователь в диалоге, meta.attention=optional
  let packC; // пользователь НЕ в диалоге, meta.attention=required — не должен попасть в выборку

  beforeEach(async () => {
    const dialogA = createDialogId(1);
    const dialogB = createDialogId(2);
    const dialogC = createDialogId(3);

    await Dialog.create([
      { tenantId, dialogId: dialogA, createdAt: generateTimestamp() },
      { tenantId, dialogId: dialogB, createdAt: generateTimestamp() },
      { tenantId, dialogId: dialogC, createdAt: generateTimestamp() }
    ]);

    await DialogMember.create([
      { tenantId, dialogId: dialogA, userId },
      { tenantId, dialogId: dialogB, userId }
      // dialogC — без userId, пользователь не участник
    ]);

    packA = createPackId(1);
    packB = createPackId(2);
    packC = createPackId(3);

    await Pack.create([
      { tenantId, packId: packA, createdAt: generateTimestamp() },
      { tenantId, packId: packB, createdAt: generateTimestamp() },
      { tenantId, packId: packC, createdAt: generateTimestamp() }
    ]);

    await PackLink.create([
      { tenantId, packId: packA, dialogId: dialogA },
      { tenantId, packId: packB, dialogId: dialogB },
      { tenantId, packId: packC, dialogId: dialogC }
    ]);

    await Meta.create([
      { tenantId, entityType: 'pack', entityId: packA, key: 'attention', value: 'required', dataType: 'string' },
      { tenantId, entityType: 'pack', entityId: packB, key: 'attention', value: 'optional', dataType: 'string' },
      { tenantId, entityType: 'pack', entityId: packC, key: 'attention', value: 'required', dataType: 'string' }
    ]);
  });

  test('filter (meta.attention,eq,required) returns only packs where user is member of a dialog', async () => {
    const req = createMockReq(userId, {
      page: 1,
      limit: 10,
      filter: '(meta.attention,eq,required)',
      sort: 'createdAt',
      sortDirection: 'desc'
    });
    const res = createMockRes();

    await userPackController.getUserPacks(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].packId).toBe(packA);
    expect(res.body.pagination.total).toBe(1);
    const packIds = res.body.data.map((p) => p.packId);
    expect(packIds).toContain(packA);
    expect(packIds).not.toContain(packB);
    expect(packIds).not.toContain(packC);
  });

  test('without filter returns all packs where user is member', async () => {
    const req = createMockReq(userId, { page: 1, limit: 10 });
    const res = createMockRes();

    await userPackController.getUserPacks(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const packIds = res.body.data.map((p) => p.packId);
    expect(packIds).toContain(packA);
    expect(packIds).toContain(packB);
    expect(packIds).not.toContain(packC);
    expect(res.body.pagination.total).toBe(2);
  });

  test('lastMessage includes message meta for each pack', async () => {
    const senderId = 'usr_sender_packs';
    await User.create({
      tenantId,
      userId: senderId,
      name: 'Sender',
      createdAt: generateTimestamp()
    });

    const dialogA = createDialogId(1);
    const dialogB = createDialogId(2);
    const msgIdA = messageId(100);
    const msgIdB = messageId(101);

    await Message.create([
      {
        tenantId,
        dialogId: dialogA,
        messageId: msgIdA,
        senderId,
        type: 'internal.text',
        content: 'Last in A',
        createdAt: generateTimestamp() + 2
      },
      {
        tenantId,
        dialogId: dialogB,
        messageId: msgIdB,
        senderId,
        type: 'internal.text',
        content: 'Last in B',
        createdAt: generateTimestamp() + 1
      }
    ]);
    await Meta.create([
      { tenantId, entityType: 'message', entityId: msgIdA, key: 'attention', value: 'required', dataType: 'string' },
      { tenantId, entityType: 'message', entityId: msgIdB, key: 'contactId', value: 'cnt_xyz', dataType: 'string' }
    ]);

    const req = createMockReq(userId, { page: 1, limit: 10 });
    const res = createMockRes();

    await userPackController.getUserPacks(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const packARow = res.body.data.find((p) => p.packId === packA);
    const packBRow = res.body.data.find((p) => p.packId === packB);
    expect(packARow?.lastMessage).toBeDefined();
    expect(packARow?.lastMessage.messageId).toBe(msgIdA);
    expect(packARow?.lastMessage.meta).toEqual({ attention: 'required' });
    expect(Array.isArray(packARow?.lastMessage.statusMessageMatrix)).toBe(true);
    expect(packBRow?.lastMessage).toBeDefined();
    expect(packBRow?.lastMessage.messageId).toBe(msgIdB);
    expect(packBRow?.lastMessage.meta).toEqual({ contactId: 'cnt_xyz' });
    expect(Array.isArray(packBRow?.lastMessage.statusMessageMatrix)).toBe(true);
  });
});

describe('userPackController.getUserPacks - sort unread+lastActivityAt', () => {
  const userId = 'user_sort_unread';
  const ts = generateTimestamp();

  test('packs with unread first, then by lastActivityAt desc', async () => {
    const dlg1 = createDialogId(50);
    const dlg2 = createDialogId(51);
    const dlg3 = createDialogId(52);
    await Dialog.create([
      { tenantId, dialogId: dlg1, createdAt: ts },
      { tenantId, dialogId: dlg2, createdAt: ts },
      { tenantId, dialogId: dlg3, createdAt: ts }
    ]);
    await DialogMember.create([
      { tenantId, dialogId: dlg1, userId },
      { tenantId, dialogId: dlg2, userId },
      { tenantId, dialogId: dlg3, userId }
    ]);
    const p1 = createPackId(50);
    const p2 = createPackId(51);
    const p3 = createPackId(52);
    await Pack.create([
      { tenantId, packId: p1, createdAt: ts + 10 },
      { tenantId, packId: p2, createdAt: ts + 20 },
      { tenantId, packId: p3, createdAt: ts + 30 }
    ]);
    await PackLink.create([
      { tenantId, packId: p1, dialogId: dlg1 },
      { tenantId, packId: p2, dialogId: dlg2 },
      { tenantId, packId: p3, dialogId: dlg3 }
    ]);
    await Message.create([
      { tenantId, dialogId: dlg1, messageId: messageId(50), senderId: 's1', type: 'internal.text', content: 'm1', createdAt: ts + 100 },
      { tenantId, dialogId: dlg2, messageId: messageId(51), senderId: 's1', type: 'internal.text', content: 'm2', createdAt: ts + 200 }
      // dlg3 без сообщений — lastActivity fallback = Pack.createdAt (ts+30)
    ]);
    await UserPackUnreadBySenderType.create([
      { tenantId, userId, packId: p1, fromType: 'user', countUnread: 2, lastUpdatedAt: ts, createdAt: ts }
      // p2, p3 без непрочитанных
    ]);

    const req = createMockReq(userId, { page: 1, limit: 10, sort: 'unread+lastActivityAt', sortDirection: 'desc' });
    const res = createMockRes();
    await userPackController.getUserPacks(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
    const ids = res.body.data.map((d) => d.packId);
    expect(ids[0]).toBe(p1);
    expect(res.body.data[0].stats.unreadCount).toBe(2);
    expect(res.body.data[1].stats.unreadCount).toBe(0);
    expect(res.body.data[2].stats.unreadCount).toBe(0);
    expect(ids[1]).toBe(p2);
    expect(ids[2]).toBe(p3);
  });

  test('sortDirection asc applies to lastActivityAt within groups', async () => {
    const dlg1 = createDialogId(60);
    const dlg2 = createDialogId(61);
    await Dialog.create([
      { tenantId, dialogId: dlg1, createdAt: ts },
      { tenantId, dialogId: dlg2, createdAt: ts }
    ]);
    await DialogMember.create([
      { tenantId, dialogId: dlg1, userId },
      { tenantId, dialogId: dlg2, userId }
    ]);
    const p1 = createPackId(60);
    const p2 = createPackId(61);
    await Pack.create([
      { tenantId, packId: p1, createdAt: ts + 10 },
      { tenantId, packId: p2, createdAt: ts + 20 }
    ]);
    await PackLink.create([
      { tenantId, packId: p1, dialogId: dlg1 },
      { tenantId, packId: p2, dialogId: dlg2 }
    ]);
    await Message.create([
      { tenantId, dialogId: dlg1, messageId: messageId(60), senderId: 's1', type: 'internal.text', content: 'm1', createdAt: ts + 100 },
      { tenantId, dialogId: dlg2, messageId: messageId(61), senderId: 's1', type: 'internal.text', content: 'm2', createdAt: ts + 200 }
    ]);
    const req = createMockReq(userId, { page: 1, limit: 10, sort: 'unread+lastActivityAt', sortDirection: 'asc' });
    const res = createMockRes();
    await userPackController.getUserPacks(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const ids = res.body.data.map((d) => d.packId);
    expect(ids[0]).toBe(p1);
    expect(ids[1]).toBe(p2);
  });

  test('pagination with sort unread+lastActivityAt: 17 packs, limit 5, first two pages with unread', async () => {
    const totalPacks = 17;
    const limit = 5;
    const packsWithUnreadCount = 9;
    const dialogs = [];
    const packs = [];
    for (let i = 0; i < totalPacks; i++) {
      dialogs.push(createDialogId(100 + i));
      packs.push(createPackId(100 + i));
    }
    await Dialog.create(
      dialogs.map((dialogId) => ({ tenantId, dialogId, createdAt: ts + 1 }))
    );
    await DialogMember.create(
      dialogs.map((dialogId) => ({ tenantId, dialogId, userId }))
    );
    await Pack.create(
      packs.map((packId, i) => ({ tenantId, packId, createdAt: ts + 10 + i }))
    );
    await PackLink.create(
      packs.map((packId, i) => ({ tenantId, packId, dialogId: dialogs[i] }))
    );
    const messageDocs = packs.slice(0, 12).map((packId, i) => ({
      tenantId,
      dialogId: dialogs[i],
      messageId: messageId(2000 + i * 13),
      senderId: 's1',
      type: 'internal.text',
      content: `m${i}`,
      createdAt: ts + 100 + i
    }));
    await Message.insertMany(messageDocs);
    for (let i = 12; i < totalPacks; i++) {
      await Message.create({
        tenantId,
        dialogId: dialogs[i],
        senderId: 's1',
        type: 'internal.text',
        content: `m${i}`,
        createdAt: ts + 100 + i
      });
    }
    await UserPackUnreadBySenderType.insertMany(
      packs.slice(0, packsWithUnreadCount).map((packId) => ({
        tenantId,
        userId,
        packId,
        fromType: 'user',
        countUnread: 1,
        lastUpdatedAt: ts,
        createdAt: ts
      }))
    );

    const allIds = new Set();
    for (let page = 1; page <= 4; page++) {
      const req = createMockReq(userId, {
        page,
        limit,
        sort: 'unread+lastActivityAt',
        sortDirection: 'desc'
      });
      const res = createMockRes();
      await userPackController.getUserPacks(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.pagination.total).toBe(totalPacks);
      expect(res.body.pagination.pages).toBe(4);
      expect(res.body.pagination.limit).toBe(limit);
      expect(res.body.pagination.page).toBe(page);

      const data = res.body.data;
      const expectedLen = page < 4 ? limit : totalPacks - (page - 1) * limit;
      expect(data).toHaveLength(expectedLen);

      data.forEach((row) => {
        expect(allIds.has(row.packId)).toBe(false);
        allIds.add(row.packId);
      });

      const unreadOnThisPage = Math.max(0, Math.min(data.length, packsWithUnreadCount - (page - 1) * limit));
      data.forEach((row, idx) => {
        if (idx < unreadOnThisPage) {
          expect(row.stats.unreadCount).toBeGreaterThan(0);
        } else {
          expect(row.stats.unreadCount).toBe(0);
        }
      });
    }
    expect(allIds.size).toBe(totalPacks);
  });
});

describe('userPackController.getPackDialogs', () => {
  const userId = 'user_dialogs';

  test('returns only dialogs of the pack where user is member', async () => {
    const dialogA = createDialogId(10);
    const dialogB = createDialogId(11);
    const dialogC = createDialogId(12);

    await Dialog.create([
      { tenantId, dialogId: dialogA, createdAt: generateTimestamp() },
      { tenantId, dialogId: dialogB, createdAt: generateTimestamp() },
      { tenantId, dialogId: dialogC, createdAt: generateTimestamp() }
    ]);

    await DialogMember.create([
      { tenantId, dialogId: dialogA, userId },
      { tenantId, dialogId: dialogB, userId }
      // dialogC — пользователь не участник
    ]);

    const packId = createPackId(10);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });

    await PackLink.create([
      { tenantId, packId, dialogId: dialogA },
      { tenantId, packId, dialogId: dialogB },
      { tenantId, packId, dialogId: dialogC }
    ]);

    const req = createMockReqWithPack(userId, packId, { page: 1, limit: 10 });
    const res = createMockRes();

    await userPackController.getPackDialogs(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const dialogIds = res.body.data.map((d) => d.dialogId);
    expect(dialogIds).toContain(dialogA);
    expect(dialogIds).toContain(dialogB);
    expect(dialogIds).not.toContain(dialogC);
    expect(res.body.pagination.total).toBe(2);
    res.body.data.forEach((d) => expect(typeof d.addedAt).toBe('number'));
  });

  test('pagination (page, limit)', async () => {
    const dialog1 = createDialogId(20);
    const dialog2 = createDialogId(21);
    const dialog3 = createDialogId(22);

    await Dialog.create([
      { tenantId, dialogId: dialog1, createdAt: generateTimestamp() },
      { tenantId, dialogId: dialog2, createdAt: generateTimestamp() },
      { tenantId, dialogId: dialog3, createdAt: generateTimestamp() }
    ]);

    await DialogMember.create([
      { tenantId, dialogId: dialog1, userId },
      { tenantId, dialogId: dialog2, userId },
      { tenantId, dialogId: dialog3, userId }
    ]);

    const packId = createPackId(20);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });

    await PackLink.create([
      { tenantId, packId, dialogId: dialog1 },
      { tenantId, packId, dialogId: dialog2 },
      { tenantId, packId, dialogId: dialog3 }
    ]);

    const req1 = createMockReqWithPack(userId, packId, { page: 1, limit: 2 });
    const res1 = createMockRes();
    await userPackController.getPackDialogs(req1, res1);

    expect(res1.statusCode).toBe(200);
    expect(res1.body.data).toHaveLength(2);
    expect(res1.body.pagination.total).toBe(3);
    expect(res1.body.pagination.pages).toBe(2);

    const req2 = createMockReqWithPack(userId, packId, { page: 2, limit: 2 });
    const res2 = createMockRes();
    await userPackController.getPackDialogs(req2, res2);

    expect(res2.statusCode).toBe(200);
    expect(res2.body.data).toHaveLength(1);
  });

  test('returns empty when user is not in any dialog of the pack', async () => {
    const dialogA = createDialogId(30);
    await Dialog.create({ tenantId, dialogId: dialogA, createdAt: generateTimestamp() });
    // пользователь userId не добавлен в DialogMember для dialogA

    const packId = createPackId(30);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });
    await PackLink.create({ tenantId, packId, dialogId: dialogA });

    const req = createMockReqWithPack(userId, packId, { page: 1, limit: 10 });
    const res = createMockRes();

    await userPackController.getPackDialogs(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  test('returns empty when user has no dialogs at all', async () => {
    const dialogA = createDialogId(31);
    await Dialog.create({ tenantId, dialogId: dialogA, createdAt: generateTimestamp() });

    const packId = createPackId(31);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });
    await PackLink.create({ tenantId, packId, dialogId: dialogA });

    const req = createMockReqWithPack('user_without_any_dialogs', packId, { page: 1, limit: 10 });
    const res = createMockRes();

    await userPackController.getPackDialogs(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });
});

describe('userPackController.getPackMessages', () => {
  const userId = 'user_messages';

  beforeEach(async () => {
    await User.create({
      tenantId,
      userId,
      name: 'User Messages',
      createdAt: generateTimestamp()
    });
  });

  test('returns only messages from dialogs where user is member', async () => {
    const dialogA = createDialogId(40);
    const dialogB = createDialogId(41);

    await Dialog.create([
      { tenantId, dialogId: dialogA, createdAt: generateTimestamp() },
      { tenantId, dialogId: dialogB, createdAt: generateTimestamp() }
    ]);

    await DialogMember.create([
      { tenantId, dialogId: dialogA, userId }
      // пользователь не в dialogB
    ]);

    const packId = createPackId(40);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });

    await PackLink.create([
      { tenantId, packId, dialogId: dialogA },
      { tenantId, packId, dialogId: dialogB }
    ]);

    const baseTs = generateTimestamp();
    await Message.create([
      {
        tenantId,
        dialogId: dialogA,
        messageId: messageId(40),
        senderId: userId,
        type: 'internal.text',
        content: 'In dialog A',
        createdAt: baseTs + 2
      },
      {
        tenantId,
        dialogId: dialogB,
        messageId: messageId(41),
        senderId: userId,
        type: 'internal.text',
        content: 'In dialog B',
        createdAt: baseTs + 1
      }
    ]);

    const req = createMockReqWithPack(userId, packId, { limit: 10 });
    const res = createMockRes();

    await userPackController.getPackMessages(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].content).toBe('In dialog A');
    expect(res.body.data[0].dialogId).toBe(dialogA);
  });

  test('returns 404 when user is not in any dialog of the pack', async () => {
    const dialogA = createDialogId(50);
    await Dialog.create({ tenantId, dialogId: dialogA, createdAt: generateTimestamp() });
    // userId не участник dialogA

    const packId = createPackId(50);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });
    await PackLink.create({ tenantId, packId, dialogId: dialogA });

    const req = createMockReqWithPack(userId, packId, { limit: 10 });
    const res = createMockRes();

    await userPackController.getPackMessages(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toMatch(/no access|not in any dialog/);
  });

  test('cursor pagination', async () => {
    const dialogA = createDialogId(60);
    await Dialog.create({ tenantId, dialogId: dialogA, createdAt: generateTimestamp() });
    await DialogMember.create({ tenantId, dialogId: dialogA, userId });

    const packId = createPackId(60);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });
    await PackLink.create({ tenantId, packId, dialogId: dialogA });

    const baseTs = generateTimestamp();
    await Message.create([
      {
        tenantId,
        dialogId: dialogA,
        messageId: messageId(60),
        senderId: userId,
        type: 'internal.text',
        content: 'First',
        createdAt: baseTs + 3
      },
      {
        tenantId,
        dialogId: dialogA,
        messageId: messageId(61),
        senderId: userId,
        type: 'internal.text',
        content: 'Second',
        createdAt: baseTs + 2
      },
      {
        tenantId,
        dialogId: dialogA,
        messageId: messageId(62),
        senderId: userId,
        type: 'internal.text',
        content: 'Third',
        createdAt: baseTs + 1
      }
    ]);

    const req1 = createMockReqWithPack(userId, packId, { limit: 2 });
    const res1 = createMockRes();
    await userPackController.getPackMessages(req1, res1);

    expect(res1.statusCode).toBe(200);
    expect(res1.body.data).toHaveLength(2);
    expect(res1.body.hasMore).toBe(true);
    expect(res1.body.cursor?.next).toBeTruthy();

    const req2 = createMockReqWithPack(userId, packId, { limit: 2, cursor: res1.body.cursor.next });
    const res2 = createMockRes();
    await userPackController.getPackMessages(req2, res2);

    expect(res2.statusCode).toBe(200);
    expect(res2.body.data).toHaveLength(1);
    expect(res2.body.hasMore).toBe(false);
  });

  test('returns empty list when pack has no messages in allowed dialogs', async () => {
    const dialogA = createDialogId(70);
    await Dialog.create({ tenantId, dialogId: dialogA, createdAt: generateTimestamp() });
    await DialogMember.create({ tenantId, dialogId: dialogA, userId });

    const packId = createPackId(70);
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });
    await PackLink.create({ tenantId, packId, dialogId: dialogA });
    // сообщений нет

    const req = createMockReqWithPack(userId, packId, { limit: 10 });
    const res = createMockRes();

    await userPackController.getPackMessages(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.hasMore).toBe(false);
  });
});

/** params: { userId, packId } для getUserPackById */
describe('userPackController.getUserPackById', () => {
  const userId = 'user_pack_by_id';

  test('returns pack with userStats when user has access', async () => {
    const dialogA = createDialogId(80);
    const packId = createPackId(80);
    await Dialog.create({ tenantId, dialogId: dialogA, createdAt: generateTimestamp() });
    await DialogMember.create({ tenantId, dialogId: dialogA, userId });
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });
    await PackLink.create({ tenantId, packId, dialogId: dialogA });

    const req = createMockReqWithPack(userId, packId);
    req.params = { userId, packId };
    const res = createMockRes();

    await userPackController.getUserPackById(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.packId).toBe(packId);
    expect(res.body.data.meta).toBeDefined();
    expect(res.body.data.stats).toBeDefined();
    expect(res.body.data.userStats).toBeDefined();
    expect(typeof res.body.data.userStats.unreadCount).toBe('number');
  });

  test('returns 404 when pack not found', async () => {
    const req = createMockReqWithPack(userId, createPackId(99));
    req.params = { userId, packId: createPackId(99) };
    const res = createMockRes();

    await userPackController.getUserPackById(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toMatch(/Pack not found/);
  });

  test('returns 404 when user has no access to pack', async () => {
    const dialogA = createDialogId(81);
    const packId = createPackId(81);
    await Dialog.create({ tenantId, dialogId: dialogA, createdAt: generateTimestamp() });
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });
    await PackLink.create({ tenantId, packId, dialogId: dialogA });
    // userId не в DialogMember для dialogA

    const req = createMockReqWithPack(userId, packId);
    req.params = { userId, packId };
    const res = createMockRes();

    await userPackController.getUserPackById(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toMatch(/no access|not in any dialog/);
  });

  test('lastMessage includes message meta from Meta collection', async () => {
    const dialogA = createDialogId(82);
    const packId = createPackId(82);
    const senderId = 'usr_sender_82';
    const msgId = messageId(82);

    await Dialog.create({ tenantId, dialogId: dialogA, createdAt: generateTimestamp() });
    await DialogMember.create({ tenantId, dialogId: dialogA, userId });
    await Pack.create({ tenantId, packId, createdAt: generateTimestamp() });
    await PackLink.create({ tenantId, packId, dialogId: dialogA });
    await User.create({
      tenantId,
      userId: senderId,
      name: 'Sender',
      createdAt: generateTimestamp()
    });
    await Message.create({
      tenantId,
      dialogId: dialogA,
      messageId: msgId,
      senderId,
      type: 'internal.text',
      content: 'Hello',
      createdAt: generateTimestamp()
    });
    await Meta.create([
      { tenantId, entityType: 'message', entityId: msgId, key: 'attention', value: 'required', dataType: 'string' },
      { tenantId, entityType: 'message', entityId: msgId, key: 'contactId', value: 'cnt_abc', dataType: 'string' }
    ]);

    const req = createMockReqWithPack(userId, packId);
    req.params = { userId, packId };
    const res = createMockRes();

    await userPackController.getUserPackById(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.lastMessage).toBeDefined();
    expect(res.body.data.lastMessage.messageId).toBe(msgId);
    expect(res.body.data.lastMessage.meta).toEqual({ attention: 'required', contactId: 'cnt_abc' });
    expect(Array.isArray(res.body.data.lastMessage.statusMessageMatrix)).toBe(true);
    expect(res.body.data.lastMessage.statusMessageMatrix).toHaveLength(0);
  });
});

/** params: { userId, dialogId } для getDialogPacks */
describe('userPackController.getDialogPacks', () => {
  const userId = 'user_dialog_packs';

  test('returns packs that contain the dialog when user is member', async () => {
    const dialogA = createDialogId(90);
    const pack1 = createPackId(90);
    const pack2 = createPackId(91);
    await Dialog.create({ tenantId, dialogId: dialogA, createdAt: generateTimestamp() });
    await DialogMember.create({ tenantId, dialogId: dialogA, userId });
    await Pack.create([
      { tenantId, packId: pack1, createdAt: generateTimestamp() },
      { tenantId, packId: pack2, createdAt: generateTimestamp() }
    ]);
    await PackLink.create([
      { tenantId, packId: pack1, dialogId: dialogA },
      { tenantId, packId: pack2, dialogId: dialogA }
    ]);

    const req = { tenantId, params: { userId, dialogId: dialogA }, query: {} };
    const res = createMockRes();

    await userPackController.getDialogPacks(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const packIds = res.body.data.map((d) => d.packId);
    expect(packIds).toContain(pack1);
    expect(packIds).toContain(pack2);
    res.body.data.forEach((d) => {
      expect(d.addedAt).toBeDefined();
      expect(d.meta).toBeDefined();
    });
  });

  test('returns 404 when user is not member of dialog', async () => {
    const dialogA = createDialogId(91);
    await Dialog.create({ tenantId, dialogId: dialogA, createdAt: generateTimestamp() });
    // userId не участник

    const req = { tenantId, params: { userId, dialogId: dialogA }, query: {} };
    const res = createMockRes();

    await userPackController.getDialogPacks(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toMatch(/not a member|Dialog not found/);
  });
});
