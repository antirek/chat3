import * as fakeAmqp from '@onify/fake-amqplib';
import {
  createDialogUpdate,
  createDialogMemberUpdate,
  createMessageUpdate,
  createUserStatsUpdate
} from '../../../../utils/updateUtils.js';
import { Dialog, DialogMember, Meta, Message, MessageStatus, User, Event, Update } from "../../../../models/index.js";
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from './setup.js';
import { generateTimestamp } from '../../../../utils/timestampUtils.js';

// Мокируем amqplib перед импортом updateUtils
let updateUtils;
let originalConsoleLog;
let originalConsoleWarn;
let originalConsoleError;

beforeAll(async () => {
  // Подавляем логирование для чистоты тестов
  originalConsoleLog = console.log;
  originalConsoleWarn = console.warn;
  originalConsoleError = console.error;
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  
  // Переопределяем amqplib.connect для rabbitmqUtils
  const amqplib = await import('amqplib');
  amqplib.default.connect = fakeAmqp.connect;
  
  // Импортируем updateUtils (который использует rabbitmqUtils)
  updateUtils = await import('../../../../utils/updateUtils.js');
  
  // Настраиваем MongoDB
  await setupMongoMemoryServer();
});

afterAll(async () => {
  // Восстанавливаем логирование
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  
  await teardownMongoMemoryServer();
});

