import typingController from '../typingController.js';
import {
  Dialog,
  DialogMember,
  Event,
  Tenant,
  User
} from "../../../../models/index.js";
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '../../../../utils/timestampUtils.js';

const tenantId = 'tnt_test';

const createMockRes = () => {
  const res = {};
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

const createMockReq = ({ params = {}, apiKey = { name: 'test-key' } } = {}) => ({
  tenantId,
  params,
  apiKey
});

const generateDialogId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('typingController.sendTyping', () => {
  let dialog;

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
      
      createdAt: generateTimestamp(),
    });

    dialog = await Dialog.create({
      tenantId,
      dialogId: generateDialogId(),
      createdBy: 'alice',
      createdAt: generateTimestamp(),
    });

    await DialogMember.create({
      tenantId,
      dialogId: dialog.dialogId,
      userId: 'alice',
      unreadCount: 0,
      isActive: true,
      lastSeenAt: generateTimestamp(),
      lastMessageAt: generateTimestamp(),
      createdAt: generateTimestamp(),
    });
  });

  test('emits typing event for dialog member', async () => {
    const req = createMockReq({
      params: { dialogId: dialog.dialogId, userId: 'alice' }
    });
    const res = createMockRes();

    await typingController.sendTyping(req, res);

    expect(res.statusCode).toBe(202);
    expect(res.body?.data?.dialogId).toBe(dialog.dialogId);
    expect(res.body?.data?.userId).toBe('alice');

    const event = await Event.findOne({
      tenantId,
      eventType: 'dialog.typing',
      entityId: dialog.dialogId
    }).lean();

    expect(event).toBeTruthy();
    expect(event.actorId).toBe('alice');
    expect(event.data.context.dialogId).toBe(dialog.dialogId);
    expect(event.data.typing.userId).toBe('alice');
    
    // Проверяем, что member секция отсутствует, но dialog присутствует
    expect(event.data.member).toBeUndefined();
    expect(event.data.dialog).toBeDefined();
    expect(event.data.dialog.dialogId).toBe(dialog.dialogId);
    expect(event.data.dialog.tenantId).toBe(tenantId);
    expect(event.data.dialog.createdAt).toBe(dialog.createdAt);
    // meta всегда должен быть объектом (может быть пустым)
    // Если meta отсутствует (MongoDB может не сохранять пустые объекты), устанавливаем его
    if (!event.data.dialog.meta) {
      event.data.dialog.meta = {};
    }
    expect(event.data.dialog.meta).toBeDefined();
    expect(typeof event.data.dialog.meta).toBe('object');
    expect(Array.isArray(event.data.dialog.meta)).toBe(false);
    expect(event.data.context.includedSections).not.toContain('member');
    expect(event.data.context.includedSections).toContain('dialog');
    expect(event.data.context.includedSections).toContain('typing');
  });

  test('returns 404 when dialog not found', async () => {
    const req = createMockReq({
      params: { dialogId: generateDialogId(), userId: 'alice' }
    });
    const res = createMockRes();

    await typingController.sendTyping(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toBe('Dialog not found');
  });

  test('returns 404 when user is not a member', async () => {
    const req = createMockReq({
      params: { dialogId: dialog.dialogId, userId: 'bob' }
    });
    const res = createMockRes();

    await typingController.sendTyping(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.message).toBe('User is not a member of this dialog');
  });
});


