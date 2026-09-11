import {
  sendTyping,
  AppServiceError
} from '@chat3/app-services';
import {
  Dialog,
  DialogMember,
  Event,
  Tenant,
  User
} from '@chat3/models';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../../../packages/tenant-api/src/utils/__tests__/setup.js';

const tenantId = 'tnt_test';

const generateDialogId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

describe('sendTyping service', () => {
  let dialog;

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
      name: 'Tenant',
      domain: 'tenant.chat3.dev',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });

    await User.create({
      tenantId,
      userId: 'alice',
      name: 'Alice',
      createdAt: generateTimestamp()
    });

    dialog = await Dialog.create({
      tenantId,
      dialogId: generateDialogId(),
      createdBy: 'alice',
      createdAt: generateTimestamp()
    });

    await DialogMember.create({
      tenantId,
      dialogId: dialog.dialogId,
      userId: 'alice',
      unreadCount: 0,
      isActive: true,
      lastSeenAt: generateTimestamp(),
      lastMessageAt: generateTimestamp(),
      createdAt: generateTimestamp()
    });
  });

  test('emits typing event for dialog member', async () => {
    const result = await sendTyping({
      tenantId,
      dialogId: dialog.dialogId,
      userId: 'alice'
    });

    expect(result.dialogId).toBe(dialog.dialogId);
    expect(result.userId).toBe('alice');
    expect(result.expiresInMs).toBe(5000);

    const event = await Event.findOne({
      tenantId,
      eventType: 'dialog.typing',
      entityId: dialog.dialogId
    }).lean();

    expect(event).toBeTruthy();
    expect(event.actorId).toBe('alice');
    expect(event.data.typing.userId).toBe('alice');
    expect(event.data.member).toBeUndefined();
    expect(event.data.dialog).toBeTruthy();
  });

  test('throws NOT_FOUND when dialog missing', async () => {
    await expect(
      sendTyping({
        tenantId,
        dialogId: 'dlg_aaaaaaaaaaaaaaaaaaaa',
        userId: 'alice'
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Dialog not found' });
  });

  test('throws NOT_FOUND when user is not a member', async () => {
    await expect(
      sendTyping({
        tenantId,
        dialogId: dialog.dialogId,
        userId: 'bob'
      })
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'User is not a member of this dialog'
    });
  });

  test('throws VALIDATION when dialogId empty', async () => {
    await expect(
      sendTyping({ tenantId, dialogId: '', userId: 'alice' })
    ).rejects.toBeInstanceOf(AppServiceError);
  });
});
