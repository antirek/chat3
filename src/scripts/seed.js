import connectDB from '../config/database.js';
import { Tenant, User, Dialog, Message, Meta } from '../models/index.js';

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

    // Create System Bot User
    const systemBot = await User.create({
      tenantId: systemTenant._id,
      username: 'system_bot',
      email: 'bot@system.chat3.internal',
      password: 'system_bot_password_change_me',
      firstName: 'System',
      lastName: 'Bot',
      role: 'admin',
      type: 'bot',
      isActive: true,
    });

    console.log(`✅ Created system bot: ${systemBot.username}`);

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

    // Create Users
    const users = await User.create([
      {
        tenantId: tenant._id,
        username: 'admin',
        email: 'admin@demo.com',
        password: 'password123',
        firstName: 'Админ',
        lastName: 'Администраторов',
        role: 'admin',
        type: 'user',
        isActive: true,
      },
      {
        tenantId: tenant._id,
        username: 'user1',
        email: 'user1@demo.com',
        password: 'password123',
        firstName: 'Иван',
        lastName: 'Иванов',
        role: 'user',
        type: 'user',
        isActive: true,
      },
      {
        tenantId: tenant._id,
        username: 'user2',
        email: 'user2@demo.com',
        password: 'password123',
        firstName: 'Мария',
        lastName: 'Петрова',
        role: 'user',
        type: 'user',
        isActive: true,
      },
    ]);

    console.log(`✅ Created ${users.length} users`);

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
        createdBy: users[0]._id
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
    const senderIds = ['carl', 'sara', 'john']; // Произвольные строки вместо ObjectId
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
    console.log(`   - Sender IDs: carl, sara, john (произвольные строки)`);

    // Create Meta
    const metaEntries = [
      // System bot meta
      {
        tenantId: systemTenant._id,
        entityType: 'user',
        entityId: systemBot._id,
        key: 'isBot',
        value: true,
        dataType: 'boolean',
      },
      {
        tenantId: systemTenant._id,
        entityType: 'user',
        entityId: systemBot._id,
        key: 'botType',
        value: 'system',
        dataType: 'string',
      },
      {
        tenantId: systemTenant._id,
        entityType: 'user',
        entityId: systemBot._id,
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
        entityId: users[0]._id,
        key: 'theme',
        value: 'dark',
        dataType: 'string',
        createdBy: users[0]._id,
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
      const availableMembers = ['john', 'sara', 'carl', 'marta', 'kirk'];
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
    console.log(`   - User metadata: 1`);
    console.log(`   - Dialog metadata: ${dialogs.length * 7} (7 per dialog: type, channelType, welcomeMessage, maxParticipants, features, securityLevel, members)`);
    console.log(`   - Message metadata: ${messages.length * 2} (2 per message: channelType, channelId)`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Tenants: ${await Tenant.countDocuments()} (1 system + 1 demo)`);
    console.log(`   - Users: ${await User.countDocuments()} (1 system bot + 3 demo users)`);
    console.log(`   - Dialogs: ${await Dialog.countDocuments()} (70 internal + 30 external = 100 total, без участников)`);
    console.log(`   - Messages: ${await Message.countDocuments()} (${messages.length} total across ${dialogs.length} dialogs)`);
    console.log(`   - Meta: ${await Meta.countDocuments()} (5 system/user/tenant + ${dialogs.length * 7} dialog + ${messages.length * 2} message)`);
    console.log('\n🤖 System Bot:');
    console.log(`   - Username: ${systemBot.username}`);
    console.log(`   - Email: ${systemBot.email}`);
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

