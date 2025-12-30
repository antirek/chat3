import connectDB from '../config/database.js';
import { Tenant, User, Dialog, Message, Meta, DialogMember, 
  MessageStatus, Event, MessageReaction, Update,
  UserStats, UserDialogStats, UserDialogActivity,
  MessageReactionStats, MessageStatusStats, CounterHistory,
  Topic, DialogStats } from '../models/index.js';
import { generateTimestamp } from '../utils/timestampUtils.js';
import { recalculateUserStats, updateDialogStats } from '../utils/counterUtils.js';
import { generateTopicId } from '../utils/topicUtils.js';

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
    // Очищаем новые коллекции счетчиков и активности
    await UserStats.deleteMany({});
    await UserDialogStats.deleteMany({});
    await UserDialogActivity.deleteMany({});
    await MessageReactionStats.deleteMany({});
    await MessageStatusStats.deleteMany({});
    await CounterHistory.deleteMany({});
    await Topic.deleteMany({});
    await DialogStats.deleteMany({});

    console.log('✅ Cleared existing data');

    // Create Multiple Tenants
    const tenantIds = ['tnt_default', 'tnt_company_a', 'tnt_company_b', 'tnt_company_c', 'tnt_startup'];
    const tenants = [];
    
    for (const tenantId of tenantIds) {
      const tenant = await Tenant.create({ tenantId });
      tenants.push(tenant);
    }

    console.log(`✅ Created ${tenants.length} tenants: ${tenantIds.join(', ')}`);

    // Create Users for each tenant
    const allUsers = [];
    const userTypes = ['user', 'bot', 'contact'];
    
    // Генерируем имена пользователей
    const userNames = [
      'alice', 'bob', 'charlie', 'diana', 'eve', 'frank', 'grace', 'henry',
      'ivy', 'jack', 'kate', 'liam', 'mia', 'noah', 'olivia', 'paul',
      'quinn', 'ruby', 'sam', 'tina', 'uma', 'victor', 'willa', 'xander'
    ];
    
    for (const tenant of tenants) {
      const usersPerTenant = Math.floor(Math.random() * 11) + 10; // 10-20 пользователей
      const tenantUsers = [];
      
      for (let i = 0; i < usersPerTenant; i++) {
        const userId = `${userNames[i % userNames.length]}_${tenant.tenantId.replace('tnt_', '')}`;
        const userType = userTypes[Math.floor(Math.random() * userTypes.length)];
        
        const user = await User.create({
          userId: userId,
          tenantId: tenant.tenantId,
          type: userType
        });
        tenantUsers.push(user);
        allUsers.push(user);
      }
      
      console.log(`✅ Created ${tenantUsers.length} users for ${tenant.tenantId} (${tenantUsers.filter(u => u.type === 'user').length} users, ${tenantUsers.filter(u => u.type === 'bot').length} bots, ${tenantUsers.filter(u => u.type === 'contact').length} contacts)`);
    }
    
    console.log(`✅ Total users created: ${allUsers.length}`);

    // Create Dialogs for each tenant
    const channelTypes = ['whatsapp', 'telegram', 'viber', 'sms'];
    const allDialogs = [];
    
    for (const tenant of tenants) {
      const dialogsPerTenant = Math.floor(Math.random() * 21) + 30; // 30-50 диалогов
      const tenantDialogs = [];
      
      for (let i = 0; i < dialogsPerTenant; i++) {
        const isInternal = Math.random() < 0.6; // 60% internal, 40% external
        const metaType = isInternal ? 'internal' : 'external';
        const channelType = channelTypes[Math.floor(Math.random() * channelTypes.length)];
        
        const dialog = await Dialog.create({
          tenantId: tenant.tenantId,
          createdBy: 'system_bot'
        });
        
        tenantDialogs.push({ 
          ...dialog.toObject(), 
          metaType,
          channelType 
        });
      }
      
      allDialogs.push(...tenantDialogs);
      console.log(`✅ Created ${tenantDialogs.length} dialogs for ${tenant.tenantId}`);
    }

    console.log(`✅ Total dialogs created: ${allDialogs.length}`);
    console.log(`   - Internal: ${allDialogs.filter(d => d.metaType === 'internal').length}`);
    console.log(`   - External: ${allDialogs.filter(d => d.metaType === 'external').length}`);
    const channelCounts = {};
    allDialogs.forEach(d => {
      channelCounts[d.channelType] = (channelCounts[d.channelType] || 0) + 1;
    });
    Object.entries(channelCounts).forEach(([channel, count]) => {
      console.log(`   - ${channel}: ${count}`);
    });

    // Create Dialog Members
    const dialogMembers = [];
    const userDialogStats = [];
    const userDialogActivities = [];

    console.log('\n👥 Creating dialog members...');

    // Группируем пользователей по тенантам
    const usersByTenant = {};
    allUsers.forEach(user => {
      if (!usersByTenant[user.tenantId]) {
        usersByTenant[user.tenantId] = [];
      }
      usersByTenant[user.tenantId].push(user);
    });

    // Для каждого диалога добавляем участников из того же тенанта
    allDialogs.forEach((dialog) => {
      const tenantUsers = usersByTenant[dialog.tenantId] || [];
      if (tenantUsers.length === 0) return;

      // Количество участников в диалоге: 2-8
      const participantCount = Math.floor(Math.random() * 7) + 2;
      const selectedUsers = tenantUsers
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(participantCount, tenantUsers.length));

      // Создаем DialogMember записи для участников (без unreadCount, lastSeenAt, lastMessageAt, isActive)
      selectedUsers.forEach(user => {
        const unreadCount = Math.floor(Math.random() * 10); // 0-9 непрочитанных
        const lastSeenAt = generateTimestamp() - Math.random() * 7 * 24 * 60 * 60 * 1000;
        const lastMessageAt = generateTimestamp() - Math.random() * 3 * 24 * 60 * 60 * 1000;

        // DialogMember - только связь
        dialogMembers.push({
          userId: user.userId,
          tenantId: dialog.tenantId,
          dialogId: dialog.dialogId
        });

        // UserDialogStats - счетчик непрочитанных
        userDialogStats.push({
          tenantId: dialog.tenantId,
          userId: user.userId,
          dialogId: dialog.dialogId,
          unreadCount
        });

        // UserDialogActivity - активность
        userDialogActivities.push({
          tenantId: dialog.tenantId,
          userId: user.userId,
          dialogId: dialog.dialogId,
          lastSeenAt,
          lastMessageAt
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

    // Создаем UserDialogStats записи батчами
    for (let i = 0; i < userDialogStats.length; i += batchSize) {
      const batch = userDialogStats.slice(i, i + batchSize);
      await UserDialogStats.insertMany(batch);
    }

    // Создаем UserDialogActivity записи батчами
    for (let i = 0; i < userDialogActivities.length; i += batchSize) {
      const batch = userDialogActivities.slice(i, i + batchSize);
      await UserDialogActivity.insertMany(batch);
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
    // eslint-disable-next-line no-unused-vars
    const roles = ['admin', 'member', 'moderator'];
    
    savedDialogMembers.forEach((member, _index) => {
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
        tenantId: member.tenantId,
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
        tenantId: member.tenantId,
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
        tenantId: member.tenantId,
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

    // Create Topics for dialogs
    console.log('\n📌 Creating topics for dialogs...');
    const allTopics = [];
    const topicMetaEntries = [];
    const topicNames = ['general', 'support', 'questions', 'announcements', 'random', 'work', 'personal', 'ideas', 'feedback', 'help'];
    const topicCategories = ['general', 'support', 'technical', 'business', 'social', 'other'];
    
    // Создаем топики для 60% диалогов (случайно выбранных)
    const dialogsWithTopics = allDialogs.filter(() => Math.random() < 0.6);
    
    dialogsWithTopics.forEach((dialog) => {
      // Количество топиков в диалоге: 1-5
      const topicCount = Math.floor(Math.random() * 5) + 1;
      
      for (let i = 0; i < topicCount; i++) {
        const topicId = generateTopicId();
        const topicName = topicNames[Math.floor(Math.random() * topicNames.length)];
        const topicCategory = topicCategories[Math.floor(Math.random() * topicCategories.length)];
        
        allTopics.push({
          topicId,
          dialogId: dialog.dialogId,
          tenantId: dialog.tenantId,
          createdAt: generateTimestamp() - Math.random() * 30 * 24 * 60 * 60 * 1000 // Созданы от 0 до 30 дней назад
        });
        
        // Создаем мета-теги для топика
        topicMetaEntries.push({
          tenantId: dialog.tenantId,
          entityType: 'topic',
          entityId: topicId,
          key: 'name',
          value: topicName,
          dataType: 'string',
          createdBy: 'system'
        });
        
        topicMetaEntries.push({
          tenantId: dialog.tenantId,
          entityType: 'topic',
          entityId: topicId,
          key: 'category',
          value: topicCategory,
          dataType: 'string',
          createdBy: 'system'
        });
        
        // 30% топиков имеют дополнительный мета-тег priority
        if (Math.random() < 0.3) {
          const priorities = ['low', 'normal', 'high'];
          topicMetaEntries.push({
            tenantId: dialog.tenantId,
            entityType: 'topic',
            entityId: topicId,
            key: 'priority',
            value: priorities[Math.floor(Math.random() * priorities.length)],
            dataType: 'string',
            createdBy: 'system'
          });
        }
      }
    });
    
    // Создаем топики батчами
    const topicBatchSize = 100;
    const savedTopics = [];
    for (let i = 0; i < allTopics.length; i += topicBatchSize) {
      const batch = allTopics.slice(i, i + topicBatchSize);
      const savedBatch = await Topic.insertMany(batch);
      savedTopics.push(...savedBatch);
    }
    
    console.log(`✅ Created ${savedTopics.length} topics across ${dialogsWithTopics.length} dialogs`);
    console.log(`   - Average topics per dialog: ${(savedTopics.length / dialogsWithTopics.length).toFixed(2)}`);
    console.log(`   - Dialogs with topics: ${dialogsWithTopics.length} out of ${allDialogs.length}`);
    
    // Создаем мета-теги для топиков батчами
    if (topicMetaEntries.length > 0) {
      for (let i = 0; i < topicMetaEntries.length; i += metaBatchSize) {
        const batch = topicMetaEntries.slice(i, i + metaBatchSize);
        await Meta.insertMany(batch);
      }
      console.log(`✅ Created ${topicMetaEntries.length} topic meta entries`);
    }
    
    // Создаем DialogStats для всех диалогов
    console.log('\n📊 Creating DialogStats for dialogs...');
    const dialogStatsEntries = [];
    
    allDialogs.forEach((dialog) => {
      const dialogMembersCount = dialogMembers.filter(m => m.dialogId === dialog.dialogId).length;
      const dialogTopicsCount = savedTopics.filter(t => t.dialogId === dialog.dialogId).length;
      
      dialogStatsEntries.push({
        tenantId: dialog.tenantId,
        dialogId: dialog.dialogId,
        topicCount: dialogTopicsCount,
        memberCount: dialogMembersCount,
        messageCount: 0 // Будет обновлено после создания сообщений
      });
    });
    
    // Создаем DialogStats батчами
    for (let i = 0; i < dialogStatsEntries.length; i += batchSize) {
      const batch = dialogStatsEntries.slice(i, i + batchSize);
      await DialogStats.insertMany(batch);
    }
    
    console.log(`✅ Created ${dialogStatsEntries.length} DialogStats entries`);

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

    // Разные типы сообщений
    const messageTypes = [
      'internal.text', 'internal.text', 'internal.text', 'internal.text', 'internal.text',
      'system.text', 'system.text',
      'system.notification', 'system.join', 'system.leave',
      'user.text', 'user.image', 'user.file'
    ];
    
    const allMessages = [];

    // Создаем сообщения для каждого диалога
    allDialogs.forEach((dialog) => {
      // Количество сообщений в диалоге: от 5 до 50
      const messageCount = Math.floor(Math.random() * 46) + 5;
      
      // Получаем участников диалога для выбора отправителя
      const dialogParticipants = dialogMembers
        .filter(m => m.dialogId === dialog.dialogId)
        .map(m => m.userId);
      
      if (dialogParticipants.length === 0) return;
      
      for (let i = 0; i < messageCount; i++) {
        const randomSenderId = dialogParticipants[Math.floor(Math.random() * dialogParticipants.length)];
        const randomTemplate = messageTemplates[Math.floor(Math.random() * messageTemplates.length)];
        const randomType = messageTypes[Math.floor(Math.random() * messageTypes.length)];
        
        // Для системных сообщений используем специальный контент
        let messageContent;
        if (randomType.startsWith('system.')) {
          if (randomType === 'system.notification') {
            messageContent = `🔔 Уведомление: ${randomTemplate}`;
          } else if (randomType === 'system.join') {
            messageContent = `👋 Пользователь ${randomSenderId} присоединился к диалогу`;
          } else if (randomType === 'system.leave') {
            messageContent = `👋 Пользователь ${randomSenderId} покинул диалог`;
          } else {
            messageContent = `📢 Системное сообщение: ${randomTemplate}`;
          }
        } else if (randomType === 'user.image') {
          messageContent = '📷 [Изображение]';
        } else if (randomType === 'user.file') {
          messageContent = '📎 [Файл]';
        } else {
          messageContent = i === 0 
            ? `Привет! Это первое сообщение в диалоге ${dialog.dialogId.substring(0, 10)}...`
            : `${randomTemplate} (сообщение ${i + 1})`;
        }
        
        // 40% сообщений привязываем к топикам (если в диалоге есть топики)
        const dialogTopics = savedTopics.filter(t => t.dialogId === dialog.dialogId);
        let topicId = null;
        if (dialogTopics.length > 0 && Math.random() < 0.4) {
          const randomTopic = dialogTopics[Math.floor(Math.random() * dialogTopics.length)];
          topicId = randomTopic.topicId;
        }
        
        allMessages.push({
          tenantId: dialog.tenantId,
          dialogId: dialog.dialogId,
          senderId: randomSenderId,
          content: messageContent,
          type: randomType,
          topicId: topicId
        });
      }
    });

    // Создаем все сообщения одним запросом
    const messages = await Message.create(allMessages);

    console.log(`✅ Created ${messages.length} messages across ${allDialogs.length} dialogs`);
    console.log(`   - Average messages per dialog: ${Math.round(messages.length / allDialogs.length)}`);
    console.log(`   - Messages range: 5-50 per dialog`);
    
    // Обновляем messageCount в DialogStats
    console.log('\n📊 Updating DialogStats messageCount...');
    const messageCountsByDialog = {};
    messages.forEach(msg => {
      messageCountsByDialog[msg.dialogId] = (messageCountsByDialog[msg.dialogId] || 0) + 1;
    });
    
    const updatePromises = Object.entries(messageCountsByDialog).map(([dialogId, count]) => 
      updateDialogStats(
        messages.find(m => m.dialogId === dialogId)?.tenantId || allDialogs.find(d => d.dialogId === dialogId)?.tenantId,
        dialogId,
        { messageCount: count }
      )
    );
    await Promise.all(updatePromises);
    
    const messagesWithTopics = messages.filter(m => m.topicId !== null);
    console.log(`   - Messages with topics: ${messagesWithTopics.length} out of ${messages.length} (${Math.round(messagesWithTopics.length / messages.length * 100)}%)`);

    // Create Message Statuses
    console.log('\n📊 Creating message statuses...');
    const messageStatuses = [];
    const _statusTypes = ['sent', 'delivered', 'read', 'unread'];

    // Создаем карту пользователей по tenantId для быстрого доступа
    const userTypeMap = new Map();
    allUsers.forEach(user => {
      userTypeMap.set(`${user.tenantId}:${user.userId}`, user.type || 'user');
    });

    // Создаем статусы для 70% сообщений (случайно выбранных)
    const messagesWithStatuses = messages.filter(() => Math.random() < 0.7);
    
    messagesWithStatuses.forEach((message) => {
      // Получаем участников диалога для этого сообщения
      const dialogParticipants = dialogMembers
        .filter(m => m.dialogId === message.dialogId)
        .map(m => m.userId);
      
      if (dialogParticipants.length === 0) return;
      
      // Для каждого сообщения создаем статусы для 2-6 случайных пользователей
      const statusCount = Math.floor(Math.random() * 5) + 2; // 2-6 статусов
      const selectedUsers = dialogParticipants
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(statusCount, dialogParticipants.length));

      selectedUsers.forEach((userId, userIndex) => {
        // Время создания статуса - от времени сообщения до текущего времени
        const messageTime = message.createdAt;
        const now = generateTimestamp();
        const randomOffset = Math.random() * (now - messageTime);
        const statusTime = messageTime + randomOffset;
        
        // Статус зависит от порядка пользователя
        let status;
        if (userIndex === 0) {
          status = 'sent';
        } else if (userIndex === 1) {
          status = Math.random() < 0.6 ? 'delivered' : 'sent';
        } else if (userIndex === 2) {
          status = Math.random() < 0.5 ? 'read' : 'delivered';
        } else {
          status = Math.random() < 0.7 ? 'read' : (Math.random() < 0.5 ? 'delivered' : 'unread');
        }

        // Получаем тип пользователя из карты
        const userType = userTypeMap.get(`${message.tenantId}:${userId}`) || 'user';

        messageStatuses.push({
          messageId: message.messageId,
          dialogId: message.dialogId, // КРИТИЧНО: Передаем dialogId для избежания поиска Message
          userId,
          userType: userType,
          tenantId: message.tenantId,
          status,
          createdAt: statusTime,
          updatedAt: statusTime
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
    const metaEntries = [];
    
    // System bot meta для каждого тенанта
    tenants.forEach(tenant => {
      metaEntries.push(
        {
          tenantId: tenant.tenantId,
          entityType: 'user',
          entityId: 'system_bot',
          key: 'isBot',
          value: true,
          dataType: 'boolean',
        },
        {
          tenantId: tenant.tenantId,
          entityType: 'user',
          entityId: 'system_bot',
          key: 'botType',
          value: 'system',
          dataType: 'string',
        },
        {
          tenantId: tenant.tenantId,
          entityType: 'user',
          entityId: 'system_bot',
          key: 'capabilities',
          value: ['notifications', 'system_messages', 'auto_reply'],
          dataType: 'array',
        },
        {
          tenantId: tenant.tenantId,
          entityType: 'tenant',
          entityId: tenant.tenantId,
          key: 'plan',
          value: ['premium', 'standard', 'basic'][Math.floor(Math.random() * 3)],
          dataType: 'string',
        }
      );
    });
    // User meta для каждого пользователя
    const themes = ['dark', 'light', 'auto'];
    const departments = ['Engineering', 'Sales', 'Marketing', 'Support', 'HR', 'Finance', 'Operations'];
    
    allUsers.forEach(user => {
      // Theme для каждого пользователя
      metaEntries.push({
        tenantId: user.tenantId,
        entityType: 'user',
        entityId: user.userId,
        key: 'theme',
        value: themes[Math.floor(Math.random() * themes.length)],
        dataType: 'string',
        createdBy: user.userId,
      });
      
      // Email для 50% пользователей
      if (Math.random() < 0.5) {
        metaEntries.push({
          tenantId: user.tenantId,
          entityType: 'user',
          entityId: user.userId,
          key: 'email',
          value: `${user.userId}@example.com`,
          dataType: 'string',
          createdBy: user.userId,
        });
      }
      
      // Department для 40% пользователей
      if (Math.random() < 0.4) {
        metaEntries.push({
          tenantId: user.tenantId,
          entityType: 'user',
          entityId: user.userId,
          key: 'department',
          value: departments[Math.floor(Math.random() * departments.length)],
          dataType: 'string',
          createdBy: user.userId,
        });
      }
    });

    // Add meta for each dialog
    // eslint-disable-next-line no-unused-vars
    allDialogs.forEach((dialog, index) => {
      // Meta type (internal/external)
      metaEntries.push({
        tenantId: dialog.tenantId,
        entityType: 'dialog',
        entityId: dialog.dialogId,
        key: 'type',
        value: dialog.metaType,
        dataType: 'string',
      });

      // Channel type (whatsapp/telegram/viber/sms)
      metaEntries.push({
        tenantId: dialog.tenantId,
        entityType: 'dialog',
        entityId: dialog.dialogId,
        key: 'channelType',
        value: dialog.channelType,
        dataType: 'string',
      });

      // Welcome message
      metaEntries.push({
        tenantId: dialog.tenantId,
        entityType: 'dialog',
        entityId: dialog.dialogId,
        key: 'welcomeMessage',
        value: `Добро пожаловать в диалог ${dialog.dialogId.substring(0, 10)}...!`,
        dataType: 'string',
      });

      // Max participants
      metaEntries.push({
        tenantId: dialog.tenantId,
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
        tenantId: dialog.tenantId,
        entityType: 'dialog',
        entityId: dialog.dialogId,
        key: 'features',
        value: features,
        dataType: 'array',
      });

      // Security level
      metaEntries.push({
        tenantId: dialog.tenantId,
        entityType: 'dialog',
        entityId: dialog.dialogId,
        key: 'securityLevel',
        value: dialog.metaType === 'internal' ? 'high' : 'medium',
        dataType: 'string',
      });

    });

    // Add meta for messages
    messages.forEach((message, index) => {
      // Находим диалог для определения channelType
      const dialog = allDialogs.find(d => d.dialogId === message.dialogId);
      const channelType = dialog?.channelType || (index % 2 === 0 ? 'whatsapp' : 'telegram');
      const channelId = channelType === 'whatsapp' ? `W${String(index % 10000).padStart(4, '0')}` : `TG${String(index % 10000).padStart(4, '0')}`;
      
      // Channel type
      metaEntries.push({
        tenantId: message.tenantId,
        entityType: 'message',
        entityId: message.messageId,
        key: 'channelType',
        value: channelType,
        dataType: 'string',
      });

      // Channel ID
      metaEntries.push({
        tenantId: message.tenantId,
        entityType: 'message',
        entityId: message.messageId,
        key: 'channelId',
        value: channelId,
        dataType: 'string',
      });
    });

    const meta = await Meta.create(metaEntries);

    console.log(`✅ Created ${meta.length} meta entries`);
    console.log(`   - Bot metadata: ${tenants.length * 3} (3 per tenant)`);
    console.log(`   - Tenant metadata: ${tenants.length} (1 per tenant)`);
    console.log(`   - User metadata: ~${Math.round(allUsers.length * 1.4)} (average 1.4 per user: theme, email, department)`);
    console.log(`   - Dialog metadata: ${allDialogs.length * 6} (6 per dialog: type, channelType, welcomeMessage, maxParticipants, features, securityLevel)`);
    console.log(`   - Message metadata: ${messages.length * 2} (2 per message: channelType, channelId)`);
    console.log(`   - DialogMember metadata: ${dialogMemberMetaEntries.length} (3 per member: role, muted, notifySound)`);

    // Create Message Reactions
    console.log('\n👍 Creating message reactions...');
    const reactions = ['👍', '❤️', '😂', '😮', '😢', '🔥', '💯', '✨', '🎉', '👏'];
    const allReactions = [];

    // Для каждого сообщения генерируем реакции
    messages.forEach((message) => {
      // Получаем участников диалога для реакций
      const dialogParticipants = dialogMembers
        .filter(m => m.dialogId === message.dialogId)
        .map(m => m.userId);
      
      if (dialogParticipants.length === 0) return;
      // Количество реакций на сообщение: от 0 до 8 (случайно)
      // 70% сообщений имеют реакции
      const hasReactions = Math.random() < 0.7;
      if (!hasReactions) return;

      const reactionCount = Math.floor(Math.random() * 8) + 1; // 1-8 реакций
      
      // Выбираем случайных пользователей для реакций (без повторений)
      const selectedUsers = dialogParticipants
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(reactionCount, dialogParticipants.length));

      selectedUsers.forEach((userId, _userIndex) => {
        // Время реакции - от времени сообщения до текущего времени
        const messageTime = message.createdAt; // Уже Number с микросекундами
        const now = generateTimestamp();
        const randomOffset = Math.random() * (now - messageTime);
        const reactionTime = messageTime + randomOffset; // Timestamp с микросекундами
        
        // Выбираем случайную реакцию
        const reaction = reactions[Math.floor(Math.random() * reactions.length)];

        allReactions.push({
          tenantId: message.tenantId,
          messageId: message.messageId,
          userId: userId,
          reaction: reaction,
          createdAt: reactionTime,
          updatedAt: reactionTime
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

    // eslint-disable-next-line no-unused-vars
    console.log(`   - Messages with reactions: ${messages.filter((m, i) => {
      const messageReactions = allReactions.filter(r => r.messageId.toString() === m._id.toString());
      return messageReactions.length > 0;
    }).length} out of ${messages.length}`);
    // eslint-disable-next-line no-unused-vars
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

    // reactionCounts больше не используется в модели Message
    // Счетчики реакций теперь хранятся в MessageReactionStats и обновляются автоматически через middleware

    // Пересчитываем UserStats для всех пользователей после создания всех данных
    console.log('\n🔄 Recalculating UserStats for all users...');
    let recalculatedCount = 0;
    for (const user of allUsers) {
      try {
        await recalculateUserStats(user.tenantId, user.userId);
        recalculatedCount++;
      } catch (error) {
        console.error(`Error recalculating stats for user ${user.userId}:`, error.message);
      }
    }
    console.log(`✅ Recalculated UserStats for ${recalculatedCount} users`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Tenants: ${await Tenant.countDocuments()} (${tenantIds.join(', ')})`);
    console.log(`   - Users: ${await User.countDocuments()} total across all tenants`);
    console.log(`   - Dialogs: ${await Dialog.countDocuments()} total across all tenants`);
    console.log(`   - Messages: ${await Message.countDocuments()} (${messages.length} total)`);
    console.log(`   - Message Statuses: ${await MessageStatus.countDocuments()} (${messageStatuses.length} total)`);
    console.log(`   - Message Reactions: ${await MessageReaction.countDocuments()} (${allReactions.length} total)`);
    console.log(`   - Meta: ${await Meta.countDocuments()} total`);
    console.log(`   - Dialog Members: ${await DialogMember.countDocuments()} total`);
    
    // Статистика по тенантам
    console.log('\n📈 Statistics by tenant:');
    for (const tenant of tenants) {
      const tenantUsers = await User.countDocuments({ tenantId: tenant.tenantId });
      const tenantDialogs = await Dialog.countDocuments({ tenantId: tenant.tenantId });
      const tenantMessages = await Message.countDocuments({ tenantId: tenant.tenantId });
      console.log(`   - ${tenant.tenantId}: ${tenantUsers} users, ${tenantDialogs} dialogs, ${tenantMessages} messages`);
    }
    
    // Статистика по типам сообщений
    const messageTypeStats = {};
    messages.forEach(m => {
      messageTypeStats[m.type] = (messageTypeStats[m.type] || 0) + 1;
    });
    console.log('\n💬 Message types distribution:');
    Object.entries(messageTypeStats).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });
    
    console.log('\n🤖 System Bot:');
    console.log(`   - Identifier: system_bot`);
    console.log(`   - Available in all ${tenants.length} tenants`);
    console.log(`   - Capabilities: notifications, system_messages, auto_reply`);
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();

