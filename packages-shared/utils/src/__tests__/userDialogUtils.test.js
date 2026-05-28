import { MessageStatus } from '@chat3/models';
import { buildStatusMessageMatrix } from '../userDialogUtils.js';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
} from '@chat3/tenant-api/src/utils/__tests__/setup.js';

const tenantId = 'tnt_status_matrix';
const messageId = 'msg_statusmatrix00000000';
const dialogId = 'dlg_statusmatrix00000000';
const senderId = 'cnt_sender000000000001';

describe('buildStatusMessageMatrix', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('uses latest status per recipient, not full history', async () => {
    await MessageStatus.insertMany([
      {
        tenantId,
        messageId,
        dialogId,
        userId: 'cnt_a',
        userType: 'contact',
        status: 'unread',
        createdAt: 1000
      },
      {
        tenantId,
        messageId,
        dialogId,
        userId: 'cnt_a',
        userType: 'contact',
        status: 'read',
        createdAt: 2000
      },
      {
        tenantId,
        messageId,
        dialogId,
        userId: 'cnt_b',
        userType: 'contact',
        status: 'unread',
        createdAt: 1500
      },
      {
        tenantId,
        messageId,
        dialogId,
        userId: 'usr_reader',
        userType: 'user',
        status: 'read',
        createdAt: 1600
      }
    ]);

    const matrix = await buildStatusMessageMatrix(tenantId, messageId, senderId);

    expect(matrix).toEqual(
      expect.arrayContaining([
        { userType: 'contact', status: 'read', count: 1 },
        { userType: 'contact', status: 'unread', count: 1 },
        { userType: 'user', status: 'read', count: 1 }
      ])
    );
    const contactUnread = matrix.find((r) => r.userType === 'contact' && r.status === 'unread');
    expect(contactUnread?.count).toBe(1);
    expect(matrix.find((r) => r.userType === 'contact' && r.status === 'read')?.count).toBe(1);
    expect(matrix.filter((r) => r.userType === 'contact' && r.status === 'unread').length).toBe(1);
  });

  it('excludes sender statuses', async () => {
    await MessageStatus.insertMany([
      {
        tenantId,
        messageId,
        dialogId,
        userId: senderId,
        userType: 'contact',
        status: 'read',
        createdAt: 1000
      },
      {
        tenantId,
        messageId,
        dialogId,
        userId: 'usr_other',
        userType: 'user',
        status: 'unread',
        createdAt: 1100
      }
    ]);

    const matrix = await buildStatusMessageMatrix(tenantId, messageId, senderId);
    expect(matrix).toEqual([{ userType: 'user', status: 'unread', count: 1 }]);
  });
});