describe('updateUtils - Integration Tests with MongoDB and Fake RabbitMQ', () => {
  const tenantId = 'tnt_test';

  beforeEach(async () => {
    await clearDatabase();
    fakeAmqp.resetMock();
    
    // Инициализируем RabbitMQ перед каждым тестом
    // (updateUtils использует rabbitmqUtils.publishUpdate, который требует подключения)
    const rabbitmqUtils = await import('../../../../utils/rabbitmqUtils.js');
    await rabbitmqUtils.initRabbitMQ();
  });
  
  afterEach(async () => {
    // Закрываем RabbitMQ после каждого теста
    const rabbitmqUtils = await import('../../../../utils/rabbitmqUtils.js');
    await rabbitmqUtils.closeRabbitMQ();
    fakeAmqp.resetMock();
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

  // eventId в Update модели - это ObjectId, а не строка
  // Создаем Event объект, чтобы получить правильный ObjectId
  async function createEventAndGetId(eventType = 'dialog.create', eventData = {}) {
    const event = await Event.create({
      tenantId,
      eventType,
      entityType: 'dialog',
      entityId: generateDialogId(),
      actorId: 'user1',
      data: eventData
    });
    return event._id; // Возвращаем ObjectId
  }

  // Создает событие с правильной структурой данных, включая секцию dialog
  async function createEventWithDialog(eventType, dialogId, additionalData = {}) {
    const dialog = await Dialog.findOne({ dialogId, tenantId }).lean();
    if (!dialog) {
      throw new Error(`Dialog ${dialogId} not found`);
    }
    
    const dialogMeta = await Meta.find({ tenantId, entityType: 'dialog', entityId: dialogId }).lean();
    const dialogMetaObj = dialogMeta.reduce((acc, m) => {
      acc[m.key] = m.value;
      return acc;
    }, {});

    const baseEventData = {
      context: {
        version: 2,
        eventType,
        dialogId: dialog.dialogId,
        entityId: dialog.dialogId,
        includedSections: ['dialog'],
        updatedFields: []
      },
      dialog: {
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdBy: dialog.createdBy,
        createdAt: dialog.createdAt,
        meta: dialogMetaObj
      }
    };

    // Объединяем базовые данные с дополнительными, приоритет у additionalData
    const eventData = {
      ...baseEventData,
      ...additionalData,
      context: {
        ...baseEventData.context,
        ...(additionalData.context || {})
      },
      dialog: {
        ...baseEventData.dialog,
        ...(additionalData.dialog || {})
      }
    };

    const event = await Event.create({
      tenantId,
      eventType,
      entityType: 'dialog',
      entityId: dialogId,
      actorId: 'user1',
      data: eventData
    });
    return { eventId: event._id, eventData };
  }

  describe('createDialogUpdate', () => {
    test('should create updates for all dialog members', async () => {
      const dialogId = generateDialogId();

      // Создаем диалог
      await Dialog.create({
        tenantId,
        dialogId,
        
        createdBy: 'user1'
      });

      // Создаем участников
      await DialogMember.create([
        {
          tenantId,
          dialogId,
          userId: 'user1',
          unreadCount: 0,
          isActive: true
        },
        {
          tenantId,
          dialogId,
          userId: 'user2',
          unreadCount: 0,
          isActive: true
        }
      ]);

      const { eventId, eventData } = await createEventWithDialog('dialog.create', dialogId, {
        context: {
          version: 2,
          eventType: 'dialog.create',
          dialogId,
          entityId: dialogId,
          messageId: null,
          includedSections: ['dialog'],
          updatedFields: ['dialog']
        }
      });

      await updateUtils.createDialogUpdate(tenantId, dialogId, eventId, 'dialog.create', eventData);

      // Проверяем, что updates созданы для каждого участника
      const updates = await Update.find({ tenantId, entityId: dialogId, eventId });
      expect(updates.length).toBe(2);
      expect(updates.map(u => u.userId)).toContain('user1');
      expect(updates.map(u => u.userId)).toContain('user2');
    });

    test('should not create updates if dialog does not exist', async () => {
      const dialogId = generateDialogId();
      const eventId = await createEventAndGetId('dialog.create');

      await updateUtils.createDialogUpdate(tenantId, dialogId, eventId, 'dialog.create');

      const updates = await Update.find({ tenantId, entityId: dialogId });
      expect(updates.length).toBe(0);
    });

    test('should not create updates if no active members', async () => {
      const dialogId = generateDialogId();
      const eventId = await createEventAndGetId('dialog.create');

      await Dialog.create({
        tenantId,
        dialogId,
        
        createdBy: 'user1'
      });

      await updateUtils.createDialogUpdate(tenantId, dialogId, eventId, 'dialog.create');

      const updates = await Update.find({ tenantId, entityId: dialogId });
      expect(updates.length).toBe(0);
    });

    test('should include dialog meta in update data', async () => {
      const dialogId = generateDialogId();

      await Dialog.create({
        tenantId,
        dialogId,
        
        createdBy: 'user1'
      });

      await DialogMember.create({
        tenantId,
        dialogId,
        userId: 'user1',
        unreadCount: 0,
        isActive: true
      });

      // Добавляем мета-теги диалогу (через Meta модель)
      const { Meta } = await import("../../../../models/index.js");
      await Meta.create({
        tenantId,
        entityType: 'dialog',
        entityId: dialogId,
        key: 'channel',
        value: 'telegram',
        dataType: 'string'
      });

      const { eventId, eventData } = await createEventWithDialog('dialog.create', dialogId, {
        context: {
          version: 2,
          eventType: 'dialog.create',
          dialogId,
          entityId: dialogId,
          messageId: null,
          includedSections: ['dialog'],
          updatedFields: ['dialog']
        }
      });

      await updateUtils.createDialogUpdate(tenantId, dialogId, eventId, 'dialog.create', eventData);

      const update = await Update.findOne({ tenantId, entityId: dialogId, userId: 'user1' }).lean();
      expect(update).toBeDefined();
      expect(update.data.dialog).toBeDefined();
      expect(update.data.dialog.meta).toHaveProperty('channel');
      expect(update.data.dialog.meta.channel).toBe('telegram');
      // Для dialog.create member секция не должна быть в update, если её нет в event.data
      expect(update.data.member).toBeUndefined();
    });

    test('should create update for removed member in dialog.member.remove event', async () => {
      const dialogId = generateDialogId();

      await Dialog.create({
        tenantId,
        dialogId,
        
        createdBy: 'user1'
      });

      // Создаем участников
      const member1 = await DialogMember.create({
        tenantId,
        dialogId,
        userId: 'user1',
        unreadCount: 5,
        isActive: true
      });

      const member2 = await DialogMember.create({
        tenantId,
        dialogId,
        userId: 'user2',
        unreadCount: 3,
        isActive: true
      });

      // Удаляем user2 из диалога (устанавливаем isActive: false)
      await DialogMember.updateOne(
        { tenantId, dialogId, userId: 'user2' },
        { isActive: false }
      );

      const { eventId, eventData } = await createEventWithDialog('dialog.member.remove', dialogId, {
        context: {
          version: 2,
          eventType: 'dialog.member.remove',
          dialogId,
          entityId: dialogId,
          messageId: null,
          includedSections: ['dialog', 'member'],
          updatedFields: ['member']
        },
        member: {
          userId: 'user2',
          state: {
            unreadCount: 3,
            lastSeenAt: member2.lastSeenAt,
            lastMessageAt: member2.lastMessageAt,
            isActive: false
          }
        }
      });

      await updateUtils.createDialogUpdate(tenantId, dialogId, eventId, 'dialog.member.remove', eventData);

      // Проверяем, что updates созданы для всех участников, включая удаляемого
      const updates = await Update.find({ tenantId, entityId: dialogId, eventId });
      expect(updates.length).toBe(2); // user1 (активный) + user2 (удаляемый)
      
      const userIds = updates.map(u => u.userId);
      expect(userIds).toContain('user1');
      expect(userIds).toContain('user2');

      // Проверяем, что для удаляемого пользователя isActive: false
      const removedUserUpdate = updates.find(u => u.userId === 'user2');
      expect(removedUserUpdate).toBeDefined();
      expect(removedUserUpdate.data.member.state.isActive).toBe(false);
    });
  });

  describe('createDialogMemberUpdate', () => {
    test('should create update for specific member', async () => {
      const dialogId = generateDialogId();
      const userId = 'user1';

      await Dialog.create({
        tenantId,
        dialogId,
        
        createdBy: userId
      });

      await DialogMember.create({
        tenantId,
        dialogId,
        userId,
        unreadCount: 5,
        isActive: true
      });

      const { eventId, eventData } = await createEventWithDialog('dialog.member.update', dialogId, {
        context: {
          version: 2,
          eventType: 'dialog.member.update',
          dialogId,
          entityId: dialogId,
          messageId: null,
          includedSections: ['dialog', 'member'],
          updatedFields: ['member.state.unreadCount']
        },
        member: {
          userId,
          state: {
            unreadCount: 3,
            lastSeenAt: null,
            lastMessageAt: null,
            isActive: true
          }
        }
      });

      await updateUtils.createDialogMemberUpdate(
        tenantId,
        dialogId,
        userId,
        eventId,
        'dialog.member.update',
        eventData
      );

      const updates = await Update.find({
        tenantId,
        entityId: dialogId,
        userId,
        eventId
      });

      expect(updates.length).toBe(1);
      expect(updates[0].data.member).toBeDefined();
      expect(updates[0].data.member.state.unreadCount).toBe(3);
    });

    test('should not create update if member does not exist', async () => {
      const dialogId = generateDialogId();
      const userId = 'user1';
      const eventId = await createEventAndGetId('dialog.member.update');

      await Dialog.create({
        tenantId,
        dialogId,
        
        createdBy: userId
      });

      await updateUtils.createDialogMemberUpdate(
        tenantId,
        dialogId,
        userId,
        eventId,
        'dialog.member.update'
      );

      const updates = await Update.find({ tenantId, entityId: dialogId, userId });
      expect(updates.length).toBe(0);
    });
  });

  describe('createMessageUpdate', () => {
    test('should create update for message', async () => {
      const dialogId = generateDialogId();
      const messageId = generateMessageId();

      await Dialog.create({
        tenantId,
        dialogId,
        
        createdBy: 'user1'
      });

      await Message.create({
        tenantId,
        messageId,
        dialogId,
        senderId: 'user1',
        content: 'Test message',
        type: 'internal.text'
      });

      await DialogMember.create([
        {
          tenantId,
          dialogId,
          userId: 'user1',
          unreadCount: 0,
          isActive: true
        },
        {
          tenantId,
          dialogId,
          userId: 'user2',
          unreadCount: 0,
          isActive: true
        }
      ]);

      const { eventId, eventData } = await createEventWithDialog('message.create', dialogId, {
        context: {
          version: 2,
          eventType: 'message.create',
          dialogId,
          entityId: messageId,
          messageId,
          includedSections: ['dialog', 'message'],
          updatedFields: ['message']
        },
        message: {
          messageId,
          dialogId,
          senderId: 'user1',
          type: 'internal.text',
          content: 'Test message',
          meta: {}
        }
      });

      await updateUtils.createMessageUpdate(
        tenantId,
        dialogId,
        messageId,
        eventId,
        'message.create',
        eventData
      );

      // Проверяем, что updates созданы для всех участников
      const updates = await Update.find({ tenantId, entityId: messageId, eventId });
      expect(updates.length).toBe(2);
    });

    test('should include message data in update', async () => {
      const dialogId = generateDialogId();
      const messageId = generateMessageId();

      await Dialog.create({
        tenantId,
        dialogId,
        
        createdBy: 'user1'
      });

      await Message.create({
        tenantId,
        messageId,
        dialogId,
        senderId: 'user1',
        content: 'Test message',
        type: 'internal.text'
      });

      await User.create({
        tenantId,
        userId: 'user1'
      });

      await Meta.create({
        tenantId,
        entityType: 'user',
        entityId: 'user1',
        key: 'role',
        value: 'support',
        dataType: 'string'
      });

      await DialogMember.create({
        tenantId,
        dialogId,
        userId: 'user1',
        unreadCount: 0,
        isActive: true
      });

      const { eventId, eventData } = await createEventWithDialog('message.create', dialogId, {
        context: {
          version: 2,
          eventType: 'message.create',
          dialogId,
          entityId: messageId,
          messageId,
          includedSections: ['dialog', 'message'],
          updatedFields: ['message']
        }
        // Не передаем message, чтобы createMessageUpdate загрузил его из БД и добавил senderInfo
      });

      await updateUtils.createMessageUpdate(
        tenantId,
        dialogId,
        messageId,
        eventId,
        'message.create',
        eventData
      );

      const update = await Update.findOne({ tenantId, entityId: messageId, userId: 'user1' }).lean();
      expect(update).toBeDefined();
      expect(update.data).toBeDefined();
      expect(update.data.message).toBeDefined();
      expect(update.data.message.content).toBe('Test message');
      expect(update.data.message.meta || {}).toEqual({});
      expect(update.data.message.senderInfo).toEqual(
        expect.objectContaining({
          userId: 'user1',
          meta: expect.objectContaining({ role: 'support' })
        })
      );
    });

    test('should include status update in message data', async () => {
      const dialogId = generateDialogId();
      const messageId = generateMessageId();

      await Dialog.create({
        tenantId,
        dialogId,
        
        createdBy: 'user1'
      });

      await Message.create({
        tenantId,
        messageId,
        dialogId,
        senderId: 'user1',
        content: 'Test message',
        type: 'internal.text'
      });

      await DialogMember.create({
        tenantId,
        dialogId,
        userId: 'user1',
        unreadCount: 0,
        isActive: true
      });

      const { eventId, eventData } = await createEventWithDialog('message.status.update', dialogId, {
        context: {
          version: 2,
          eventType: 'message.status.update',
          dialogId,
          entityId: messageId,
          messageId,
          includedSections: ['dialog', 'message'],
          updatedFields: ['message.status']
        },
        message: {
          messageId,
          dialogId,
          senderId: 'user1',
          type: 'internal.text',
          content: 'Test message',
          statusUpdate: {
            userId: 'user2',
            status: 'read',
            oldStatus: 'unread'
          },
          statusMessageMatrix: [],
          meta: {}
        }
      });

      await updateUtils.createMessageUpdate(
        tenantId,
        dialogId,
        messageId,
        eventId,
        'message.status.update',
        eventData
      );

      // Даем время на асинхронную публикацию
      await new Promise(resolve => setTimeout(resolve, 100));

      // Проверяем, что updates созданы
      const allUpdates = await Update.find({ tenantId, entityId: messageId }).lean();
      expect(allUpdates.length).toBeGreaterThan(0);
      
      const update = await Update.findOne({ tenantId, entityId: messageId, userId: 'user1' }).lean();
      expect(update).toBeDefined();
      expect(update).not.toBeNull();
      
      // Проверяем структуру данных
      // В update.data должны быть поля сообщения + statusUpdate
      // Для message.status.update member секция не включается
      expect(update.data).toBeDefined();
      expect(update.data.message).toBeDefined();
      expect(update.data.message.messageId || update.data.message._id).toBeDefined();
      expect(update.data.message.statusUpdate).toBeDefined();
      expect(update.data.message.statusUpdate.userId).toBe('user2');
      expect(update.data.message.statusUpdate.status).toBe('read');
      // Проверяем наличие statusMessageMatrix в update
      expect(update.data.message.statusMessageMatrix).toBeDefined();
      expect(Array.isArray(update.data.message.statusMessageMatrix)).toBe(true);
      // member секция убрана для message.status.update
      expect(update.data.member).toBeUndefined();
    });

    test('should include reaction update in message data', async () => {
      const dialogId = generateDialogId();
      const messageId = generateMessageId();

      await Dialog.create({
        tenantId,
        dialogId,
        
        createdBy: 'user1'
      });

      await Message.create({
        tenantId,
        messageId,
        dialogId,
        senderId: 'user1',
        content: 'Test message',
        type: 'internal.text'
      });

      await DialogMember.create({
        tenantId,
        dialogId,
        userId: 'user1',
        unreadCount: 0,
        isActive: true
      });

      const { eventId, eventData } = await createEventWithDialog('message.reaction.update', dialogId, {
        context: {
          version: 2,
          eventType: 'message.reaction.update',
          dialogId,
          entityId: messageId,
          messageId,
          includedSections: ['dialog', 'message'],
          updatedFields: ['message.reaction']
        },
        message: {
          messageId,
          dialogId,
          senderId: 'user1',
          type: 'internal.text',
          content: 'Test message',
          reactionUpdate: {
            userId: 'user2',
            reaction: '👍',
            oldReaction: null
          },
          reactionSet: null,
          meta: {}
        }
      });

      await updateUtils.createMessageUpdate(
        tenantId,
        dialogId,
        messageId,
        eventId,
        'message.reaction.update',
        eventData
      );

      // Даем время на асинхронную публикацию
      await new Promise(resolve => setTimeout(resolve, 100));

      // Проверяем, что updates созданы
      const allUpdates = await Update.find({ tenantId, entityId: messageId }).lean();
      expect(allUpdates.length).toBeGreaterThan(0);
      
      const update = await Update.findOne({ tenantId, entityId: messageId, userId: 'user1' }).lean();
      expect(update).toBeDefined();
      expect(update).not.toBeNull();
      
      // Проверяем структуру данных
      // Для message.reaction.update member секция не включается
      expect(update.data).toBeDefined();
      expect(update.data.message).toBeDefined();
      expect(update.data.message.reactionUpdate).toBeDefined();
      expect(update.data.message.reactionUpdate.userId).toBe('user2');
      expect(update.data.message.reactionUpdate.reaction).toBe('👍');
      expect(update.data.message.reactionUpdate.oldReaction).toBeNull();
      // member секция убрана для message.reaction.update
      expect(update.data.member).toBeUndefined();
    });
  });

  describe('createTypingUpdate', () => {
    test('should create typing update for other participants', async () => {
      const dialogId = generateDialogId();

      await Dialog.create({
        tenantId,
        dialogId,
        
        createdBy: 'user1'
      });

      await DialogMember.create([
        {
          tenantId,
          dialogId,
          userId: 'user1',
          unreadCount: 0,
          isActive: true
        },
        {
          tenantId,
          dialogId,
          userId: 'user2',
          unreadCount: 0,
          isActive: true
        }
      ]);

      const { eventId, eventData } = await createEventWithDialog('dialog.typing', dialogId, {
        context: {
          version: 2,
          eventType: 'dialog.typing',
          dialogId,
          entityId: dialogId,
          messageId: null,
          includedSections: ['dialog', 'typing'],
          updatedFields: ['typing']
        },
        typing: {
          dialogId,
          userId: 'user1',
          expiresInMs: 4000,
          timestamp: 1700000000000
        }
      });

      await updateUtils.createTypingUpdate(
        tenantId,
        dialogId,
        'user1',
        eventId,
        'dialog.typing',
        eventData
      );

      const updates = await Update.find({ tenantId, entityId: dialogId, eventId });
      expect(updates.length).toBe(1);
      expect(updates[0].userId).toBe('user2');
      expect(updates[0].data.typing).toBeDefined();
      expect(updates[0].data.typing.userId).toBe('user1');
      expect(updates[0].data.typing.expiresInMs).toBe(4000);
      expect(updates[0].data.typing.timestamp).toBe(1700000000000);
    });

    test('should skip typing update when no other members', async () => {
      const dialogId = generateDialogId();

      await Dialog.create({
        tenantId,
        dialogId,
        
        createdBy: 'user1'
      });

      await DialogMember.create({
        tenantId,
        dialogId,
        userId: 'user1',
        unreadCount: 0,
        isActive: true
      });

      const { eventId, eventData } = await createEventWithDialog('dialog.typing', dialogId, {
        context: {
          version: 2,
          eventType: 'dialog.typing',
          dialogId,
          entityId: dialogId,
          messageId: null,
          includedSections: ['dialog', 'typing'],
          updatedFields: ['typing']
        },
        typing: {
          dialogId,
          userId: 'user1'
        }
      });

      await updateUtils.createTypingUpdate(
        tenantId,
        dialogId,
        'user1',
        eventId,
        'dialog.typing',
        eventData
      );

      const updates = await Update.find({ tenantId, entityId: dialogId, eventId });
      expect(updates.length).toBe(0);
    });
  });

  describe('createUserStatsUpdate', () => {
    test('should create UserStatsUpdate with correct stats', async () => {
      const dialogId = generateDialogId();
      const userId = 'user1';

      await User.create({
        tenantId,
        userId,
        type: 'user',
        createdAt: generateTimestamp()
      });

      await Dialog.create({
        tenantId,
        dialogId,
        createdBy: userId
      });

      // Создаем два диалога для пользователя
      await DialogMember.create([
        {
          tenantId,
          dialogId,
          userId,
          unreadCount: 1, // Непрочитанный диалог
          isActive: true
        },
        {
          tenantId,
          dialogId: generateDialogId(),
          userId,
          unreadCount: 0, // Прочитанный диалог
          isActive: true
        }
      ]);

      const eventId = await createEventAndGetId('message.create');

      await updateUtils.createUserStatsUpdate(
        tenantId,
        userId,
        eventId,
        'message.create',
        ['user.stats.unreadDialogsCount']
      );

      const updates = await Update.find({
        tenantId,
        userId,
        eventType: 'user.stats.update'
      }).lean();

      expect(updates.length).toBe(1);
      expect(updates[0].data.user).toBeDefined();
      expect(updates[0].data.user.userId).toBe(userId);
      expect(updates[0].data.user.stats).toBeDefined();
      expect(updates[0].data.user.stats.dialogCount).toBe(2);
      expect(updates[0].data.user.stats.unreadDialogsCount).toBe(1);
      expect(updates[0].data.context.updatedFields).toContain('user.stats.unreadDialogsCount');
    });

    test('should create UserStatsUpdate with dialogCount when user is added to dialog', async () => {
      const dialogId = generateDialogId();
      const userId = 'user1';

      await User.create({
        tenantId,
        userId,
        type: 'user',
        createdAt: generateTimestamp()
      });

      await Dialog.create({
        tenantId,
        dialogId,
        createdBy: 'other_user'
      });

      // Создаем один диалог для пользователя
      await DialogMember.create({
        tenantId,
        dialogId,
        userId,
        unreadCount: 0,
        isActive: true
      });

      const eventId = await createEventAndGetId('dialog.member.add');

      await updateUtils.createUserStatsUpdate(
        tenantId,
        userId,
        eventId,
        'dialog.member.add',
        ['user.stats.dialogCount']
      );

      const updates = await Update.find({
        tenantId,
        userId,
        eventType: 'user.stats.update'
      }).lean();

      expect(updates.length).toBe(1);
      expect(updates[0].data.user.stats.dialogCount).toBe(1);
      expect(updates[0].data.context.updatedFields).toContain('user.stats.dialogCount');
    });

    test('should include user type and meta in UserStatsUpdate', async () => {
      const userId = 'user1';

      await User.create({
        tenantId,
        userId,
        type: 'bot',
        createdAt: generateTimestamp()
      });

      await Meta.create({
        tenantId,
        entityType: 'user',
        entityId: userId,
        key: 'name',
        value: 'Test Bot',
        dataType: 'string'
      });

      const eventId = await createEventAndGetId('message.create');

      await updateUtils.createUserStatsUpdate(
        tenantId,
        userId,
        eventId,
        'message.create',
        ['user.stats.unreadDialogsCount']
      );

      const updates = await Update.find({
        tenantId,
        userId,
        eventType: 'user.stats.update'
      }).lean();

      expect(updates.length).toBe(1);
      expect(updates[0].data.user.type).toBe('bot');
      expect(updates[0].data.user.meta).toBeDefined();
      expect(updates[0].data.user.meta.name).toBe('Test Bot');
    });

    test('should create UserStatsUpdate when processing message.create event (dialog becomes unread)', async () => {
      const dialogId = generateDialogId();
      const senderId = 'sender';
      const recipientId = 'recipient';

      await User.create([
        {
          tenantId,
          userId: senderId,
          type: 'user',
          createdAt: generateTimestamp()
        },
        {
          tenantId,
          userId: recipientId,
          type: 'user',
          createdAt: generateTimestamp()
        }
      ]);

      await Dialog.create({
        tenantId,
        dialogId,
        createdBy: senderId
      });

      // Создаем DialogMember для получателя с unreadCount = 0 (диалог прочитан)
      await DialogMember.create({
        tenantId,
        dialogId,
        userId: recipientId,
        unreadCount: 0,
        isActive: true
      });

      const messageId = generateMessageId();
      const eventId = await createEventAndGetId('message.create', {
        context: {
          version: 2,
          eventType: 'message.create',
          dialogId,
          entityId: messageId,
          messageId,
          includedSections: ['dialog', 'message']
        },
        dialog: {
          dialogId,
          tenantId,
          createdBy: senderId,
          createdAt: generateTimestamp(),
          meta: {}
        },
        message: {
          messageId,
          dialogId,
          senderId,
          type: 'internal.text',
          content: 'Test message',
          meta: {}
        }
      });

      // Симулируем обработку события message.create в update-worker
      // Сначала создаем сообщение и обновляем unreadCount
      await Message.create({
        tenantId,
        dialogId,
        messageId,
        senderId,
        type: 'internal.text',
        content: 'Test message',
        createdAt: generateTimestamp()
      });

      // Обновляем unreadCount для получателя (симулируем создание сообщения)
      await DialogMember.updateOne(
        { tenantId, dialogId, userId: recipientId },
        { $inc: { unreadCount: 1 } }
      );

      // Создаем UserStatsUpdate (как это делает update-worker)
      await updateUtils.createUserStatsUpdate(
        tenantId,
        recipientId,
        eventId,
        'message.create',
        ['user.stats.unreadDialogsCount']
      );

      const updates = await Update.find({
        tenantId,
        userId: recipientId,
        eventType: 'user.stats.update'
      }).lean();

      expect(updates.length).toBe(1);
      expect(updates[0].data.user.stats.unreadDialogsCount).toBe(1);
    });

    test('should create UserStatsUpdate for all recipients when processing message.create event (multiple recipients)', async () => {
      const dialogId = generateDialogId();
      const senderId = 'sender';
      const recipient1Id = 'recipient1';
      const recipient2Id = 'recipient2';
      const recipient3Id = 'recipient3';

      await User.create([
        {
          tenantId,
          userId: senderId,
          type: 'user',
          createdAt: generateTimestamp()
        },
        {
          tenantId,
          userId: recipient1Id,
          type: 'user',
          createdAt: generateTimestamp()
        },
        {
          tenantId,
          userId: recipient2Id,
          type: 'user',
          createdAt: generateTimestamp()
        },
        {
          tenantId,
          userId: recipient3Id,
          type: 'user',
          createdAt: generateTimestamp()
        }
      ]);

      await Dialog.create({
        tenantId,
        dialogId,
        createdBy: senderId
      });

      // Создаем DialogMember для всех получателей с unreadCount = 0 (диалог прочитан)
      await DialogMember.create([
        {
          tenantId,
          dialogId,
          userId: recipient1Id,
          unreadCount: 0,
          isActive: true
        },
        {
          tenantId,
          dialogId,
          userId: recipient2Id,
          unreadCount: 0,
          isActive: true
        },
        {
          tenantId,
          dialogId,
          userId: recipient3Id,
          unreadCount: 0,
          isActive: true
        }
      ]);

      const messageId = generateMessageId();
      const eventId = await createEventAndGetId('message.create', {
        context: {
          version: 2,
          eventType: 'message.create',
          dialogId,
          entityId: messageId,
          messageId,
          includedSections: ['dialog', 'message']
        },
        dialog: {
          dialogId,
          tenantId,
          createdBy: senderId,
          createdAt: generateTimestamp(),
          meta: {}
        },
        message: {
          messageId,
          dialogId,
          senderId,
          type: 'internal.text',
          content: 'Test message',
          meta: {}
        }
      });

      // Симулируем обработку события message.create в update-worker
      // Сначала создаем сообщение
      await Message.create({
        tenantId,
        dialogId,
        messageId,
        senderId,
        type: 'internal.text',
        content: 'Test message',
        createdAt: generateTimestamp()
      });

      // Обновляем unreadCount для всех получателей (симулируем создание сообщения)
      // recipient1 и recipient2: диалог стал непрочитанным (unreadCount = 1)
      // recipient3: диалог остался прочитанным (unreadCount = 0, не обновляем)
      await DialogMember.updateOne(
        { tenantId, dialogId, userId: recipient1Id },
        { $inc: { unreadCount: 1 } }
      );
      await DialogMember.updateOne(
        { tenantId, dialogId, userId: recipient2Id },
        { $inc: { unreadCount: 1 } }
      );

      // Симулируем логику из update-worker: получаем всех участников и создаем UserStatsUpdate для тех, у кого unreadCount = 1
      const members = await DialogMember.find({
        tenantId,
        dialogId,
        isActive: true
      }).lean();

      for (const member of members) {
        if (member.userId !== senderId) {
          const unreadCount = member.unreadCount ?? 0;
          // Если unreadCount = 1 (только что созданное сообщение), значит диалог стал непрочитанным
          if (unreadCount === 1) {
            await updateUtils.createUserStatsUpdate(
              tenantId,
              member.userId,
              eventId,
              'message.create',
              ['user.stats.unreadDialogsCount']
            );
          }
        }
      }

      // Проверяем, что UserStatsUpdate создан только для recipient1 и recipient2
      const updates1 = await Update.find({
        tenantId,
        userId: recipient1Id,
        eventType: 'user.stats.update'
      }).lean();
      const updates2 = await Update.find({
        tenantId,
        userId: recipient2Id,
        eventType: 'user.stats.update'
      }).lean();
      const updates3 = await Update.find({
        tenantId,
        userId: recipient3Id,
        eventType: 'user.stats.update'
      }).lean();

      expect(updates1.length).toBe(1);
      expect(updates1[0].data.user.stats.unreadDialogsCount).toBe(1);
      expect(updates2.length).toBe(1);
      expect(updates2[0].data.user.stats.unreadDialogsCount).toBe(1);
      expect(updates3.length).toBe(0); // recipient3 не должен получить UserStatsUpdate, т.к. unreadCount = 0
    });

    test('should create UserStatsUpdate when processing dialog.member.add event', async () => {
      const dialogId = generateDialogId();
      const userId = 'new_member';

      await User.create({
        tenantId,
        userId,
        type: 'user',
        createdAt: generateTimestamp()
      });

      await Dialog.create({
        tenantId,
        dialogId,
        createdBy: 'creator'
      });

      const eventId = await createEventAndGetId('dialog.member.add', {
        context: {
          version: 2,
          eventType: 'dialog.member.add',
          dialogId,
          entityId: dialogId,
          includedSections: ['dialog', 'member']
        },
        dialog: {
          dialogId,
          tenantId,
          createdBy: 'creator',
          createdAt: generateTimestamp(),
          meta: {}
        },
        member: {
          userId,
          state: {
            unreadCount: 0,
            isActive: true
          }
        }
      });

      // Создаем DialogMember (симулируем добавление участника)
      await DialogMember.create({
        tenantId,
        dialogId,
        userId,
        unreadCount: 0,
        isActive: true
      });

      // Создаем UserStatsUpdate (как это делает update-worker)
      await updateUtils.createUserStatsUpdate(
        tenantId,
        userId,
        eventId,
        'dialog.member.add',
        ['user.stats.dialogCount']
      );

      const updates = await Update.find({
        tenantId,
        userId,
        eventType: 'user.stats.update'
      }).lean();

      expect(updates.length).toBe(1);
      expect(updates[0].data.user.stats.dialogCount).toBe(1);
      expect(updates[0].data.context.updatedFields).toContain('user.stats.dialogCount');
    });

    test('should create UserStatsUpdate when processing dialog.member.remove event (dialogCount decreased)', async () => {
      const dialogId = generateDialogId();
      const userId = 'member_to_remove';

      await User.create({
        tenantId,
        userId,
        type: 'user',
        createdAt: generateTimestamp()
      });

      await Dialog.create({
        tenantId,
        dialogId,
        createdBy: 'creator'
      });

      // Создаем два диалога для пользователя
      await DialogMember.create([
        {
          tenantId,
          dialogId,
          userId,
          unreadCount: 0,
          isActive: true
        },
        {
          tenantId,
          dialogId: generateDialogId(),
          userId,
          unreadCount: 0,
          isActive: true
        }
      ]);

      const eventId = await createEventAndGetId('dialog.member.remove', {
        context: {
          version: 2,
          eventType: 'dialog.member.remove',
          dialogId,
          entityId: dialogId,
          includedSections: ['dialog', 'member']
        },
        dialog: {
          dialogId,
          tenantId,
          createdBy: 'creator',
          createdAt: generateTimestamp(),
          meta: {}
        },
        member: {
          userId,
          state: {
            unreadCount: 0,
            isActive: false
          }
        }
      });

      // Удаляем DialogMember (симулируем удаление участника)
      await DialogMember.deleteOne({
        tenantId,
        dialogId,
        userId
      });

      // Создаем UserStatsUpdate (как это делает update-worker)
      await updateUtils.createUserStatsUpdate(
        tenantId,
        userId,
        eventId,
        'dialog.member.remove',
        ['user.stats.dialogCount']
      );

      const updates = await Update.find({
        tenantId,
        userId,
        eventType: 'user.stats.update'
      }).lean();

      expect(updates.length).toBe(1);
      expect(updates[0].data.user.stats.dialogCount).toBe(1); // Остался один диалог
      expect(updates[0].data.context.updatedFields).toContain('user.stats.dialogCount');
    });

    test('should create UserStatsUpdate when processing message.status.update event (dialog becomes read)', async () => {
      const dialogId = generateDialogId();
      const userId = 'reader';
      const senderId = 'sender';

      await User.create([
        {
          tenantId,
          userId,
          type: 'user',
          createdAt: generateTimestamp()
        },
        {
          tenantId,
          userId: senderId,
          type: 'user',
          createdAt: generateTimestamp()
        }
      ]);

      await Dialog.create({
        tenantId,
        dialogId,
        createdBy: senderId
      });

      const messageId = generateMessageId();
      await Message.create({
        tenantId,
        dialogId,
        messageId,
        senderId,
        type: 'internal.text',
        content: 'Test message',
        createdAt: generateTimestamp()
      });

      // Создаем DialogMember с unreadCount = 1 (диалог непрочитан)
      await DialogMember.create({
        tenantId,
        dialogId,
        userId,
        unreadCount: 1,
        isActive: true
      });

      // Создаем MessageStatus с unread
      await MessageStatus.create({
        tenantId,
        messageId,
        userId,
        status: 'unread',
        createdAt: generateTimestamp()
      });

      const eventId = await createEventAndGetId('message.status.update', {
        context: {
          version: 2,
          eventType: 'message.status.update',
          dialogId,
          entityId: messageId,
          messageId,
          includedSections: ['dialog', 'message'],
          updatedFields: ['message.status']
        },
        dialog: {
          dialogId,
          tenantId,
          createdBy: senderId,
          createdAt: generateTimestamp(),
          meta: {}
        },
        message: {
          messageId,
          dialogId,
          senderId,
          type: 'internal.text',
          content: 'Test message',
          meta: {},
          statusUpdate: {
            userId,
            status: 'read',
            oldStatus: 'unread'
          }
        }
      });

      // Обновляем MessageStatus на read (симулируем чтение сообщения)
      await MessageStatus.findOneAndUpdate(
        { tenantId, messageId, userId },
        { status: 'read' },
        { new: true }
      );

      // Обновляем unreadCount до 0 (диалог стал прочитанным)
      await DialogMember.updateOne(
        { tenantId, dialogId, userId },
        { $set: { unreadCount: 0 } }
      );

      // Создаем UserStatsUpdate (как это делает update-worker)
      await updateUtils.createUserStatsUpdate(
        tenantId,
        userId,
        eventId,
        'message.status.update',
        ['user.stats.unreadDialogsCount']
      );

      const updates = await Update.find({
        tenantId,
        userId,
        eventType: 'user.stats.update'
      }).lean();

      expect(updates.length).toBe(1);
      expect(updates[0].data.user.stats.unreadDialogsCount).toBe(0); // Диалог стал прочитанным
      expect(updates[0].data.context.updatedFields).toContain('user.stats.unreadDialogsCount');
    });
  });
});

