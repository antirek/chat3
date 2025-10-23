import connectDB from '../config/database.js';
import { Tenant, User, Dialog, DialogParticipant, Message, Meta } from '../models/index.js';
import * as participantUtils from '../utils/dialogParticipants.js';

async function seed() {
  try {
    await connectDB();

    console.log('🌱 Starting database seeding...\n');

    // Clear existing data
    await Tenant.deleteMany({});
    await User.deleteMany({});
    await Dialog.deleteMany({});
    await DialogParticipant.deleteMany({});
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
        description: `${metaType === 'internal' ? 'Внутренний' : 'Внешний'} диалог через ${channelType}`,
        createdBy: users[0]._id,
      });
      
      dialogs.push({ 
        ...dialog.toObject(), 
        metaType,
        channelType 
      });

      // Add participants - добавляем 2-3 участника в зависимости от индекса
      await participantUtils.addParticipant(tenant._id, dialog._id, users[0]._id.toString(), 'owner');
      await participantUtils.addParticipant(tenant._id, dialog._id, users[1]._id.toString(), 'member');
      if (i % 3 === 0) {
        // Каждый третий диалог с тремя участниками
        await participantUtils.addParticipant(tenant._id, dialog._id, users[2]._id.toString(), 'member');
      }
    }

    console.log(`✅ Created ${dialogs.length} dialogs`);
    console.log(`   - Internal: ${dialogs.filter(d => d.metaType === 'internal').length}`);
    console.log(`   - External: ${dialogs.filter(d => d.metaType === 'external').length}`);
    console.log(`   - WhatsApp: ${dialogs.filter(d => d.channelType === 'whatsapp').length}`);
    console.log(`   - Telegram: ${dialogs.filter(d => d.channelType === 'telegram').length}`);

    // Create Messages for first dialog
    const messages = await Message.create([
      {
        tenantId: tenant._id,
        dialogId: dialogs[0]._id,
        senderId: users[0]._id,
        content: 'Привет всем! Добро пожаловать в чат!',
        type: 'text',
      },
      {
        tenantId: tenant._id,
        dialogId: dialogs[0]._id,
        senderId: users[1]._id,
        content: 'Привет! Спасибо за приглашение.',
        type: 'text',
        readBy: [
          {
            userId: users[0]._id,
            readAt: new Date(),
          },
        ],
      },
      {
        tenantId: tenant._id,
        dialogId: dialogs[0]._id,
        senderId: users[2]._id,
        content: 'Здравствуйте! Рада присоединиться.',
        type: 'text',
        readBy: [
          {
            userId: users[0]._id,
            readAt: new Date(),
          },
          {
            userId: users[1]._id,
            readAt: new Date(),
          },
        ],
      },
    ]);

    console.log(`✅ Created ${messages.length} messages in first dialog`);

    // Update first dialog with last message
    await Dialog.findByIdAndUpdate(dialogs[0]._id, {
      lastMessageId: messages[messages.length - 1]._id,
      lastMessageAt: messages[messages.length - 1].createdAt,
    });

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
        description: 'Identifies user as a bot',
        isPublic: true,
      },
      {
        tenantId: systemTenant._id,
        entityType: 'user',
        entityId: systemBot._id,
        key: 'botType',
        value: 'system',
        dataType: 'string',
        description: 'Type of bot: system, assistant, etc',
        isPublic: true,
      },
      {
        tenantId: systemTenant._id,
        entityType: 'user',
        entityId: systemBot._id,
        key: 'capabilities',
        value: ['notifications', 'system_messages', 'auto_reply'],
        dataType: 'array',
        description: 'Bot capabilities',
        isPublic: true,
      },
      // Demo tenant meta
      {
        tenantId: tenant._id,
        entityType: 'tenant',
        entityId: tenant._id,
        key: 'plan',
        value: 'premium',
        dataType: 'string',
        description: 'Subscription plan',
        isPublic: true,
      },
      {
        tenantId: tenant._id,
        entityType: 'user',
        entityId: users[0]._id,
        key: 'theme',
        value: 'dark',
        dataType: 'string',
        description: 'User theme preference',
        isPublic: false,
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
        description: 'Dialog type: internal or external',
        isPublic: true,
      });

      // Channel type (whatsapp/telegram)
      metaEntries.push({
        tenantId: tenant._id,
        entityType: 'dialog',
        entityId: dialog._id,
        key: 'channelType',
        value: dialog.channelType,
        dataType: 'string',
        description: 'Communication channel: whatsapp or telegram',
        isPublic: true,
      });

      // Welcome message
      metaEntries.push({
        tenantId: tenant._id,
        entityType: 'dialog',
        entityId: dialog._id,
        key: 'welcomeMessage',
        value: `Добро пожаловать в "${dialog.name}"!`,
        dataType: 'string',
        description: 'Welcome message for new participants',
        isPublic: true,
      });

      // Max participants
      metaEntries.push({
        tenantId: tenant._id,
        entityType: 'dialog',
        entityId: dialog._id,
        key: 'maxParticipants',
        value: dialog.metaType === 'internal' ? 50 : 10,
        dataType: 'number',
        description: 'Maximum number of participants',
        isPublic: true,
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
        description: 'Enabled features for this dialog',
        isPublic: true,
      });

      // Security level
      metaEntries.push({
        tenantId: tenant._id,
        entityType: 'dialog',
        entityId: dialog._id,
        key: 'securityLevel',
        value: dialog.metaType === 'internal' ? 'high' : 'medium',
        dataType: 'string',
        description: 'Security level',
        isPublic: false,
      });
    });

    const meta = await Meta.create(metaEntries);

    console.log(`✅ Created ${meta.length} meta entries`);
    console.log(`   - Bot metadata: 3`);
    console.log(`   - Tenant metadata: 1`);
    console.log(`   - User metadata: 1`);
    console.log(`   - Dialog metadata: ${dialogs.length * 6} (6 per dialog: type, channelType, welcomeMessage, maxParticipants, features, securityLevel)`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Tenants: ${await Tenant.countDocuments()} (1 system + 1 demo)`);
    console.log(`   - Users: ${await User.countDocuments()} (1 system bot + 3 demo users)`);
    console.log(`   - Dialogs: ${await Dialog.countDocuments()} (70 internal + 30 external = 100 total)`);
    console.log(`   - DialogParticipants: ${await DialogParticipant.countDocuments()}`);
    console.log(`   - Messages: ${await Message.countDocuments()}`);
    console.log(`   - Meta: ${await Meta.countDocuments()} (5 system/user/tenant + ${dialogs.length * 6} dialog)`);
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
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();

