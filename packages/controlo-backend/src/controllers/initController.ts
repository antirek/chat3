import {
  Tenant, ApiKey, User, Dialog, Message, Meta, DialogMember,
  MessageStatus, Event, MessageReaction, Update, Pack
} from '@chat3/models';
import connectDB from '@chat3/utils/databaseUtils.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { recalculateUserStats } from '@chat3/utils/counterUtils.js';
import { recalculateUserPackUnreadBySenderType } from '@chat3/utils/packStatsUtils.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { Request, Response } from 'express';

const execAsync = promisify(exec);

// Получаем абсолютный путь к seed.js относительно корня проекта
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// От packages/controlo-backend/src/controllers/ поднимаемся на 4 уровня вверх к корню проекта
// controllers -> src -> controlo-backend -> packages -> корень
const projectRoot = resolve(__dirname, '../../../../');
const seedScriptPath = resolve(projectRoot, 'packages/controlo-backend/scripts/seed.js');

export const initController = {
  // Инициализация: удаление всех данных, создание tenant и API ключа
  async initialize(req: Request, res: Response): Promise<void> {
    try {
      await connectDB();

      const results = {
        tenant: null as { tenantId: string; created: boolean } | null,
        apiKey: null as { key: string; name: string; created: boolean } | null,
        seed: null as { started: boolean; note: string } | null,
        errors: [] as string[]
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
      } catch (error: any) {
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
      } catch (error: any) {
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
      } catch (error: any) {
        results.errors.push(`API key creation error: ${error.message}`);
        console.error('❌ Ошибка при создании API ключа:', error);
      }

      // 4. Запустить seed скрипт автоматически
      try {
        console.log('🌱 Запуск seed скрипта...');
        const seedScript = `node ${seedScriptPath}`;
        
        // Запускаем seed в фоне (не ждем завершения)
        // Ошибки логируются, но не добавляются в results.errors, так как ответ уже будет отправлен
        execAsync(seedScript, { cwd: projectRoot })
          .then(({ stdout, stderr }) => {
            console.log('✅ Seed script completed');
            if (stdout) console.log(stdout);
            if (stderr) console.error('Seed stderr:', stderr);
          })
          .catch((error) => {
            // Логируем ошибку, но не добавляем в results.errors, так как ответ уже отправлен
            console.error('❌ Seed script error:', error);
          });
        
        results.seed = {
          started: true,
          note: 'Seed script is running in background. Check server logs for progress.'
        };
      } catch (error: any) {
        // Ошибки запуска seed добавляем в results.errors, так как они происходят до отправки ответа
        results.errors.push(`Seed script start error: ${error.message}`);
        console.error('❌ Ошибка при запуске seed:', error);
      }

      const statusCode = results.errors.length > 0 ? 207 : 200; // 207 Multi-Status если есть ошибки
      
      res.status(statusCode).json({
        data: results,
        message: results.errors.length > 0 
          ? 'Initialization completed with some errors' 
          : 'Initialization completed successfully. Seed script is running in background.'
      });
    } catch (error: any) {
      console.error('❌ Критическая ошибка инициализации:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Запуск seed скрипта
  async seed(req: Request, res: Response): Promise<void> {
    try {
      // Запускаем seed скрипт асинхронно
      const seedScript = `node ${seedScriptPath}`;
      
      // Отправляем ответ сразу, чтобы клиент не ждал
      res.status(202).json({
        message: 'Seed script started',
        data: {
          status: 'processing',
          note: 'This operation may take some time. Check server logs for progress.'
        }
      });

      // Запускаем seed в фоне
      execAsync(seedScript, { cwd: projectRoot })
        .then(({ stdout, stderr }) => {
          console.log('✅ Seed script completed');
          if (stdout) console.log(stdout);
          if (stderr) console.error('Seed stderr:', stderr);
        })
        .catch((error) => {
          console.error('❌ Seed script error:', error);
        });
    } catch (error: any) {
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
  },

  /**
   * Полный пересчёт всех счетчиков: UserStats (и UserDialogStats, UserUnreadBySenderType) для всех пользователей,
   * затем UserPackUnreadBySenderType для всех паков. Операция в фоне, ответ 202.
   */
  async fullRecalculateStats(req: Request, res: Response): Promise<void> {
    try {
      await connectDB();

      const tenants = await Tenant.find({}).select('tenantId').lean();

      res.status(202).json({
        message: 'Full recalculate stats started',
        data: {
          status: 'processing',
          note: 'Step 1: UserStats (UserDialogStats, UserUnreadBySenderType) for all users. Step 2: UserPackUnreadBySenderType for all packs. Check server logs for progress.'
        }
      });

      (async () => {
        const logPrefix = '[full-recalculate-stats]';
        let totalUsersProcessed = 0;
        let totalUsersWithErrors = 0;
        let totalPacksProcessed = 0;
        let totalPacksWithErrors = 0;
        const errors: string[] = [];

        try {
          // Этап 1: пересчёт UserStats для всех пользователей (включает UserDialogStats и recalculateUserUnreadBySenderType внутри)
          console.log(`${logPrefix} Этап 1: пересчёт UserStats для всех пользователей (UserDialogStats из Message+MessageStatus, затем UserUnreadBySenderType и запись в UserStats).`);
          for (const tenant of tenants) {
            const users = await User.find({ tenantId: tenant.tenantId }).select('userId').lean();
            let tenantUsersOk = 0;
            let tenantUsersErr = 0;
            for (const user of users) {
              try {
                await recalculateUserStats(tenant.tenantId, user.userId);
                totalUsersProcessed++;
                tenantUsersOk++;
              } catch (error: any) {
                totalUsersWithErrors++;
                tenantUsersErr++;
                const msg = `tenant=${tenant.tenantId} userId=${user.userId}: ${error.message}`;
                errors.push(msg);
                console.error(`${logPrefix} Ошибка пересчёта пользователя: ${msg}`);
              }
            }
            console.log(`${logPrefix} Тенант ${tenant.tenantId}: пользователей обработано ${tenantUsersOk}, ошибок ${tenantUsersErr} (всего пользователей ${users.length}).`);
          }
          console.log(`${logPrefix} Этап 1 завершён: всего пользователей обработано ${totalUsersProcessed}, с ошибками ${totalUsersWithErrors}.`);

          // Этап 2: синхронизация UserPackUnreadBySenderType для всех паков
          console.log(`${logPrefix} Этап 2: синхронизация UserPackUnreadBySenderType для всех паков (агрегация из UserDialogUnreadBySenderType по диалогам пака).`);
          for (const tenant of tenants) {
            const packIds = await Pack.find({ tenantId: tenant.tenantId }).distinct('packId').exec();
            let tenantPacksOk = 0;
            let tenantPacksErr = 0;
            for (const packId of packIds) {
              try {
                await recalculateUserPackUnreadBySenderType(tenant.tenantId, packId, {
                  sourceOperation: 'full-recalculate-stats',
                  sourceEntityId: packId
                });
                totalPacksProcessed++;
                tenantPacksOk++;
              } catch (err: unknown) {
                totalPacksWithErrors++;
                tenantPacksErr++;
                const message = err instanceof Error ? err.message : String(err);
                errors.push(`Pack ${packId}: ${message}`);
                console.error(`${logPrefix} Ошибка пересчёта пака: tenant=${tenant.tenantId} packId=${packId}: ${message}`);
              }
            }
            console.log(`${logPrefix} Тенант ${tenant.tenantId}: паков обработано ${tenantPacksOk}, ошибок ${tenantPacksErr} (всего паков ${packIds.length}).`);
          }
          console.log(`${logPrefix} Этап 2 завершён: всего паков обработано ${totalPacksProcessed}, с ошибками ${totalPacksWithErrors}.`);
          console.log(`${logPrefix} Полный пересчёт завершён: пользователей ${totalUsersProcessed} (ошибок ${totalUsersWithErrors}), паков ${totalPacksProcessed} (ошибок ${totalPacksWithErrors}).`);
        } catch (error: any) {
          console.error(`${logPrefix} Критическая ошибка в фоновой задаче:`, error);
        }
      })();
    } catch (error: any) {
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
