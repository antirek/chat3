import {
  updateUnreadCount,
  updateReactionCount,
  updateStatusCount,
  updateUserStatsDialogCount,
  updateUserStatsTotalMessagesCount,
  finalizeCounterUpdateContext,
  getMessageReactionCounts,
  getMessageStatusCounts,
  recalculateUserStats,
  getCounterHistory
} from '../counterUtils.js';
import { 
  UserStats, 
  UserDialogStats, 
  MessageReactionStats, 
  MessageStatusStats, 
  CounterHistory,
  User,
  DialogMember,
  Message
} from '@chat3/models';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from '@chat3/tenant-api/src/utils/__tests__/setup.js';

// Setup MongoDB перед всеми тестами в этом файле
beforeAll(async () => {
  await setupMongoMemoryServer();
});

// Teardown MongoDB после всех тестов в этом файле
afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('counterUtils - Integration Tests with MongoDB', () => {
  const tenantId = 'tnt_test';

  beforeEach(async () => {
    await clearDatabase();
  });

  // Вспомогательные функции для генерации ID
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

  function generateEventId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'evt_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  describe('updateUnreadCount', () => {
    test('should increment unread count for new user-dialog pair', async () => {
      const dialogId = generateDialogId();
      const userId = 'user1';
      const messageId = generateMessageId();
      const eventId = generateEventId();

      const result = await updateUnreadCount(
        tenantId,
        userId,
        dialogId,
        1,
        'message.create',
        eventId,
        messageId,
        'sender1',
        'user'
      );

      expect(result.oldValue).toBe(0);
      expect(result.newValue).toBe(1);

      const stats = await UserDialogStats.findOne({ tenantId, userId, dialogId });
      expect(stats).toBeDefined();
      expect(stats.unreadCount).toBe(1);

      // Проверяем, что UserStats обновился
      const userStats = await UserStats.findOne({ tenantId, userId });
      expect(userStats).toBeDefined();
      expect(userStats.unreadDialogsCount).toBe(1);
      expect(userStats.totalUnreadCount).toBe(1);
    });

    test('should decrement unread count', async () => {
      const dialogId = generateDialogId();
      const userId = 'user1';
      const messageId = generateMessageId();
      const eventId = generateEventId();

      // Сначала увеличиваем
      await updateUnreadCount(tenantId, userId, dialogId, 1, 'message.create', eventId, messageId, 'sender1', 'user');

      // Затем уменьшаем
      const result = await updateUnreadCount(
        tenantId,
        userId,
        dialogId,
        -1,
        'message.status.update',
        eventId,
        messageId,
        userId,
        'user'
      );

      expect(result.newValue).toBe(0);

      const stats = await UserDialogStats.findOne({ tenantId, userId, dialogId });
      expect(stats.unreadCount).toBe(0);

      // Проверяем, что UserStats обновился (диалог стал прочитанным)
      const userStats = await UserStats.findOne({ tenantId, userId });
      expect(userStats.unreadDialogsCount).toBe(0);
      expect(userStats.totalUnreadCount).toBe(0);
    });

    test('should prevent negative unread count', async () => {
      const dialogId = generateDialogId();
      const userId = 'user1';
      const messageId = generateMessageId();
      const eventId = generateEventId();

      // Сначала создаем UserStats для пользователя, чтобы избежать ошибок
      await UserStats.create({
        tenantId,
        userId,
        dialogCount: 0,
        unreadDialogsCount: 0,
        totalUnreadCount: 0,
        totalMessagesCount: 0
      });

      // Пытаемся уменьшить с 0
      const result = await updateUnreadCount(
        tenantId,
        userId,
        dialogId,
        -1,
        'message.status.update',
        eventId,
        messageId,
        userId,
        'user'
      );

      expect(result.newValue).toBe(0);

      const stats = await UserDialogStats.findOne({ tenantId, userId, dialogId });
      expect(stats.unreadCount).toBe(0);
      
      // Проверяем, что totalUnreadCount не стал отрицательным
      const userStats = await UserStats.findOne({ tenantId, userId });
      expect(userStats.totalUnreadCount).toBeGreaterThanOrEqual(0);
    });

    test('should save counter history', async () => {
      const dialogId = generateDialogId();
      const userId = 'user1';
      const messageId = generateMessageId();
      const eventId = generateEventId();

      await updateUnreadCount(
        tenantId,
        userId,
        dialogId,
        1,
        'message.create',
        eventId,
        messageId,
        'sender1',
        'user'
      );

      const history = await CounterHistory.findOne({
        tenantId,
        counterType: 'userDialogStats.unreadCount',
        entityId: `${dialogId}:${userId}`
      });

      expect(history).toBeDefined();
      expect(history.oldValue).toBe(0);
      expect(history.newValue).toBe(1);
      expect(history.delta).toBe(1);
      expect(history.operation).toBe('increment');
    });
  });

  describe('updateUserStatsDialogCount', () => {
    test('should increment dialog count', async () => {
      const userId = 'user1';
      const eventId = generateEventId();

      const result = await updateUserStatsDialogCount(
        tenantId,
        userId,
        1,
        'dialog.member.add',
        eventId,
        'actor1',
        'user'
      );

      expect(result.oldValue).toBe(0);
      expect(result.newValue).toBe(1);

      const stats = await UserStats.findOne({ tenantId, userId });
      expect(stats).toBeDefined();
      expect(stats.dialogCount).toBe(1);
    });

    test('should decrement dialog count', async () => {
      const userId = 'user1';
      const eventId = generateEventId();

      // Сначала увеличиваем
      await updateUserStatsDialogCount(tenantId, userId, 1, 'dialog.member.add', eventId, 'actor1', 'user');

      // Затем уменьшаем
      const result = await updateUserStatsDialogCount(
        tenantId,
        userId,
        -1,
        'dialog.member.remove',
        eventId,
        'actor1',
        'user'
      );

      expect(result.newValue).toBe(0);

      const stats = await UserStats.findOne({ tenantId, userId });
      expect(stats.dialogCount).toBe(0);
    });
  });

  describe('updateUserStatsTotalMessagesCount', () => {
    test('should increment total messages count', async () => {
      const userId = 'user1';
      const messageId = generateMessageId();
      const eventId = generateEventId();

      const result = await updateUserStatsTotalMessagesCount(
        tenantId,
        userId,
        1,
        'message.create',
        eventId,
        messageId,
        userId,
        'user'
      );

      expect(result.oldValue).toBe(0);
      expect(result.newValue).toBe(1);

      const stats = await UserStats.findOne({ tenantId, userId });
      expect(stats).toBeDefined();
      expect(stats.totalMessagesCount).toBe(1);
    });
  });

  describe('updateReactionCount', () => {
    test('should increment reaction count', async () => {
      const messageId = generateMessageId();

      const result = await updateReactionCount(
        tenantId,
        messageId,
        '👍',
        1,
        'message.reaction.update',
        'user1',
        'user'
      );

      expect(result.oldValue).toBe(0);
      expect(result.newValue).toBe(1);

      const stats = await MessageReactionStats.findOne({ tenantId, messageId, reaction: '👍' });
      expect(stats).toBeDefined();
      expect(stats.count).toBe(1);
    });

    test('should delete record when count reaches 0', async () => {
      const messageId = generateMessageId();

      // Сначала увеличиваем
      await updateReactionCount(tenantId, messageId, '👍', 1, 'message.reaction.update', 'user1', 'user');

      // Затем уменьшаем до 0
      const result = await updateReactionCount(
        tenantId,
        messageId,
        '👍',
        -1,
        'message.reaction.update',
        'user1',
        'user'
      );

      expect(result.newValue).toBe(0);

      const stats = await MessageReactionStats.findOne({ tenantId, messageId, reaction: '👍' });
      expect(stats).toBeNull();
    });
  });

  describe('updateStatusCount', () => {
    test('should increment status count', async () => {
      const messageId = generateMessageId();

      const result = await updateStatusCount(
        tenantId,
        messageId,
        'read',
        1,
        'message.status.update',
        'user1',
        'user'
      );

      expect(result.oldValue).toBe(0);
      expect(result.newValue).toBe(1);

      const stats = await MessageStatusStats.findOne({ tenantId, messageId, status: 'read' });
      expect(stats).toBeDefined();
      expect(stats.count).toBe(1);
    });
  });

  describe('getMessageReactionCounts', () => {
    test('should return all reaction counts for a message', async () => {
      const messageId = generateMessageId();
      const eventId = generateEventId();

      await updateReactionCount(tenantId, messageId, '👍', 2, 'message.reaction.update', 'user1', 'user');
      await updateReactionCount(tenantId, messageId, '❤️', 1, 'message.reaction.update', 'user2', 'user');

      const counts = await getMessageReactionCounts(tenantId, messageId);

      expect(counts).toHaveLength(2);
      expect(counts.find(r => r.reaction === '👍').count).toBe(2);
      expect(counts.find(r => r.reaction === '❤️').count).toBe(1);
    });
  });

  describe('getMessageStatusCounts', () => {
    test('should return all status counts for a message', async () => {
      const messageId = generateMessageId();
      const eventId = generateEventId();

      await updateStatusCount(tenantId, messageId, 'read', 3, 'message.status.update', 'user1', 'user');
      await updateStatusCount(tenantId, messageId, 'delivered', 2, 'message.status.update', 'user2', 'user');

      const counts = await getMessageStatusCounts(tenantId, messageId);

      expect(counts).toHaveLength(2);
      expect(counts.find(s => s.status === 'read').count).toBe(3);
      expect(counts.find(s => s.status === 'delivered').count).toBe(2);
    });
  });

  describe('recalculateUserStats', () => {
    test('should recalculate user stats from UserDialogStats', async () => {
      const userId = 'user1';
      const dialogId1 = generateDialogId();
      const dialogId2 = generateDialogId();
      const messageId = generateMessageId();
      const eventId = generateEventId();

      // Создаем DialogMember записи (основная таблица участников диалогов)
      await DialogMember.create({ tenantId, userId, dialogId: dialogId1 });
      await DialogMember.create({ tenantId, userId, dialogId: dialogId2 });

      // Создаем два диалога с непрочитанными сообщениями
      await updateUnreadCount(tenantId, userId, dialogId1, 3, 'message.create', eventId, messageId, 'sender1', 'user');
      await updateUnreadCount(tenantId, userId, dialogId2, 2, 'message.create', eventId, messageId, 'sender1', 'user');

      // Создаем сообщения от пользователя для проверки totalMessagesCount
      await Message.create({ tenantId, messageId: generateMessageId(), dialogId: dialogId1, senderId: userId, content: 'Test', type: 'internal.text' });
      await Message.create({ tenantId, messageId: generateMessageId(), dialogId: dialogId2, senderId: userId, content: 'Test', type: 'internal.text' });
      await Message.create({ tenantId, messageId: generateMessageId(), dialogId: dialogId1, senderId: userId, content: 'Test', type: 'internal.text' });

      const result = await recalculateUserStats(tenantId, userId);

      expect(result.dialogCount).toBe(2);
      expect(result.unreadDialogsCount).toBe(2);
      expect(result.totalUnreadCount).toBe(5);
      expect(result.totalMessagesCount).toBe(3);

      const stats = await UserStats.findOne({ tenantId, userId });
      expect(stats.dialogCount).toBe(2);
      expect(stats.unreadDialogsCount).toBe(2);
      expect(stats.totalUnreadCount).toBe(5);
      expect(stats.totalMessagesCount).toBe(3);
    });
  });

  describe('getCounterHistory', () => {
    test('should return counter history', async () => {
      const dialogId = generateDialogId();
      const userId = 'user1';
      const messageId = generateMessageId();
      const eventId = generateEventId();

      await updateUnreadCount(tenantId, userId, dialogId, 1, 'message.create', eventId, messageId, 'sender1', 'user');

      const history = await getCounterHistory(tenantId, {
        counterType: 'userDialogStats.unreadCount',
        limit: 10
      });

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].counterType).toBe('userDialogStats.unreadCount');
      expect(history[0].entityId).toBe(`${dialogId}:${userId}`);
    });
  });

  describe('finalizeCounterUpdateContext', () => {
    test('should create user.stats.update when context has updates', async () => {
      const userId = 'user1';
      const dialogId = generateDialogId();
      const messageId = generateMessageId();
      const eventId = generateEventId();

      // Создаем пользователя для избежания ошибок в createUserStatsUpdate
      await User.create({
        tenantId,
        userId,
        type: 'user'
      });

      // Обновляем счетчики (это создаст контекст)
      await updateUnreadCount(tenantId, userId, dialogId, 1, 'message.create', eventId, messageId, 'sender1', 'user');
      await updateUserStatsTotalMessagesCount(tenantId, userId, 1, 'message.create', eventId, messageId, userId, 'user');

      // Финализируем контекст
      await finalizeCounterUpdateContext(tenantId, userId, eventId);

      // Проверяем, что счетчики обновились корректно
      const userStats = await UserStats.findOne({ tenantId, userId });
      expect(userStats).toBeDefined();
      expect(userStats.unreadDialogsCount).toBe(1);
      expect(userStats.totalUnreadCount).toBe(1);
      expect(userStats.totalMessagesCount).toBe(1);
    });
  });
});

