import connectDB from '../config/database.js';
import { Tenant, Dialog, Message, Meta, DialogMember } from '../models/index.js';

async function seed() {
  try {
    await connectDB();

    console.log('🌱 Starting database seeding...\n');

    // Clear existing data
    await Tenant.deleteMany({});
    await Dialog.deleteMany({});
    await Message.deleteMany({});
    await Meta.deleteMany({});
    await DialogMember.deleteMany({});

    console.log('✅ Cleared existing data');

    // Create System Tenant
    const systemTenant = await Tenant.create({
      name: 'System',
      domain: 'system.chat3.internal',
      type: 'system',
      isActive: true,
      settings: {
        isSystem: true,
        maxUsers: 1000,
        features: ['all'],
      },
    });

    console.log(`✅ Created system tenant: ${systemTenant.name}`);

    // System bot is now just a string identifier, not a User model
    console.log(`✅ System bot identifier: system_bot`);

    // Create Demo Tenant
    const tenant = await Tenant.create({
      name: 'Demo Company',
      domain: 'demo.chat3.com',
      type: 'client',
      isActive: true,
      settings: {
        maxUsers: 100,
        features: ['chat', 'video', 'files'],
      },
    });

    console.log(`✅ Created tenant: ${tenant.name}`);

    // Users are now just string identifiers, not User models
    const userIds = ['carl', 'marta', 'sara', 'kirk', 'john'];
    console.log(`✅ Using string user identifiers: ${userIds.join(', ')}`);

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
        tenantId: tenant._id,
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
      // carl - в 50+ диалогах, marta - в 45+, sara - в 40+, kirk - в 35+, john - в 30+
      const userParticipation = {
        'carl': Math.floor(Math.random() * 20) + 50, // 50-70 диалогов
        'marta': Math.floor(Math.random() * 15) + 45, // 45-60 диалогов  
        'sara': Math.floor(Math.random() * 15) + 40, // 40-55 диалогов
        'kirk': Math.floor(Math.random() * 10) + 35, // 35-45 диалогов
        'john': Math.floor(Math.random() * 10) + 30  // 30-40 диалогов
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
        const lastSeenAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Последние 7 дней
        const lastMessageAt = new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000); // Последние 3 дня

        dialogMembers.push({
          userId,
          tenantId: tenant._id,
          dialogId: dialog._id,
          unreadCount,
          lastSeenAt,
          lastMessageAt,
          isActive: true
        });
      });
    });

    // Создаем DialogMember записи батчами
    const batchSize = 100;
    for (let i = 0; i < dialogMembers.length; i += batchSize) {
      const batch = dialogMembers.slice(i, i + batchSize);
      await DialogMember.insertMany(batch);
    }

    console.log(`✅ Created ${dialogMembers.length} dialog members`);
    console.log(`   - Carl: ${dialogMembers.filter(m => m.userId === 'carl').length} dialogs`);
    console.log(`   - Marta: ${dialogMembers.filter(m => m.userId === 'marta').length} dialogs`);
    console.log(`   - Sara: ${dialogMembers.filter(m => m.userId === 'sara').length} dialogs`);
    console.log(`   - Kirk: ${dialogMembers.filter(m => m.userId === 'kirk').length} dialogs`);
    console.log(`   - John: ${dialogMembers.filter(m => m.userId === 'john').length} dialogs`);

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

    const messageTypes = ['text', 'text', 'text', 'text', 'text', 'system']; // Больше текстовых сообщений
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
          tenantId: tenant._id,
          dialogId: dialog._id,
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

    // Create Meta
    const metaEntries = [
      // System bot meta (now using string identifier)
      {
        tenantId: systemTenant._id,
        entityType: 'user',
        entityId: 'system_bot',
        key: 'isBot',
        value: true,
        dataType: 'boolean',
      },
      {
        tenantId: systemTenant._id,
        entityType: 'user',
        entityId: 'system_bot',
        key: 'botType',
        value: 'system',
        dataType: 'string',
      },
      {
        tenantId: systemTenant._id,
        entityType: 'user',
        entityId: 'system_bot',
        key: 'capabilities',
        value: ['notifications', 'system_messages', 'auto_reply'],
        dataType: 'array',
      },
      // Demo tenant meta
      {
        tenantId: tenant._id,
        entityType: 'tenant',
        entityId: tenant._id,
        key: 'plan',
        value: 'premium',
        dataType: 'string',
      },
      {
        tenantId: tenant._id,
        entityType: 'user',
        entityId: 'carl',
        key: 'theme',
        value: 'dark',
        dataType: 'string',
        createdBy: 'carl',
      },
      {
        tenantId: tenant._id,
        entityType: 'user',
        entityId: 'marta',
        key: 'theme',
        value: 'light',
        dataType: 'string',
        createdBy: 'marta',
      },
      {
        tenantId: tenant._id,
        entityType: 'user',
        entityId: 'sara',
        key: 'theme',
        value: 'auto',
        dataType: 'string',
        createdBy: 'sara',
      },
      {
        tenantId: tenant._id,
        entityType: 'user',
        entityId: 'kirk',
        key: 'theme',
        value: 'dark',
        dataType: 'string',
        createdBy: 'kirk',
      },
      {
        tenantId: tenant._id,
        entityType: 'user',
        entityId: 'john',
        key: 'theme',
        value: 'light',
        dataType: 'string',
        createdBy: 'john',
      },
    ];

    // Add meta for each dialog
    dialogs.forEach((dialog, index) => {
      // Meta type (internal/external)
      metaEntries.push({
        tenantId: tenant._id,
        entityType: 'dialog',
        entityId: dialog._id,
        key: 'type',
        value: dialog.metaType,
        dataType: 'string',
      });

      // Channel type (whatsapp/telegram)
      metaEntries.push({
        tenantId: tenant._id,
        entityType: 'dialog',
        entityId: dialog._id,
        key: 'channelType',
        value: dialog.channelType,
        dataType: 'string',
      });

      // Welcome message
      metaEntries.push({
        tenantId: tenant._id,
        entityType: 'dialog',
        entityId: dialog._id,
        key: 'welcomeMessage',
        value: `Добро пожаловать в "${dialog.name}"!`,
        dataType: 'string',
      });

      // Max participants
      metaEntries.push({
        tenantId: tenant._id,
        entityType: 'dialog',
        entityId: dialog._id,
        key: 'maxParticipants',
        value: dialog.metaType === 'internal' ? 50 : 10,
        dataType: 'number',
      });

      // Features based on type
      const features = dialog.metaType === 'internal' 
        ? ['file_sharing', 'voice_calls', 'video_calls', 'screen_sharing']
        : ['file_sharing', 'voice_calls'];
      
      metaEntries.push({
        tenantId: tenant._id,
        entityType: 'dialog',
        entityId: dialog._id,
        key: 'features',
        value: features,
        dataType: 'array',
      });

      // Security level
      metaEntries.push({
        tenantId: tenant._id,
        entityType: 'dialog',
        entityId: dialog._id,
        key: 'securityLevel',
        value: dialog.metaType === 'internal' ? 'high' : 'medium',
        dataType: 'string',
      });

      // Members - случайный набор из доступных имен
      const availableMembers = ['carl', 'marta', 'sara', 'kirk', 'john'];
      const memberCount = Math.floor(Math.random() * 4) + 2; // 2-5 участников
      const shuffledMembers = availableMembers.sort(() => 0.5 - Math.random());
      const selectedMembers = shuffledMembers.slice(0, memberCount);
      
      metaEntries.push({
        tenantId: tenant._id,
        entityType: 'dialog',
        entityId: dialog._id,
        key: 'members',
        value: selectedMembers,
        dataType: 'array',
      });
    });

    // Add meta for messages
    messages.forEach((message, index) => {
      // Определяем channelType и channelId на основе индекса сообщения
      const channelType = index % 2 === 0 ? 'whatsapp' : 'telegram';
      const channelId = channelType === 'whatsapp' ? 'W0000' : 'TG0000';
      
      // Channel type
      metaEntries.push({
        tenantId: tenant._id,
        entityType: 'message',
        entityId: message._id,
        key: 'channelType',
        value: channelType,
        dataType: 'string',
      });

      // Channel ID
      metaEntries.push({
        tenantId: tenant._id,
        entityType: 'message',
        entityId: message._id,
        key: 'channelId',
        value: channelId,
        dataType: 'string',
      });
    });

    const meta = await Meta.create(metaEntries);

    console.log(`✅ Created ${meta.length} meta entries`);
    console.log(`   - Bot metadata: 3`);
    console.log(`   - Tenant metadata: 1`);
    console.log(`   - User metadata: 5 (carl, marta, sara, kirk, john themes)`);
    console.log(`   - Dialog metadata: ${dialogs.length * 7} (7 per dialog: type, channelType, welcomeMessage, maxParticipants, features, securityLevel, members)`);
    console.log(`   - Message metadata: ${messages.length * 2} (2 per message: channelType, channelId)`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Tenants: ${await Tenant.countDocuments()} (1 system + 1 demo)`);
    console.log(`   - Users: String identifiers (carl, marta, sara, kirk, john)`);
    console.log(`   - Dialogs: ${await Dialog.countDocuments()} (70 internal + 30 external = 100 total)`);
    console.log(`   - Messages: ${await Message.countDocuments()} (${messages.length} total across ${dialogs.length} dialogs)`);
    console.log(`   - Meta: ${await Meta.countDocuments()} (5 system/tenant + ${dialogs.length * 7} dialog + ${messages.length * 2} message)`);
    console.log('\n🤖 System Bot:');
    console.log(`   - Identifier: system_bot`);
    console.log(`   - Tenant: ${systemTenant.name} (${systemTenant.domain})`);
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
    console.log('\n👥 Members filters:');
    console.log(`   - GET /api/dialogs?filter=(meta.members,in,[john]) → диалоги с john`);
    console.log(`   - GET /api/dialogs?filter=(meta.members,in,[sara,carl]) → диалоги с sara или carl`);
    console.log(`   - GET /api/dialogs?filter=(meta.members,nin,[kirk]) → диалоги без kirk`);
    console.log(`   - GET /api/dialogs?filter=(meta.members,in,[marta]) → диалоги с marta`);
    console.log('\n💬 Message filters:');
    console.log(`   - GET /api/messages?filter=(meta.channelType,eq,whatsapp) → сообщения из WhatsApp`);
    console.log(`   - GET /api/messages?filter=(meta.channelType,eq,telegram) → сообщения из Telegram`);
    console.log(`   - GET /api/messages?filter=(meta.channelId,eq,W0000) → сообщения с ID W0000`);
    console.log(`   - GET /api/messages?filter=(meta.channelId,eq,TG0000) → сообщения с ID TG0000`);
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();

