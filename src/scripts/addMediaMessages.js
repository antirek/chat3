import connectDB from '@chat3/config';
import { Tenant, Dialog, Message, Meta } from '@chat3/models';

async function addMediaMessages() {
  try {
    await connectDB();
    console.log('\n🎬 Adding media messages...');
    
    // Получаем tenant ID для Demo Company
    const tenant = await Tenant.findOne({ name: 'Demo Company' });
    if (!tenant) {
      console.error('Demo Company tenant not found');
      process.exit(1);
    }

    // Получаем все диалоги
    const dialogs = await Dialog.find({ tenantId: tenant._id });
    console.log(`Found ${dialogs.length} dialogs`);

    const senderIds = ['carl', 'marta', 'sara', 'kirk', 'john'];
    const allMediaMessages = [];

    // Создаем медиа-сообщения для каждого диалога
    // eslint-disable-next-line no-unused-vars
    dialogs.forEach((dialog, dialogIndex) => {
      // Добавляем 2-5 медиа-сообщений в каждый диалог
      const mediaCount = Math.floor(Math.random() * 4) + 2; // 2-5 сообщений
      
      for (let i = 0; i < mediaCount; i++) {
        const randomSenderId = senderIds[Math.floor(Math.random() * senderIds.length)];
        
        // Определяем тип медиа-сообщения
        const mediaTypes = ['file', 'video', 'audio', 'image'];
        const randomMediaType = mediaTypes[Math.floor(Math.random() * mediaTypes.length)];
        
        // Создаем контент в зависимости от типа
        let content, fileName;
        switch (randomMediaType) {
          case 'file': {
            const fileTypes = ['document.pdf', 'spreadsheet.xlsx', 'presentation.pptx', 'archive.zip'];
            fileName = fileTypes[Math.floor(Math.random() * fileTypes.length)];
            content = `📄 Файл: ${fileName}`;
            break;
          }
          case 'video': {
            const videoTypes = ['meeting_recording.mp4', 'tutorial.mp4', 'demo.mp4', 'presentation.mp4'];
            fileName = videoTypes[Math.floor(Math.random() * videoTypes.length)];
            content = `🎥 Видео: ${fileName}`;
            break;
          }
          case 'audio': {
            const audioTypes = ['voice_message.mp3', 'meeting_audio.mp3', 'podcast.mp3', 'music.mp3'];
            fileName = audioTypes[Math.floor(Math.random() * audioTypes.length)];
            content = `🎵 Аудио: ${fileName}`;
            break;
          }
          case 'image': {
            const imageTypes = ['screenshot.png', 'photo.jpg', 'diagram.png', 'chart.png'];
            fileName = imageTypes[Math.floor(Math.random() * imageTypes.length)];
            content = `🖼️ Изображение: ${fileName}`;
            break;
          }
        }

        // Создаем случайную дату в последние 7 дней
        const now = new Date();
        const randomDaysAgo = Math.floor(Math.random() * 7);
        const randomHours = Math.floor(Math.random() * 24);
        const randomMinutes = Math.floor(Math.random() * 60);
        const createdAt = new Date(now.getTime() - (randomDaysAgo * 24 * 60 * 60 * 1000) - (randomHours * 60 * 60 * 1000) - (randomMinutes * 60 * 1000));

        allMediaMessages.push({
          tenantId: tenant._id,
          dialogId: dialog._id,
          senderId: randomSenderId,
          content: content,
          type: randomMediaType,
          createdAt: createdAt,
          updatedAt: createdAt
        });
      }
    });

    // Создаем все медиа-сообщения
    const mediaMessages = await Message.create(allMediaMessages);
    console.log(`✅ Created ${mediaMessages.length} media messages`);

    // Добавляем мета-теги для медиа-сообщений
    const metaEntries = [];
    mediaMessages.forEach((message, index) => {
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

      // File name (если есть)
      if (message.content.includes(':')) {
        const fileName = message.content.split(': ')[1];
        metaEntries.push({
          tenantId: tenant._id,
          entityType: 'message',
          entityId: message._id,
          key: 'fileName',
          value: fileName,
          dataType: 'string',
        });
      }
    });

    const meta = await Meta.create(metaEntries);
    console.log(`✅ Created ${meta.length} meta entries for media messages`);

    // Статистика по типам
    const typeStats = {};
    mediaMessages.forEach(msg => {
      typeStats[msg.type] = (typeStats[msg.type] || 0) + 1;
    });

    console.log('\n📊 Media messages statistics:');
    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count} messages`);
    });

    console.log('\n💬 Test filters:');
    console.log(`   - GET /api/dialogs/{dialogId}/messages?filter=(type,eq,file) → файлы`);
    console.log(`   - GET /api/dialogs/{dialogId}/messages?filter=(type,eq,video) → видео`);
    console.log(`   - GET /api/dialogs/{dialogId}/messages?filter=(type,eq,audio) → аудио`);
    console.log(`   - GET /api/dialogs/{dialogId}/messages?filter=(type,eq,image) → изображения`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding media messages:', error);
    process.exit(1);
  }
}

addMediaMessages();
