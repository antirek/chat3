import { 
  Tenant, ApiKey, User, Dialog, Message, Meta, DialogMember, 
  MessageStatus, Event, MessageReaction, Update 
} from '../../../models/index.js';
import connectDB from '../../../config/database.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const initController = {
  // Инициализация: удаление всех данных, создание tenant и API ключа
  async initialize(req, res) {
    try {
      await connectDB();

      const results = {
        tenant: null,
        apiKey: null,
        errors: []
      };

      // 1. Удалить все данные
      try {
        console.log('🗑️  Удаление всех данных...');
        await User.deleteMany({});
        await Dialog.deleteMany({});
        await Message.deleteMany({});
        await Meta.deleteMany({});
        await DialogMember.deleteMany({});
        await MessageStatus.deleteMany({});
        await MessageReaction.deleteMany({});
        await Event.deleteMany({});
        await Update.deleteMany({});
        await ApiKey.deleteMany({});
        await Tenant.deleteMany({});
        console.log('✅ Все данные удалены');
      } catch (error) {
        results.errors.push(`Data deletion error: ${error.message}`);
        console.error('❌ Ошибка при удалении данных:', error);
      }

      // 2. Создать tenant tnt_default
      try {
        const tenant = await Tenant.create({
          tenantId: 'tnt_default'
        });
        results.tenant = {
          tenantId: tenant.tenantId,
          created: true
        };
        console.log(`✅ Создан tenant: ${tenant.tenantId}`);
      } catch (error) {
        results.errors.push(`Tenant creation error: ${error.message}`);
        console.error('❌ Ошибка при создании tenant:', error);
      }

      // 3. Создать API ключ
      try {
        const key = ApiKey.generateKey();
        const apiKey = await ApiKey.create({
          key,
          name: 'Default API Key',
          description: 'Auto-generated API key for initialization',
          permissions: ['read', 'write', 'delete'],
          isActive: true
        });
        
        results.apiKey = {
          key: apiKey.key,
          name: apiKey.name,
          created: true
        };
        console.log(`✅ Создан API ключ: ${apiKey.key.substring(0, 20)}...`);
      } catch (error) {
        results.errors.push(`API key creation error: ${error.message}`);
        console.error('❌ Ошибка при создании API ключа:', error);
      }

      const statusCode = results.errors.length > 0 ? 207 : 200; // 207 Multi-Status если есть ошибки
      
      res.status(statusCode).json({
        data: results,
        message: results.errors.length > 0 
          ? 'Initialization completed with some errors' 
          : 'Initialization completed successfully'
      });
    } catch (error) {
      console.error('❌ Критическая ошибка инициализации:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Запуск seed скрипта
  async seed(req, res) {
    try {
      // Запускаем seed скрипт асинхронно
      const seedScript = 'node src/scripts/seed.js';
      
      // Отправляем ответ сразу, чтобы клиент не ждал
      res.status(202).json({
        message: 'Seed script started',
        data: {
          status: 'processing',
          note: 'This operation may take some time. Check server logs for progress.'
        }
      });

      // Запускаем seed в фоне
      execAsync(seedScript, { cwd: process.cwd() })
        .then(({ stdout, stderr }) => {
          console.log('✅ Seed script completed');
          if (stdout) console.log(stdout);
          if (stderr) console.error('Seed stderr:', stderr);
        })
        .catch((error) => {
          console.error('❌ Seed script error:', error);
        });
    } catch (error) {
      // Если ошибка произошла до отправки ответа
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: error.message
        });
      } else {
        console.error('Error after response sent:', error);
      }
    }
  }
};

