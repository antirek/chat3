import connectDB from '../config/database.js';
import { Tenant, User, Dialog, Message, Meta, DialogMember, 
  MessageStatus, Event, MessageReaction, Update } from '../models/index.js';
import * as reactionUtils from '../utils/reactionUtils.js';
import { generateTimestamp } from '../utils/timestampUtils.js';

async function seed() {
  try {
    await connectDB();

    console.log('🌱 Starting database seeding...\n');

    // Clear existing data
    await Tenant.deleteMany({});
    await User.deleteMany({});
    await Dialog.deleteMany({});
    await Message.deleteMany({});
    await Meta.deleteMany({});
    await DialogMember.deleteMany({});
    await MessageStatus.deleteMany({});
    await MessageReaction.deleteMany({});
    await Event.deleteMany({});
    await Update.deleteMany({});

    console.log('✅ Cleared existing data');

    // Create Default Tenant (используется когда X-TENANT-ID не указан)
    const defaultTenant = await Tenant.create({
      tenantId: 'tnt_default',
      name: 'Default Tenant',
      domain: 'default.chat3.com',
      type: 'client',
      isActive: true,
      settings: {
        isDefault: true,
        maxUsers: 1000,
        features: ['chat', 'video', 'files'],
      },
    });

    console.log(`✅ Created default tenant: ${defaultTenant.name} (${defaultTenant.tenantId})`);

    // Используем только default tenant для всех тестовых данных
    const tenant = defaultTenant;

    // Create Users
    const usersData = [
      { userId: 'carl', name: 'Carl Johnson' },
      { userId: 'marta', name: 'Marta Rodriguez' },
      { userId: 'sara', name: 'Sara Connor' },
      { userId: 'kirk', name: 'Kirk Hammett' },
      { userId: 'john', name: 'John Doe' },
      { userId: 'alice', name: 'Alice Wonder' },
      { userId: 'bob', name: 'Bob Builder' },
      { userId: 'eve', name: 'Eve Anderson' }
    ];

    const users = [];
    for (const userData of usersData) {
      const user = await User.create({
        userId: userData.userId,
        tenantId: tenant.tenantId,
        name: userData.name,
        lastActiveAt: generateTimestamp()
      });
      users.push(user);
    }

    const userIds = users.map(u => u.userId);
    console.log(`✅ Created ${users.length} users: ${userIds.join(', ')}`);

    // Create 100 Dialogs with different meta types and channelTypes
    const dialogNames = {
      internal: [
        'Общий чат', 'Проектные обсуждения', 'Техподдержка', 'HR вопросы', 'Разработка',
        'Маркетинг', 'Внутренние новости', 'Финансы', 'Продажи', 'Аналитика',
        'Дизайн', 'DevOps', 'QA', 'Стратегия', 'Планирование', 'Отчеты',
        'Инфраструктура', 'Безопасность', 'Обучение', 'Инновации'
      ],
      external: [
        'Клиенты', 'Партнеры', 'Внешние консультанты', 'Поставщики', 'Инвесторы',
        'Медиа', 'Подрядчики', 'Агентства', 'Аудиторы', 'Юристы'
      ]
    };

    const channelTypes = ['whatsapp', 'telegram'];
    const dialogs = [];
    
    // Создаем 100 диалогов: 70 internal + 30 external
    for (let i = 0; i < 100; i++) {
      const isInternal = i < 70; // Первые 70 - internal
      const metaType = isInternal ? 'internal' : 'external';
      const channelType = channelTypes[i % 2]; // Чередуем whatsapp и telegram
      
      // Генерируем имя
      const nameBase = isInternal 
        ? dialogNames.internal[i % dialogNames.internal.length]
        : dialogNames.external[(i - 70) % dialogNames.external.length];
      const name = i < 20 ? nameBase : `${nameBase} #${Math.floor(i / 20) + 1}`;
      
      const dialog = await Dialog.create({
        tenantId: tenant.tenantId,
        name,
        createdBy: 'system_bot' // String identifier instead of ObjectId
      });
      
      dialogs.push({ 
        ...dialog.toObject(), 
        metaType,
        channelType 
      });
    }

    console.log(`✅ Created ${dialogs.length} dialogs`);
    console.log(`   - Internal: ${dialogs.filter(d => d.metaType === 'internal').length}`);
    console.log(`   - External: ${dialogs.filter(d => d.metaType === 'external').length}`);
    console.log(`   - WhatsApp: ${dialogs.filter(d => d.channelType === 'whatsapp').length}`);
    console.log(`   - Telegram: ${dialogs.filter(d => d.channelType === 'telegram').length}`);

    // Create Dialog Members
    const dialogMembers = [];

    console.log('\n👥 Creating dialog members...');

    // Для каждого диалога добавляем участников
    dialogs.forEach((dialog, dialogIndex) => {
      // Каждый пользователь участвует в разном количестве диалогов
      const userParticipation = {
        'carl': Math.floor(Math.random() * 20) + 50,   // 50-70 диалогов
        'marta': Math.floor(Math.random() * 15) + 45,  // 45-60 диалогов  
        'sara': Math.floor(Math.random() * 15) + 40,   // 40-55 диалогов
        'kirk': Math.floor(Math.random() * 10) + 35,   // 35-45 диалогов
        'john': Math.floor(Math.random() * 10) + 30,   // 30-40 диалогов
        'alice': Math.floor(Math.random() * 10) + 25,  // 25-35 диалогов
        'bob': Math.floor(Math.random() * 10) + 20,    // 20-30 диалогов
        'eve': Math.floor(Math.random() * 10) + 15     // 15-25 диалогов
      };

      // Определяем, какие пользователи участвуют в этом диалоге
      const participants = [];
      
      userIds.forEach(userId => {
        // Вероятность участия пользователя в диалоге
        const participationChance = userParticipation[userId] / 100; // 0.3-0.7
        if (Math.random() < participationChance) {
          participants.push(userId);
        }
      });

      // Если никто не участвует, добавляем хотя бы одного
      if (participants.length === 0) {
        participants.push(userIds[Math.floor(Math.random() * userIds.length)]);
      }

      // Создаем DialogMember записи для участников
      participants.forEach(userId => {
        const unreadCount = Math.floor(Math.random() * 5); // 0-4 непрочитанных
        const lastSeenAt = generateTimestamp() - Math.random() * 7 * 24 * 60 * 60 * 1000; // Последние 7 дней
        const lastMessageAt = generateTimestamp() - Math.random() * 3 * 24 * 60 * 60 * 1000; // Последние 3 дня

        dialogMembers.push({
          userId,
          tenantId: tenant.tenantId,
          dialogId: dialog.dialogId,
          unreadCount,
          lastSeenAt,
          lastMessageAt,
          isActive: true
        });
      });
    });

    // Создаем DialogMember записи батчами
    const batchSize = 100;
    const savedDialogMembers = [];
    for (let i = 0; i < dialogMembers.length; i += batchSize) {
      const batch = dialogMembers.slice(i, i + batchSize);
      const savedBatch = await DialogMember.insertMany(batch);
      savedDialogMembers.push(...savedBatch);
    }

    console.log(`✅ Created ${savedDialogMembers.length} dialog members`);
    console.log(`   - Carl: ${savedDialogMembers.filter(m => m.userId === 'carl').length} dialogs`);
    console.log(`   - Marta: ${savedDialogMembers.filter(m => m.userId === 'marta').length} dialogs`);
    console.log(`   - Sara: ${savedDialogMembers.filter(m => m.userId === 'sara').length} dialogs`);
    console.log(`   - Kirk: ${savedDialogMembers.filter(m => m.userId === 'kirk').length} dialogs`);
    console.log(`   - John: ${savedDialogMembers.filter(m => m.userId === 'john').length} dialogs`);

    // Create meta tags for DialogMembers
    console.log('\n🏷️  Creating DialogMember meta tags...');
    const dialogMemberMetaEntries = [];
    const roles = ['admin', 'member', 'moderator'];
    
    savedDialogMembers.forEach((member, index) => {
      // entityId для DialogMember meta = dialogId:userId (составной ключ)
      const memberId = `${member.dialogId}:${member.userId}`;
      
      // Role: случайная роль, но чаще 'member'
      const roleWeights = [0.1, 0.8, 0.1]; // 10% admin, 80% member, 10% moderator
      const randomRole = Math.random();
      let role;
      if (randomRole < roleWeights[0]) {
        role = 'admin';
      } else if (randomRole < roleWeights[0] + roleWeights[1]) {
        role = 'member';
      } else {
        role = 'moderator';
      }

      dialogMemberMetaEntries.push({
        tenantId: tenant.tenantId,
        entityType: 'dialogMember',
        entityId: memberId, // Используем составной ключ dialogId:userId
        key: 'role',
        value: role,
        dataType: 'string',
        createdBy: member.userId,
      });

      // Muted: 20% участников имеют muted = true
      const isMuted = Math.random() < 0.2;
      dialogMemberMetaEntries.push({
        tenantId: tenant.tenantId,
        entityType: 'dialogMember',
        entityId: memberId, // Используем составной ключ dialogId:userId
        key: 'muted',
        value: isMuted,
        dataType: 'boolean',
        createdBy: member.userId,
      });

      // notifySound: 80% участников имеют notifySound = true
      const notifySound = Math.random() < 0.8;
      dialogMemberMetaEntries.push({
        tenantId: tenant.tenantId,
        entityType: 'dialogMember',
        entityId: memberId, // Используем составной ключ dialogId:userId
        key: 'notifySound',
        value: notifySound,
        dataType: 'boolean',
        createdBy: member.userId,
      });
    });

    // Создаем мета теги батчами
    const metaBatchSize = 200;
    for (let i = 0; i < dialogMemberMetaEntries.length; i += metaBatchSize) {
      const batch = dialogMemberMetaEntries.slice(i, i + metaBatchSize);
      await Meta.insertMany(batch);
    }

    console.log(`✅ Created ${dialogMemberMetaEntries.length} DialogMember meta entries`);
    console.log(`   - Total DialogMembers: ${savedDialogMembers.length}`);
    console.log(`   - Meta entries per DialogMember: 3 (role, muted, notifySound)`);
    console.log(`   - Role distribution:`);
    const roleCounts = dialogMemberMetaEntries
      .filter(m => m.key === 'role')
      .reduce((acc, m) => {
        acc[m.value] = (acc[m.value] || 0) + 1;
        return acc;
      }, {});
    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`     - ${role}: ${count}`);
    });
    console.log(`   - Muted: ${dialogMemberMetaEntries.filter(m => m.key === 'muted' && m.value === true).length} members`);
    console.log(`   - NotifySound enabled: ${dialogMemberMetaEntries.filter(m => m.key === 'notifySound' && m.value === true).length} members`);

    // Create Messages for all dialogs
    const messageTemplates = [
      'Привет всем!',
      'Как дела?',
      'Что нового?',
      'Отлично!',
      'Спасибо!',
      'Понятно',
      'Согласен',
      'Интересно',
      'Хорошо',
      'Давайте обсудим',
      'Отличная идея!',
      'Мне нравится',
      'Продолжаем',
      'Всё понятно',
      'Готово!',
      'Работаем дальше',
      'Отлично получилось',
      'Спасибо за помощь',
      'Встретимся завтра',
      'До свидания!'
    ];

    const messageTypes = ['internal.text', 'internal.text', 'internal.text', 'internal.text', 'internal.text', 'system.text']; // Больше текстовых сообщений
    const senderIds = ['carl', 'marta', 'sara', 'kirk', 'john']; // Произвольные строки вместо ObjectId
    const allMessages = [];

    // Создаем сообщения для каждого диалога
    dialogs.forEach((dialog, dialogIndex) => {
      // Количество сообщений в диалоге: от 1 до 25 (случайно)
      const messageCount = Math.floor(Math.random() * 25) + 1;
      
      for (let i = 0; i < messageCount; i++) {
        const randomSenderId = senderIds[Math.floor(Math.random() * senderIds.length)];
        const randomTemplate = messageTemplates[Math.floor(Math.random() * messageTemplates.length)];
        const randomType = messageTypes[Math.floor(Math.random() * messageTypes.length)];
        
        // Добавляем номер сообщения для разнообразия
        const messageContent = i === 0 
          ? `Привет! Это первое сообщение в диалоге "${dialog.name}"`
          : `${randomTemplate} (сообщение ${i + 1})`;
        
        allMessages.push({
          tenantId: tenant.tenantId,
          dialogId: dialog.dialogId,
          senderId: randomSenderId, // Используем произвольную строку
          content: messageContent,
          type: randomType,
        });
      }
    });

    // Создаем все сообщения одним запросом
    const messages = await Message.create(allMessages);

    console.log(`✅ Created ${messages.length} messages across ${dialogs.length} dialogs`);
    console.log(`   - Average messages per dialog: ${Math.round(messages.length / dialogs.length)}`);
    console.log(`   - Messages range: 1-25 per dialog`);
    console.log(`   - Sender IDs: carl, marta, sara, kirk, john (произвольные строки)`);

    // Create Message Statuses
    console.log('\n📊 Creating message statuses...');
    const messageStatuses = [];
    const statusTypes = ['sent', 'delivered', 'read'];
    const statusUserIds = ['carl', 'marta', 'sara', 'kirk', 'john'];

    // Создаем статусы для 60% сообщений (случайно выбранных)
    const messagesWithStatuses = messages.filter(() => Math.random() < 0.6);
    
    messagesWithStatuses.forEach((message, messageIndex) => {
      // Для каждого сообщения создаем статусы для 2-4 случайных пользователей
      const statusCount = Math.floor(Math.random() * 3) + 2; // 2-4 статуса
      const selectedUsers = statusUserIds
        .sort(() => Math.random() - 0.5)
        .slice(0, statusCount);

      selectedUsers.forEach((userId, userIndex) => {
        // Время создания статуса - от времени сообщения до текущего времени
        const messageTime = message.createdAt; // Уже Number с микросекундами
        const now = generateTimestamp();
        const randomOffset = Math.random() * (now - messageTime);
        const statusTime = messageTime + randomOffset; // Timestamp с микросекундами
        
        // Статус зависит от порядка пользователя (первый - sent, второй - delivered, остальные - read)
        let status;
        if (userIndex === 0) {
          status = 'sent';
        } else if (userIndex === 1) {
          status = Math.random() < 0.7 ? 'delivered' : 'sent'; // 70% delivered, 30% sent
        } else {
          status = Math.random() < 0.8 ? 'read' : 'delivered'; // 80% read, 20% delivered
        }

        messageStatuses.push({
          messageId: message.messageId,
          userId,
          tenantId: tenant.tenantId,
          status,
          createdAt: statusTime, // С микросекундами
          updatedAt: statusTime  // С микросекундами
        });
      });
    });

    // Создаем статусы батчами
    const statusBatchSize = 200;
    for (let i = 0; i < messageStatuses.length; i += statusBatchSize) {
      const batch = messageStatuses.slice(i, i + statusBatchSize);
      await MessageStatus.insertMany(batch);
    }

    console.log(`✅ Created ${messageStatuses.length} message statuses`);
    console.log(`   - Messages with statuses: ${messagesWithStatuses.length} out of ${messages.length}`);
    console.log(`   - Average statuses per message: ${Math.round(messageStatuses.length / messagesWithStatuses.length)}`);
    console.log(`   - Status distribution:`);
    console.log(`     - sent: ${messageStatuses.filter(s => s.status === 'sent').length}`);
    console.log(`     - delivered: ${messageStatuses.filter(s => s.status === 'delivered').length}`);
    console.log(`     - read: ${messageStatuses.filter(s => s.status === 'read').length}`);

    // Create Meta
    const metaEntries = [
      // System bot meta (now using string identifier)
      {
        tenantId: defaultTenant.tenantId,
        entityType: 'user',
        entityId: 'system_bot',
        key: 'isBot',
        value: true,
        dataType: 'boolean',
      },
      {
        tenantId: defaultTenant.tenantId,
        entityType: 'user',
        entityId: 'system_bot',
        key: 'botType',
        value: 'system',
        dataType: 'string',
      },
      {
        tenantId: defaultTenant.tenantId,
        entityType: 'user',
        entityId: 'system_bot',
        key: 'capabilities',
        value: ['notifications', 'system_messages', 'auto_reply'],
        dataType: 'array',
      },
      // Demo tenant meta
      {
        tenantId: tenant.tenantId,
        entityType: 'tenant',
        entityId: tenant.tenantId,
        key: 'plan',
        value: 'premium',
        dataType: 'string',
      },
      {
        tenantId: tenant.tenantId,
        entityType: 'user',
        entityId: 'carl',
        key: 'theme',
        value: 'dark',
        dataType: 'string',
        createdBy: 'carl',
      },
      {
        tenantId: tenant.tenantId,
        entityType: 'user',
        entityId: 'marta',
        key: 'theme',
        value: 'light',
        dataType: 'string',
        createdBy: 'marta',
      },
      {
        tenantId: tenant.tenantId,
        entityType: 'user',
        entityId: 'sara',
        key: 'theme',
        value: 'auto',
        dataType: 'string',
        createdBy: 'sara',
      },
      {
        tenantId: tenant.tenantId,
        entityType: 'user',
        entityId: 'kirk',
        key: 'theme',
        value: 'dark',
        dataType: 'string',
        createdBy: 'kirk',
      },
      {
        tenantId: tenant.tenantId,
        entityType: 'user',
        entityId: 'john',
        key: 'theme',
        value: 'light',
        dataType: 'string',
        createdBy: 'john',
      },
      // Meta tags for alice, bob, eve
      {
        tenantId: tenant.tenantId,
        entityType: 'user',
        entityId: 'alice',
        key: 'theme',
        value: 'dark',
        dataType: 'string',
        createdBy: 'alice',
      },
      {
        tenantId: tenant.tenantId,
        entityType: 'user',
        entityId: 'alice',
        key: 'email',
        value: 'alice@example.com',
        dataType: 'string',
        createdBy: 'alice',
      },
      {
        tenantId: tenant.tenantId,
        entityType: 'user',
        entityId: 'alice',
        key: 'department',
        value: 'Engineering',
        dataType: 'string',
        createdBy: 'alice',
      },
      {
        tenantId: tenant.tenantId,
        entityType: 'user',
        entityId: 'bob',
        key: 'theme',
        value: 'light',
        dataType: 'string',
        createdBy: 'bob',
      },
      {
        tenantId: tenant.tenantId,
        entityType: 'user',
        entityId: 'bob',
        key: 'email',
        value: 'bob@example.com',
        dataType: 'string',
        createdBy: 'bob',
      },
      {
        tenantId: tenant.tenantId,
        entityType: 'user',
        entityId: 'bob',
        key: 'department',
        value: 'Sales',
        dataType: 'string',
        createdBy: 'bob',
      },
      {
        tenantId: tenant.tenantId,
        entityType: 'user',
        entityId: 'eve',
        key: 'theme',
        value: 'auto',
        dataType: 'string',
        createdBy: 'eve',
      },
      {
        tenantId: tenant.tenantId,
        entityType: 'user',
        entityId: 'eve',
        key: 'email',
        value: 'eve@example.com',
        dataType: 'string',
        createdBy: 'eve',
      },
      {
        tenantId: tenant.tenantId,
        entityType: 'user',
        entityId: 'eve',
        key: 'department',
        value: 'Marketing',
        dataType: 'string',
        createdBy: 'eve',
      },
    ];

    // Add meta for each dialog
    dialogs.forEach((dialog, index) => {
      // Meta type (internal/external)
      metaEntries.push({
        tenantId: tenant.tenantId,
        entityType: 'dialog',
        entityId: dialog.dialogId,
        key: 'type',
        value: dialog.metaType,
        dataType: 'string',
      });

      // Channel type (whatsapp/telegram)
      metaEntries.push({
        tenantId: tenant.tenantId,
        entityType: 'dialog',
        entityId: dialog.dialogId,
        key: 'channelType',
        value: dialog.channelType,
        dataType: 'string',
      });

      // Welcome message
      metaEntries.push({
        tenantId: tenant.tenantId,
        entityType: 'dialog',
        entityId: dialog.dialogId,
        key: 'welcomeMessage',
        value: `Добро пожаловать в "${dialog.name}"!`,
        dataType: 'string',
      });

      // Max participants
      metaEntries.push({
        tenantId: tenant.tenantId,
        entityType: 'dialog',
        entityId: dialog.dialogId,
        key: 'maxParticipants',
        value: dialog.metaType === 'internal' ? 50 : 10,
        dataType: 'number',
      });

      // Features based on type
      const features = dialog.metaType === 'internal' 
        ? ['file_sharing', 'voice_calls', 'video_calls', 'screen_sharing']
        : ['file_sharing', 'voice_calls'];
      
      metaEntries.push({
        tenantId: tenant.tenantId,
        entityType: 'dialog',
        entityId: dialog.dialogId,
        key: 'features',
        value: features,
        dataType: 'array',
      });

      // Security level
      metaEntries.push({
        tenantId: tenant.tenantId,
        entityType: 'dialog',
        entityId: dialog.dialogId,
        key: 'securityLevel',
        value: dialog.metaType === 'internal' ? 'high' : 'medium',
        dataType: 'string',
      });

    });

    // Add meta for messages
    messages.forEach((message, index) => {
      // Определяем channelType и channelId на основе индекса сообщения
      const channelType = index % 2 === 0 ? 'whatsapp' : 'telegram';
      const channelId = channelType === 'whatsapp' ? 'W0000' : 'TG0000';
      
      // Channel type
      metaEntries.push({
        tenantId: tenant.tenantId,
        entityType: 'message',
        entityId: message.messageId,
        key: 'channelType',
        value: channelType,
        dataType: 'string',
      });

      // Channel ID
      metaEntries.push({
        tenantId: tenant.tenantId,
        entityType: 'message',
        entityId: message.messageId,
        key: 'channelId',
        value: channelId,
        dataType: 'string',
      });
    });

    const meta = await Meta.create(metaEntries);

    console.log(`✅ Created ${meta.length} meta entries`);
    console.log(`   - Bot metadata: 3`);
    console.log(`   - Tenant metadata: 1`);
    console.log(`   - User metadata: 14 (themes + email/department for alice, bob, eve)`);
    console.log(`   - Dialog metadata: ${dialogs.length * 6} (6 per dialog: type, channelType, welcomeMessage, maxParticipants, features, securityLevel)`);
    console.log(`   - Message metadata: ${messages.length * 2} (2 per message: channelType, channelId)`);
    console.log(`   - DialogMember metadata: ${dialogMemberMetaEntries.length} (3 per member: role, muted, notifySound)`);

    // Create Message Reactions
    console.log('\n👍 Creating message reactions...');
    const reactions = ['👍', '❤️', '😂', '😮', '😢', '🔥', '💯', '✨', '🎉', '👏'];
    const reactionUserIds = ['carl', 'marta', 'sara', 'kirk', 'john'];
    const allReactions = [];

    // Для каждого сообщения генерируем реакции
    messages.forEach((message, messageIndex) => {
      // Количество реакций на сообщение: от 0 до 8 (случайно)
      // 70% сообщений имеют реакции
      const hasReactions = Math.random() < 0.7;
      if (!hasReactions) return;

      const reactionCount = Math.floor(Math.random() * 9); // 0-8 реакций
      
      // Выбираем случайных пользователей для реакций (без повторений)
      const availableUsers = [...reactionUserIds];
      const selectedUsers = availableUsers
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(reactionCount, availableUsers.length));

      selectedUsers.forEach((userId, userIndex) => {
        // Время реакции - от времени сообщения до текущего времени
        const messageTime = message.createdAt; // Уже Number с микросекундами
        const now = generateTimestamp();
        const randomOffset = Math.random() * (now - messageTime);
        const reactionTime = messageTime + randomOffset; // Timestamp с микросекундами
        
        // Выбираем случайную реакцию
        const reaction = reactions[Math.floor(Math.random() * reactions.length)];

        allReactions.push({
          tenantId: tenant.tenantId,
          messageId: message.messageId,
          userId: userId,
          reaction: reaction,
          createdAt: reactionTime, // С микросекундами
          updatedAt: reactionTime  // С микросекундами
        });
      });
    });

    // Создаем реакции батчами
    const reactionBatchSize = 200;
    for (let i = 0; i < allReactions.length; i += reactionBatchSize) {
      const batch = allReactions.slice(i, i + reactionBatchSize);
      await MessageReaction.insertMany(batch);
    }

    console.log(`✅ Created ${allReactions.length} message reactions`);
    
    // Подсчитываем статистику по реакциям
    const reactionsByType = {};
    allReactions.forEach(r => {
      reactionsByType[r.reaction] = (reactionsByType[r.reaction] || 0) + 1;
    });

    console.log(`   - Messages with reactions: ${messages.filter((m, i) => {
      const messageReactions = allReactions.filter(r => r.messageId.toString() === m._id.toString());
      return messageReactions.length > 0;
    }).length} out of ${messages.length}`);
    console.log(`   - Average reactions per message: ${allReactions.length > 0 ? Math.round(allReactions.length / messages.filter((m, i) => {
      const messageReactions = allReactions.filter(r => r.messageId.toString() === m._id.toString());
      return messageReactions.length > 0;
    }).length * 10) / 10 : 0}`);
    console.log(`   - Reaction distribution:`);
    Object.entries(reactionsByType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reaction, count]) => {
        console.log(`     - ${reaction}: ${count}`);
      });

    // Обновляем счетчики реакций в Message.reactionCounts
    console.log('\n🔄 Updating reaction counts in messages...');
    const messagesWithReactions = [...new Set(allReactions.map(r => r.messageId))];
    let updatedCount = 0;
    
    for (const messageId of messagesWithReactions) {
      try {
        await reactionUtils.updateReactionCounts(tenant.tenantId, messageId);
        updatedCount++;
      } catch (error) {
        console.error(`Error updating reaction counts for message ${messageId}:`, error.message);
      }
    }

    console.log(`✅ Updated reaction counts for ${updatedCount} messages`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Tenants: ${await Tenant.countDocuments()} (1 default tenant: ${tenant.tenantId})`);
    console.log(`   - Users: String identifiers (carl, marta, sara, kirk, john)`);
    console.log(`   - Dialogs: ${await Dialog.countDocuments()} (70 internal + 30 external = 100 total)`);
    console.log(`   - Messages: ${await Message.countDocuments()} (${messages.length} total across ${dialogs.length} dialogs)`);
    console.log(`   - Message Statuses: ${await MessageStatus.countDocuments()} (${messageStatuses.length} total)`);
    console.log(`   - Message Reactions: ${await MessageReaction.countDocuments()} (${allReactions.length} total)`);
    console.log(`   - Meta: ${await Meta.countDocuments()} (5 system/tenant + ${dialogs.length * 6} dialog + ${messages.length * 2} message + ${dialogMemberMetaEntries.length} dialogMember)`);
    console.log('\n🤖 System Bot:');
    console.log(`   - Identifier: system_bot`);
    console.log(`   - Tenant: ${tenant.name} (${tenant.tenantId})`);
    console.log(`   - Capabilities: notifications, system_messages, auto_reply`);
    console.log('\n💬 Dialogs breakdown:');
    console.log(`   - By type: 70 internal + 30 external = 100 total`);
    console.log(`   - By channel: 50 WhatsApp + 50 Telegram = 100 total`);
    console.log('\n📱 Test filters:');
    console.log(`   - GET /api/dialogs?filter={"meta":{"type":"internal"}} → 70 dialogs`);
    console.log(`   - GET /api/dialogs?filter={"meta":{"type":"external"}} → 30 dialogs`);
    console.log(`   - GET /api/dialogs?filter={"meta":{"channelType":"whatsapp"}} → 50 dialogs`);
    console.log(`   - GET /api/dialogs?filter={"meta":{"channelType":"telegram"}} → 50 dialogs`);
    console.log(`   - GET /api/dialogs?filter={"meta":{"type":"internal","channelType":"whatsapp"}} → 35 dialogs`);
    console.log('\n👥 Dialog Members:');
    console.log(`   - DialogMember records: ${await DialogMember.countDocuments()} (participants stored in DialogMember model)`);
    console.log(`   - Use /api/users/{userId}/dialogs to get user's dialogs`);
    console.log(`   - Use /api/dialogs/{dialogId}/members to get dialog participants`);
    console.log('\n💬 Message filters:');
    console.log(`   - GET /api/messages?filter=(meta.channelType,eq,whatsapp) → сообщения из WhatsApp`);
    console.log(`   - GET /api/messages?filter=(meta.channelType,eq,telegram) → сообщения из Telegram`);
    console.log(`   - GET /api/messages?filter=(meta.channelId,eq,W0000) → сообщения с ID W0000`);
    console.log(`   - GET /api/messages?filter=(meta.channelId,eq,TG0000) → сообщения с ID TG0000`);
    console.log('\n📊 Message Statuses:');
    console.log(`   - ${messageStatuses.length} total statuses created`);
    console.log(`   - ${messagesWithStatuses.length} messages have statuses (60% of all messages)`);
    console.log(`   - Status distribution: sent, delivered, read`);
    console.log(`   - Each message has 2-4 statuses from different users`);
    console.log(`   - Use /api/messages/{messageId} to see messageStatuses array`);
    console.log('\n👍 Message Reactions:');
    console.log(`   - ${allReactions.length} total reactions created`);
    console.log(`   - ${messages.filter((m, i) => {
      const messageReactions = allReactions.filter(r => r.messageId.toString() === m._id.toString());
      return messageReactions.length > 0;
    }).length} messages have reactions (70% of all messages)`);
    console.log(`   - Reaction types: ${reactions.join(', ')}`);
    console.log(`   - Each message has 0-8 reactions from different users`);
    console.log(`   - Use /api/messages/{messageId}/reactions to see reactions`);
    console.log(`   - Reaction counts are cached in Message.reactionCounts`);
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();

