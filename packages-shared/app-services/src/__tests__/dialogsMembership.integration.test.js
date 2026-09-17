import {
  addDialogMembers,
  getDialog,
  listDialogMembers,
  listUserDialogs,
  removeDialogMemberService,
  updateDialogMeta,
  AppServiceError
} from '@chat3/app-services';
import {
  Dialog,
  DialogMember,
  DialogStats,
  Tenant,
  User,
  UserDialogActivity,
  UserDialogStats
} from '@chat3/models';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../../../packages/tenant-api/src/utils/__tests__/setup.js';

const tenantId = 'tnt_parity';

const generateDialogId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

describe('dialogs membership + enrichment (app-services)', () => {
  let dialogId;

  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();

    await Tenant.create({
      tenantId,
      name: 'Parity',
      domain: 'parity.chat3.dev',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });

    await User.create([
      { tenantId, userId: 'alice', type: 'user', createdAt: generateTimestamp() },
      { tenantId, userId: 'bob', type: 'user', createdAt: generateTimestamp() },
      { tenantId, userId: 'carol', type: 'user', createdAt: generateTimestamp() },
      { tenantId, userId: 'outsider', type: 'user', createdAt: generateTimestamp() }
    ]);

    dialogId = generateDialogId();
    const createdAt = generateTimestamp();
    await Dialog.create({
      tenantId,
      dialogId,
      createdBy: 'alice',
      createdAt
    });

    await DialogMember.create([
      { tenantId, dialogId, userId: 'alice', createdAt },
      { tenantId, dialogId, userId: 'bob', createdAt: createdAt + 1 }
    ]);

    await DialogStats.create({
      tenantId,
      dialogId,
      memberCount: 2,
      messageCount: 5,
      topicCount: 0,
      lastUpdatedAt: createdAt,
      createdAt
    });

    await UserDialogStats.create({
      tenantId,
      userId: 'bob',
      dialogId,
      unreadCount: 3
    });

    await UserDialogActivity.create({
      tenantId,
      userId: 'bob',
      dialogId,
      lastSeenAt: 111,
      lastMessageAt: 222
    });
  });

  describe('actor membership gates', () => {
    test('AddDialogMembers rejects non-member actor', async () => {
      await expect(
        addDialogMembers({
          tenantId,
          userId: 'outsider',
          dialogId,
          memberUserIds: ['carol']
        })
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringMatching(/not a member/i)
      });
    });

    test('RemoveDialogMember rejects non-member actor', async () => {
      await expect(
        removeDialogMemberService({
          tenantId,
          userId: 'outsider',
          dialogId,
          memberUserId: 'bob'
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    test('UpdateDialogMeta rejects non-member actor', async () => {
      await expect(
        updateDialogMeta({
          tenantId,
          userId: 'outsider',
          dialogId,
          meta: { title: 'Nope' }
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    test('AddDialogMembers succeeds for member actor', async () => {
      const result = await addDialogMembers({
        tenantId,
        userId: 'alice',
        dialogId,
        memberUserIds: ['carol']
      });
      expect(result.addedUserIds).toContain('carol');
      expect(result.dialog.memberUserIds).toEqual(
        expect.arrayContaining(['alice', 'bob', 'carol'])
      );
    });
  });

  describe('getDialog enrichment', () => {
    test('with userId returns member unread/activity/joined and stats', async () => {
      const result = await getDialog({
        tenantId,
        dialogId,
        userId: 'bob'
      });

      expect(result.dialog.dialogId).toBe(dialogId);
      expect(result.member).toBeTruthy();
      expect(result.member.userId).toBe('bob');
      expect(result.member.state.unreadCount).toBe(3);
      expect(result.member.state.lastSeenAt).toBe(111);
      expect(result.member.state.lastMessageAt).toBe(222);
      expect(Number(result.member.state.joinedAt)).toBeGreaterThan(0);
      expect(result.stats).toEqual({
        memberCount: 2,
        messageCount: 5,
        topicCount: 0
      });
    });

    test('non-member userId → FORBIDDEN', async () => {
      await expect(
        getDialog({ tenantId, dialogId, userId: 'outsider' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    test('without userId still returns dialog + stats, no member', async () => {
      const result = await getDialog({ tenantId, dialogId });
      expect(result.dialog.memberUserIds).toEqual(
        expect.arrayContaining(['alice', 'bob'])
      );
      expect(result.member).toBeUndefined();
      expect(result.stats.memberCount).toBe(2);
    });
  });

  describe('listDialogMembers', () => {
    test('userId gate rejects outsider', async () => {
      await expect(
        listDialogMembers({
          tenantId,
          dialogId,
          userId: 'outsider'
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    test('returns members with joinedAt for member requester', async () => {
      const result = await listDialogMembers({
        tenantId,
        dialogId,
        userId: 'alice',
        page: 1,
        limit: 50
      });
      expect(result.memberUserIds).toEqual(expect.arrayContaining(['alice', 'bob']));
      expect(result.members).toHaveLength(2);
      expect(result.members.every((m) => Number(m.joinedAt) > 0)).toBe(true);
      expect(result.total).toBe(2);
    });
  });

  describe('listUserDialogs field pass-through', () => {
    test('rows include tenantId, createdAt, membersCount, joinedAt, unread', async () => {
      const result = await listUserDialogs({
        tenantId,
        userId: 'bob',
        page: 1,
        limit: 10,
        includeLastMessage: false
      });

      expect(result.data).toHaveLength(1);
      const row = result.data[0];
      expect(row.dialogId).toBe(dialogId);
      expect(row.tenantId).toBe(tenantId);
      expect(Number(row.createdAt)).toBeGreaterThan(0);
      expect(row.membersCount).toBe(2);
      expect(row.context.userId).toBe('bob');
      expect(row.context.unreadCount).toBe(3);
      expect(Number(row.context.joinedAt)).toBeGreaterThan(0);
      expect(row.stats.memberCount).toBe(2);
      expect(row.stats.messageCount).toBe(5);
    });
  });

  test('AppServiceError type sanity', () => {
    const err = new AppServiceError('FORBIDDEN', 'x');
    expect(err.code).toBe('FORBIDDEN');
  });
});
