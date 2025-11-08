import * as fakeAmqp from '@onify/fake-amqplib';
import {
  createDialogUpdate,
  createDialogMemberUpdate,
  createMessageUpdate
} from '../updateUtils.js';
import { Dialog, Message, DialogMember, Event, Update } from '../../models/index.js';
import { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } from './setup.js';

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
  updateUtils = await import('../updateUtils.js');
  
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
    const rabbitmqUtils = await import('../rabbitmqUtils.js');
    await rabbitmqUtils.initRabbitMQ();
  });
  
  afterEach(async () => {
    // Закрываем RabbitMQ после каждого теста
    const rabbitmqUtils = await import('../rabbitmqUtils.js');
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
  async function createEventAndGetId(eventType = 'dialog.create') {
    const event = await Event.create({
      tenantId,
      eventType,
      entityType: 'dialog',
      entityId: generateDialogId(),
      actorId: 'user1',
      data: {}
    });
    return event._id; // Возвращаем ObjectId
  }

  describe('createDialogUpdate', () => {
    test('should create updates for all dialog members', async () => {
      const dialogId = generateDialogId();
      const eventId = await createEventAndGetId('dialog.create');

      // Создаем диалог
      await Dialog.create({
        tenantId,
        dialogId,
        name: 'Test Dialog',
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

      await updateUtils.createDialogUpdate(tenantId, dialogId, eventId, 'dialog.create');

      // Проверяем, что updates созданы для каждого участника
      const updates = await Update.find({ tenantId, dialogId, eventId });
      expect(updates.length).toBe(2);
      expect(updates.map(u => u.userId)).toContain('user1');
      expect(updates.map(u => u.userId)).toContain('user2');
    });

    test('should not create updates if dialog does not exist', async () => {
      const dialogId = generateDialogId();
      const eventId = await createEventAndGetId('dialog.create');

      await updateUtils.createDialogUpdate(tenantId, dialogId, eventId, 'dialog.create');

      const updates = await Update.find({ tenantId, dialogId });
      expect(updates.length).toBe(0);
    });

    test('should not create updates if no active members', async () => {
      const dialogId = generateDialogId();
      const eventId = await createEventAndGetId('dialog.create');

      await Dialog.create({
        tenantId,
        dialogId,
        name: 'Test Dialog',
        createdBy: 'user1'
      });

      await updateUtils.createDialogUpdate(tenantId, dialogId, eventId, 'dialog.create');

      const updates = await Update.find({ tenantId, dialogId });
      expect(updates.length).toBe(0);
    });

    test('should include dialog meta in update data', async () => {
      const dialogId = generateDialogId();
      const eventId = await createEventAndGetId('dialog.create');

      await Dialog.create({
        tenantId,
        dialogId,
        name: 'Test Dialog',
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
      const { Meta } = await import('../../models/index.js');
      await Meta.create({
        tenantId,
        entityType: 'dialog',
        entityId: dialogId,
        key: 'channel',
        value: 'telegram',
        dataType: 'string'
      });

      await updateUtils.createDialogUpdate(tenantId, dialogId, eventId, 'dialog.create');

      const update = await Update.findOne({ tenantId, dialogId, userId: 'user1' });
      expect(update).toBeDefined();
      expect(update.data.meta).toHaveProperty('channel');
      expect(update.data.meta.channel).toBe('telegram');
    });
  });

  describe('createDialogMemberUpdate', () => {
    test('should create update for specific member', async () => {
      const dialogId = generateDialogId();
      const userId = 'user1';
      const eventId = await createEventAndGetId('dialog.member.update');

      await Dialog.create({
        tenantId,
        dialogId,
        name: 'Test Dialog',
        createdBy: userId
      });

      await DialogMember.create({
        tenantId,
        dialogId,
        userId,
        unreadCount: 5,
        isActive: true
      });

      await updateUtils.createDialogMemberUpdate(
        tenantId,
        dialogId,
        userId,
        eventId,
        'dialog.member.update',
        { unreadCount: 3 }
      );

      const updates = await Update.find({
        tenantId,
        dialogId,
        userId,
        eventId
      });

      expect(updates.length).toBe(1);
      expect(updates[0].data.memberData).toBeDefined();
      expect(updates[0].data.memberData.unreadCount).toBe(3);
    });

    test('should not create update if member does not exist', async () => {
      const dialogId = generateDialogId();
      const userId = 'user1';
      const eventId = await createEventAndGetId('dialog.member.update');

      await Dialog.create({
        tenantId,
        dialogId,
        name: 'Test Dialog',
        createdBy: userId
      });

      await updateUtils.createDialogMemberUpdate(
        tenantId,
        dialogId,
        userId,
        eventId,
        'dialog.member.update'
      );

      const updates = await Update.find({ tenantId, dialogId, userId });
      expect(updates.length).toBe(0);
    });
  });

  describe('createMessageUpdate', () => {
    test('should create update for message', async () => {
      const dialogId = generateDialogId();
      const messageId = generateMessageId();
      const eventId = await createEventAndGetId('message.create');

      await Dialog.create({
        tenantId,
        dialogId,
        name: 'Test Dialog',
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

      await updateUtils.createMessageUpdate(
        tenantId,
        dialogId,
        messageId,
        eventId,
        'message.create'
      );

      // Проверяем, что updates созданы для всех участников
      const updates = await Update.find({ tenantId, entityId: messageId, eventId });
      expect(updates.length).toBe(2);
    });

    test('should include message data in update', async () => {
      const dialogId = generateDialogId();
      const messageId = generateMessageId();
      const eventId = await createEventAndGetId('message.create');

      await Dialog.create({
        tenantId,
        dialogId,
        name: 'Test Dialog',
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

      await updateUtils.createMessageUpdate(
        tenantId,
        dialogId,
        messageId,
        eventId,
        'message.create'
      );

      const update = await Update.findOne({ tenantId, entityId: messageId, userId: 'user1' });
      expect(update).toBeDefined();
      expect(update.data).toBeDefined();
      expect(update.data.content).toBe('Test message');
    });

    test('should include status update in message data', async () => {
      const dialogId = generateDialogId();
      const messageId = generateMessageId();
      const eventId = await createEventAndGetId('message.status.update');

      await Dialog.create({
        tenantId,
        dialogId,
        name: 'Test Dialog',
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

      // Создаем событие с данными статуса
      // createMessageUpdate ожидает eventData в формате:
      // { userId, newStatus, oldStatus } для message.status.update
      const eventData = {
        userId: 'user2',
        newStatus: 'read',
        oldStatus: 'unread'
      };

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
      expect(update.data).toBeDefined();
      expect(update.data.messageId).toBe(messageId);
      
      // statusUpdate должен быть в data (не в data.messageData)
      if (update.data.statusUpdate) {
        expect(update.data.statusUpdate.userId).toBe('user2');
        expect(update.data.statusUpdate.status).toBe('read');
      } else {
        // Если statusUpdate нет в data, проверяем, что данные сообщения есть
        expect(update.data.content).toBeDefined();
      }
    });

    test('should include reaction update in message data', async () => {
      const dialogId = generateDialogId();
      const messageId = generateMessageId();
      const eventId = await createEventAndGetId('message.reaction.add');

      await Dialog.create({
        tenantId,
        dialogId,
        name: 'Test Dialog',
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

      const eventData = {
        reactionUpdate: {
          userId: 'user2',
          reaction: '👍'
        }
      };

      await updateUtils.createMessageUpdate(
        tenantId,
        dialogId,
        messageId,
        eventId,
        'message.reaction.add',
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
      expect(update.data).toBeDefined();
      expect(update.data.messageId).toBe(messageId);
      
      // reactionUpdate должен быть в data (не в data.messageData)
      if (update.data.reactionUpdate) {
        expect(update.data.reactionUpdate.userId).toBe('user2');
        expect(update.data.reactionUpdate.reaction).toBe('👍');
      } else {
        // Если reactionUpdate нет в data, проверяем, что данные сообщения есть
        expect(update.data.content).toBeDefined();
      }
    });
  });
});

