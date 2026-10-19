import {
  getMessage,
  searchMessages,
  listMessageStatuses,
  deleteDialog,
  setEntityMetaService,
  getEntityMetaService,
  deleteEntityMetaService,
  AppServiceError
} from '@chat3/app-services';
import {
  Dialog,
  DialogMember,
  DialogStats,
  Message,
  MessageStatus,
  Meta,
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

const tenantId = 'tnt_grpc_gaps';

const generateDialogId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateMessageId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'msg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

describe('gRPC gap app-services (GetMessage / Search / Meta / DeleteDialog / Statuses)', () => {
  let dialogId;
  let messageId;
  let otherMessageId;

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
      name: 'GrpcGaps',
      domain: 'grpc-gaps.chat3.dev',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });

    await User.create([
      { tenantId, userId: 'alice', type: 'user', createdAt: generateTimestamp() },
      { tenantId, userId: 'bob', type: 'user', createdAt: generateTimestamp() },
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
      messageCount: 2,
      topicCount: 0,
      lastUpdatedAt: createdAt,
      createdAt
    });

    messageId = generateMessageId();
    otherMessageId = generateMessageId();
    await Message.create([
      {
        tenantId,
        dialogId,
        messageId,
        senderId: 'alice',
        type: 'internal.text',
        content: 'hello-alice',
        createdAt: createdAt + 10
      },
      {
        tenantId,
        dialogId,
        messageId: otherMessageId,
        senderId: 'bob',
        type: 'internal.text',
        content: 'hello-bob',
        createdAt: createdAt + 20
      }
    ]);

    await MessageStatus.create([
      {
        tenantId,
        dialogId,
        messageId,
        userId: 'bob',
        userType: 'user',
        status: 'delivered',
        createdAt: createdAt + 11
      },
      {
        tenantId,
        dialogId,
        messageId,
        userId: 'bob',
        userType: 'user',
        status: 'read',
        createdAt: createdAt + 12
      }
    ]);
  });

  describe('getMessage', () => {
    test('returns message by id', async () => {
      const result = await getMessage({ tenantId, messageId });
      expect(result.message.messageId).toBe(messageId);
      expect(result.message.content).toBe('hello-alice');
      expect(result.message.dialogId).toBe(dialogId);
    });

    test('membership gate rejects outsider', async () => {
      await expect(
        getMessage({ tenantId, messageId, userId: 'outsider' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    test('membership gate allows member', async () => {
      const result = await getMessage({ tenantId, messageId, userId: 'bob' });
      expect(result.message.messageId).toBe(messageId);
    });

    test('not found', async () => {
      await expect(
        getMessage({ tenantId, messageId: generateMessageId() })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('searchMessages', () => {
    test('lists tenant messages with pagination', async () => {
      const result = await searchMessages({ tenantId, page: 1, limit: 10 });
      expect(result.pagination.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.data.map((m) => m.messageId)).toEqual(
        expect.arrayContaining([messageId, otherMessageId])
      );
    });

    test('filters by senderId', async () => {
      const result = await searchMessages({
        tenantId,
        filter: '(senderId,eq,bob)',
        page: 1,
        limit: 10
      });
      expect(result.pagination.total).toBe(1);
      expect(result.data[0].messageId).toBe(otherMessageId);
      expect(result.data[0].content).toBe('hello-bob');
    });
  });

  describe('listMessageStatuses', () => {
    test('returns status history newest-first for member', async () => {
      const result = await listMessageStatuses({
        tenantId,
        userId: 'alice',
        dialogId,
        messageId,
        page: 1,
        limit: 50
      });
      expect(result.pagination.total).toBe(2);
      expect(result.data[0].status).toBe('read');
      expect(result.data[1].status).toBe('delivered');
    });

    test('rejects non-member', async () => {
      await expect(
        listMessageStatuses({
          tenantId,
          userId: 'outsider',
          dialogId,
          messageId
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('entity meta', () => {
    test('set / get / delete dialog meta key', async () => {
      await setEntityMetaService({
        tenantId,
        entityType: 'dialog',
        entityId: dialogId,
        key: 'title',
        value: 'Support',
        dataType: 'string',
        userId: 'alice'
      });

      const got = await getEntityMetaService({
        tenantId,
        entityType: 'dialog',
        entityId: dialogId,
        key: 'title'
      });
      expect(got.meta.title).toBe('Support');

      const all = await getEntityMetaService({
        tenantId,
        entityType: 'dialog',
        entityId: dialogId
      });
      expect(all.meta.title).toBe('Support');

      const del = await deleteEntityMetaService({
        tenantId,
        entityType: 'dialog',
        entityId: dialogId,
        key: 'title',
        userId: 'alice'
      });
      expect(del.deleted).toBe(true);

      const after = await Meta.find({ tenantId, entityType: 'dialog', entityId: dialogId, key: 'title' });
      expect(after).toHaveLength(0);
    });

    test('rejects invalid entityType', async () => {
      await expect(
        setEntityMetaService({
          tenantId,
          entityType: 'widget',
          entityId: 'x',
          key: 'a',
          value: 'b'
        })
      ).rejects.toBeInstanceOf(AppServiceError);
    });
  });

  describe('deleteDialog', () => {
    test('deletes dialog and cascades members/stats', async () => {
      const result = await deleteDialog({
        tenantId,
        dialogId,
        userId: 'alice'
      });
      expect(result.deleted).toBe(true);
      expect(result.dialogId).toBe(dialogId);

      expect(await Dialog.findOne({ tenantId, dialogId })).toBeNull();
      expect(await DialogMember.countDocuments({ tenantId, dialogId })).toBe(0);
      expect(await DialogStats.countDocuments({ tenantId, dialogId })).toBe(0);
      expect(await UserDialogStats.countDocuments({ tenantId, dialogId })).toBe(0);
      expect(await UserDialogActivity.countDocuments({ tenantId, dialogId })).toBe(0);
    });

    test('not found', async () => {
      await expect(
        deleteDialog({ tenantId, dialogId: generateDialogId() })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
