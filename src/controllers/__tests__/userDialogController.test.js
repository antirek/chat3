import userDialogController from '../userDialogController.js';
import { Dialog, DialogMember, Message, Meta, User, Tenant } from '../../models/index.js';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from '../../utils/__tests__/setup.js';
import { generateTimestamp } from '../../utils/timestampUtils.js';

// Helper function to generate dialogId in correct format
function generateDialogId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateMessageId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'msg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

describe('userDialogController', () => {
  let mongoUri;
  const tenantId = 'tnt_test';
  const baseTimestamp = Date.now();

  // Mock request/response objects
  const createMockReq = (params = {}, query = {}) => ({
    params,
    query,
    tenantId
  });

  const createMockRes = () => {
    const res = {};
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.body = data;
      return res;
    };
    res.statusCode = undefined;
    res.body = undefined;
    return res;
  };

  beforeAll(async () => {
    mongoUri = await setupMongoMemoryServer();
    
    // Create test tenant
    await Tenant.create({
      tenantId,
      name: 'Test Tenant',
      domain: 'test.chat3.com',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
    
    // Recreate tenant after clearing
    await Tenant.create({
      tenantId,
      name: 'Test Tenant',
      domain: 'test.chat3.com',
      type: 'client',
      isActive: true,
      createdAt: generateTimestamp()
    });
  });

  describe('getUserDialogs - member filters', () => {
    let userId1, userId2, userId3, userId4;
    let dialog1, dialog2, dialog3, dialog4;

    beforeEach(async () => {
      // Create test users
      userId1 = 'carl';
      userId2 = 'alice';
      userId3 = 'bob';
      userId4 = 'marta';

      await User.create([
        { userId: userId1, tenantId, name: 'Carl', lastActiveAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId2, tenantId, name: 'Alice', lastActiveAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId3, tenantId, name: 'Bob', lastActiveAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId4, tenantId, name: 'Marta', lastActiveAt: generateTimestamp(), createdAt: generateTimestamp() }
      ]);

      // Create test dialogs
      dialog1 = await Dialog.create({
        dialogId: generateDialogId(),
        tenantId,
        createdBy: userId1,
        name: 'Dialog 1',
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      });

      dialog2 = await Dialog.create({
        dialogId: generateDialogId(),
        tenantId,
        createdBy: userId1,
        name: 'Dialog 2',
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      });

      dialog3 = await Dialog.create({
        dialogId: generateDialogId(),
        tenantId,
        createdBy: userId1,
        name: 'Dialog 3',
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      });

      dialog4 = await Dialog.create({
        dialogId: generateDialogId(),
        tenantId,
        createdBy: userId1,
        name: 'Dialog 4',
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      });

      // Create dialog members
      // Dialog 1: carl, alice, bob
      await DialogMember.create([
        { userId: userId1, dialogId: dialog1.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId2, dialogId: dialog1.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId3, dialogId: dialog1.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() }
      ]);

      // Dialog 2: carl, alice, marta
      await DialogMember.create([
        { userId: userId1, dialogId: dialog2.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId2, dialogId: dialog2.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId4, dialogId: dialog2.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() }
      ]);

      // Dialog 3: carl, bob
      await DialogMember.create([
        { userId: userId1, dialogId: dialog3.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId3, dialogId: dialog3.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() }
      ]);

      // Dialog 4: carl, marta
      await DialogMember.create([
        { userId: userId1, dialogId: dialog4.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId4, dialogId: dialog4.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() }
      ]);
    });

    test('should return all dialogs for user (no filter)', async () => {
      const req = createMockReq({ userId: userId1 }, { page: 1, limit: 10 });
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      expect(res.body.data).toHaveLength(4);
      expect(res.body.data.map(d => d.dialogId)).toContain(dialog1.dialogId);
      expect(res.body.data.map(d => d.dialogId)).toContain(dialog2.dialogId);
      expect(res.body.data.map(d => d.dialogId)).toContain(dialog3.dialogId);
      expect(res.body.data.map(d => d.dialogId)).toContain(dialog4.dialogId);
    });

    test('should filter dialogs by single member (eq)', async () => {
      // Filter: dialogs where carl is member AND alice is member
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: '(member,eq,alice)' }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.map(d => d.dialogId)).toContain(dialog1.dialogId);
      expect(res.body.data.map(d => d.dialogId)).toContain(dialog2.dialogId);
      expect(res.body.data.map(d => d.dialogId)).not.toContain(dialog3.dialogId);
      expect(res.body.data.map(d => d.dialogId)).not.toContain(dialog4.dialogId);
    });

    test('should filter dialogs by member $in (OR logic)', async () => {
      // Filter: dialogs where carl is member AND (alice OR marta) is member
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: '(member,in,[alice,marta])' }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(3);
      expect(response.data.map(d => d.dialogId)).toContain(dialog1.dialogId); // carl + alice
      expect(response.data.map(d => d.dialogId)).toContain(dialog2.dialogId); // carl + alice + marta
      expect(response.data.map(d => d.dialogId)).toContain(dialog4.dialogId); // carl + marta
      expect(response.data.map(d => d.dialogId)).not.toContain(dialog3.dialogId); // carl + bob (no alice/marta)
    });

    test('should filter dialogs by member $all (AND logic)', async () => {
      // Filter: dialogs where carl is member AND (alice AND bob) are members
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: '(member,all,[alice,bob])' }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(1);
      expect(response.data.map(d => d.dialogId)).toContain(dialog1.dialogId); // carl + alice + bob
      expect(response.data.map(d => d.dialogId)).not.toContain(dialog2.dialogId);
      expect(response.data.map(d => d.dialogId)).not.toContain(dialog3.dialogId);
      expect(response.data.map(d => d.dialogId)).not.toContain(dialog4.dialogId);
    });

    test('should filter dialogs by member $ne (exclude)', async () => {
      // Filter: dialogs where carl is member AND bob is NOT a member
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: '(member,ne,bob)' }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(2);
      expect(response.data.map(d => d.dialogId)).toContain(dialog2.dialogId); // carl + alice + marta (no bob)
      expect(response.data.map(d => d.dialogId)).toContain(dialog4.dialogId); // carl + marta (no bob)
      expect(response.data.map(d => d.dialogId)).not.toContain(dialog1.dialogId); // has bob
      expect(response.data.map(d => d.dialogId)).not.toContain(dialog3.dialogId); // has bob
    });

    test('should filter dialogs by member $nin (exclude multiple)', async () => {
      // Filter: dialogs where carl is member AND (bob AND marta) are NOT members
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: '(member,nin,[bob,marta])' }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      // Should return empty because all dialogs with carl have either bob or marta
      expect(response.data).toHaveLength(0);
    });

    test('should return empty when no dialogs match member filter', async () => {
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: '(member,eq,john)' }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(0);
      expect(response.pagination.total).toBe(0);
    });
  });

  describe('getUserDialogs - meta filters', () => {
    let userId1;
    let dialog1, dialog2, dialog3;

    beforeEach(async () => {
      userId1 = 'carl';

      await User.create({
        userId: userId1,
        tenantId,
        name: 'Carl',
        lastActiveAt: generateTimestamp(),
        createdAt: generateTimestamp()
      });

      dialog1 = await Dialog.create({
        dialogId: generateDialogId(),
        tenantId,
        createdBy: userId1,
        name: 'Dialog 1',
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      });

      dialog2 = await Dialog.create({
        dialogId: generateDialogId(),
        tenantId,
        createdBy: userId1,
        name: 'Dialog 2',
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      });

      dialog3 = await Dialog.create({
        dialogId: generateDialogId(),
        tenantId,
        createdBy: userId1,
        name: 'Dialog 3',
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      });

      // Create dialog members
      await DialogMember.create([
        { userId: userId1, dialogId: dialog1.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId1, dialogId: dialog2.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId1, dialogId: dialog3.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() }
      ]);

      // Create meta tags
      await Meta.create([
        { entityType: 'dialog', entityId: dialog1.dialogId, tenantId, key: 'department', value: 'sales', dataType: 'string', createdAt: generateTimestamp() },
        { entityType: 'dialog', entityId: dialog1.dialogId, tenantId, key: 'priority', value: 'high', dataType: 'string', createdAt: generateTimestamp() },
        { entityType: 'dialog', entityId: dialog2.dialogId, tenantId, key: 'department', value: 'sales', dataType: 'string', createdAt: generateTimestamp() },
        { entityType: 'dialog', entityId: dialog2.dialogId, tenantId, key: 'priority', value: 'low', dataType: 'string', createdAt: generateTimestamp() },
        { entityType: 'dialog', entityId: dialog3.dialogId, tenantId, key: 'department', value: 'support', dataType: 'string', createdAt: generateTimestamp() }
      ]);
    });

    test('should filter dialogs by meta tag (eq)', async () => {
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: '(meta.department,eq,sales)' }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(2);
      expect(response.data.map(d => d.dialogId)).toContain(dialog1.dialogId);
      expect(response.data.map(d => d.dialogId)).toContain(dialog2.dialogId);
      expect(response.data.map(d => d.dialogId)).not.toContain(dialog3.dialogId);
    });

    test('should filter dialogs by meta tag (ne)', async () => {
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: '(meta.department,ne,sales)' }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(1);
      expect(response.data.map(d => d.dialogId)).toContain(dialog3.dialogId);
      expect(response.data.map(d => d.dialogId)).not.toContain(dialog1.dialogId);
      expect(response.data.map(d => d.dialogId)).not.toContain(dialog2.dialogId);
    });

    test('should filter dialogs by multiple meta tags (AND logic)', async () => {
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: '(meta.department,eq,sales)&(meta.priority,eq,high)' }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(1);
      expect(response.data.map(d => d.dialogId)).toContain(dialog1.dialogId);
      expect(response.data.map(d => d.dialogId)).not.toContain(dialog2.dialogId);
      expect(response.data.map(d => d.dialogId)).not.toContain(dialog3.dialogId);
    });
  });

  describe('getUserDialogs - dialogId filter', () => {
    let userId1;
    let dialog1, dialog2, dialog3;

    beforeEach(async () => {
      userId1 = 'usr_mu7cgrut';

      await User.create({
        userId: userId1,
        tenantId,
        name: 'Test User',
        lastActiveAt: generateTimestamp(),
        createdAt: generateTimestamp()
      });

      dialog1 = await Dialog.create({
        dialogId: 'dlg_vxlpjst3qr1we1jogf9p',
        tenantId,
        createdBy: userId1,
        name: 'Dialog 1',
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      });

      dialog2 = await Dialog.create({
        dialogId: generateDialogId(),
        tenantId,
        createdBy: userId1,
        name: 'Dialog 2',
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      });

      dialog3 = await Dialog.create({
        dialogId: generateDialogId(),
        tenantId,
        createdBy: userId1,
        name: 'Dialog 3',
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      });

      // Create dialog members - user1 is member of all dialogs
      await DialogMember.create([
        { userId: userId1, dialogId: dialog1.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId1, dialogId: dialog2.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId1, dialogId: dialog3.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() }
      ]);
    });

    test('should filter dialogs by dialogId (regular filter)', async () => {
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: `(dialogId,eq,${dialog1.dialogId})` }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(1);
      expect(response.data[0].dialogId).toBe(dialog1.dialogId);
      expect(response.pagination.total).toBe(1);
    });

    test('should return empty when dialogId not found', async () => {
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: '(dialogId,eq,dlg_nonexistent123456789)' }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(0);
      expect(response.pagination.total).toBe(0);
    });

    test('should filter dialogs by dialogId combined with meta filter', async () => {
      // Add meta tag to dialog1
      await Meta.create({
        entityType: 'dialog',
        entityId: dialog1.dialogId,
        tenantId,
        key: 'department',
        value: 'sales',
        dataType: 'string',
        createdAt: generateTimestamp()
      });

      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: `(meta.department,eq,sales)&(dialogId,eq,${dialog1.dialogId})` }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(1);
      expect(response.data[0].dialogId).toBe(dialog1.dialogId);
    });

    test('should return empty when dialogId combined with meta filter has no intersection', async () => {
      // Add meta tag to dialog2 (not dialog1)
      await Meta.create({
        entityType: 'dialog',
        entityId: dialog2.dialogId,
        tenantId,
        key: 'department',
        value: 'sales',
        dataType: 'string',
        createdAt: generateTimestamp()
      });

      // Filter by department=sales and dialogId=dialog1 (which doesn't have sales)
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: `(meta.department,eq,sales)&(dialogId,eq,${dialog1.dialogId})` }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(0);
      expect(response.pagination.total).toBe(0);
    });
  });

  describe('getUserDialogs - combined filters', () => {
    let userId1, userId2, userId3;
    let dialog1, dialog2, dialog3;

    beforeEach(async () => {
      userId1 = 'carl';
      userId2 = 'alice';
      userId3 = 'bob';

      await User.create([
        { userId: userId1, tenantId, name: 'Carl', lastActiveAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId2, tenantId, name: 'Alice', lastActiveAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId3, tenantId, name: 'Bob', lastActiveAt: generateTimestamp(), createdAt: generateTimestamp() }
      ]);

      dialog1 = await Dialog.create({
        dialogId: generateDialogId(),
        tenantId,
        createdBy: userId1,
        name: 'Dialog 1',
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      });

      dialog2 = await Dialog.create({
        dialogId: generateDialogId(),
        tenantId,
        createdBy: userId1,
        name: 'Dialog 2',
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      });

      dialog3 = await Dialog.create({
        dialogId: generateDialogId(),
        tenantId,
        createdBy: userId1,
        name: 'Dialog 3',
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      });

      // Create dialog members
      await DialogMember.create([
        { userId: userId1, dialogId: dialog1.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 5, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId2, dialogId: dialog1.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId3, dialogId: dialog1.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId1, dialogId: dialog2.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 2, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId2, dialogId: dialog2.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 0, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() },
        { userId: userId1, dialogId: dialog3.dialogId, tenantId, role: 'member', isActive: true, unreadCount: 10, joinedAt: generateTimestamp(), lastSeenAt: generateTimestamp(), lastMessageAt: generateTimestamp(), createdAt: generateTimestamp() }
      ]);

      // Create meta tags
      await Meta.create([
        { entityType: 'dialog', entityId: dialog1.dialogId, tenantId, key: 'department', value: 'sales', dataType: 'string', createdAt: generateTimestamp() },
        { entityType: 'dialog', entityId: dialog2.dialogId, tenantId, key: 'department', value: 'sales', dataType: 'string', createdAt: generateTimestamp() },
        { entityType: 'dialog', entityId: dialog3.dialogId, tenantId, key: 'department', value: 'support', dataType: 'string', createdAt: generateTimestamp() }
      ]);
    });

    test('should filter dialogs by member AND meta tag', async () => {
      // Filter: dialogs where carl is member AND alice is member AND department=sales
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: '(member,eq,alice)&(meta.department,eq,sales)' }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(2);
      expect(response.data.map(d => d.dialogId)).toContain(dialog1.dialogId);
      expect(response.data.map(d => d.dialogId)).toContain(dialog2.dialogId);
      expect(response.data.map(d => d.dialogId)).not.toContain(dialog3.dialogId);
    });

    test('should filter dialogs by member AND unreadCount', async () => {
      // Filter: dialogs where carl is member AND alice is member AND unreadCount >= 3
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: '(member,eq,alice)', unreadCount: { $gte: 3 } }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      // Dialog1 has unreadCount=5, Dialog2 has unreadCount=2
      expect(response.data).toHaveLength(1);
      expect(response.data.map(d => d.dialogId)).toContain(dialog1.dialogId);
      expect(response.data.map(d => d.dialogId)).not.toContain(dialog2.dialogId);
    });

    test('should filter dialogs by meta tag AND unreadCount', async () => {
      // Filter: dialogs where department=sales AND unreadCount >= 3
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 10, filter: '(meta.department,eq,sales)', unreadCount: { $gte: 3 } }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      // Dialog1 has department=sales and unreadCount=5
      expect(response.data).toHaveLength(1);
      expect(response.data.map(d => d.dialogId)).toContain(dialog1.dialogId);
      expect(response.data.map(d => d.dialogId)).not.toContain(dialog2.dialogId);
    });
  });

  describe('getUserDialogs - pagination and sorting', () => {
    let userId1;
    let dialogs = [];

    beforeEach(async () => {
      userId1 = 'carl';

      await User.create({
        userId: userId1,
        tenantId,
        name: 'Carl',
        lastActiveAt: generateTimestamp(),
        createdAt: generateTimestamp()
      });

      // Create 15 dialogs
      for (let i = 1; i <= 15; i++) {
        const dialog = await Dialog.create({
          dialogId: generateDialogId(),
          tenantId,
          createdBy: userId1,
          name: `Dialog ${i}`,
          createdAt: generateTimestamp() + i * 1000, // Different timestamps
          updatedAt: generateTimestamp() + i * 1000
        });

        await DialogMember.create({
          userId: userId1,
          dialogId: dialog.dialogId,
          tenantId,
          role: 'member',
          isActive: true,
          unreadCount: i,
          joinedAt: generateTimestamp() + i * 1000,
          lastSeenAt: generateTimestamp() + i * 1000,
          lastMessageAt: generateTimestamp() + i * 1000,
          createdAt: generateTimestamp() + i * 1000
        });

        dialogs.push(dialog);
      }
    });

    test('should paginate results correctly', async () => {
      const req = createMockReq(
        { userId: userId1 },
        { page: 1, limit: 5 }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(5);
      expect(response.pagination.page).toBe(1);
      expect(response.pagination.limit).toBe(5);
      expect(response.pagination.total).toBe(15);
      expect(response.pagination.pages).toBe(3);
    });

    test('should return correct page 2', async () => {
      const req = createMockReq(
        { userId: userId1 },
        { page: 2, limit: 5 }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(5);
      expect(response.pagination.page).toBe(2);
      expect(response.pagination.limit).toBe(5);
      expect(response.pagination.total).toBe(15);
      expect(response.pagination.pages).toBe(3);
    });

    test('should return empty for page beyond total', async () => {
      const req = createMockReq(
        { userId: userId1 },
        { page: 10, limit: 5 }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(0);
      expect(response.pagination.page).toBe(10);
      expect(response.pagination.total).toBe(15);
    });
  });

  describe('getUserDialogs - error handling', () => {
    test('should return 400 for invalid filter format', async () => {
      // Create user first
      await User.create({
        userId: 'carl',
        tenantId,
        name: 'Carl',
        lastActiveAt: generateTimestamp(),
        createdAt: generateTimestamp()
      });

      const req = createMockReq(
        { userId: 'carl' },
        { page: 1, limit: 10, filter: '(field,invalid_operator,value)' }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.error).toBe('Bad Request');
      expect(response.message).toContain('Invalid filter format');
    });

    test('should return empty array for non-existent user', async () => {
      const req = createMockReq(
        { userId: 'nonexistent' },
        { page: 1, limit: 10 }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogs(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body).toBeDefined();
      const response = res.body;
      expect(response.data).toHaveLength(0);
      expect(response.pagination.total).toBe(0);
    });
  });

  describe('getUserDialogMessages - senderInfo', () => {
    let dialog;
    const viewerId = 'usr_viewer';
    const senderId = 'usr_sender';

    beforeEach(async () => {
      const timestamp = generateTimestamp();

      await User.create([
        { tenantId, userId: viewerId, name: 'Viewer', lastActiveAt: timestamp, createdAt: timestamp },
        { tenantId, userId: senderId, name: 'Support Agent', lastActiveAt: timestamp, createdAt: timestamp }
      ]);

      await Meta.create([
        { tenantId, entityType: 'user', entityId: senderId, key: 'role', value: 'agent', dataType: 'string' }
      ]);

      dialog = await Dialog.create({
        dialogId: generateDialogId(),
        tenantId,
        createdBy: viewerId,
        name: 'Support Dialog',
        createdAt: timestamp,
        updatedAt: timestamp
      });

      await DialogMember.create([
        { tenantId, dialogId: dialog.dialogId, userId: viewerId, isActive: true, unreadCount: 0, joinedAt: timestamp },
        { tenantId, dialogId: dialog.dialogId, userId: senderId, isActive: true, unreadCount: 0, joinedAt: timestamp }
      ]);

      await Message.create({
        tenantId,
        dialogId: dialog.dialogId,
        messageId: generateMessageId(),
        senderId,
        content: 'Hello!',
        type: 'internal.text',
        createdAt: timestamp,
        updatedAt: timestamp
      });
    });

    test('includes senderInfo for each message', async () => {
      const req = createMockReq(
        { userId: viewerId, dialogId: dialog.dialogId },
        { page: 1, limit: 10 }
      );
      const res = createMockRes();

      await userDialogController.getUserDialogMessages(req, res);

      expect(res.statusCode).toBeUndefined();
      expect(res.body?.data).toHaveLength(1);
      const [message] = res.body.data;
      expect(message).toHaveProperty('senderInfo');
      expect(message.senderInfo).toEqual(
        expect.objectContaining({
          userId: senderId,
          name: 'Support Agent',
          meta: expect.objectContaining({ role: 'agent' })
        })
      );
    });
  });
});

