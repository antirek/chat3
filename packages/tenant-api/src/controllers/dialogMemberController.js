import { Dialog, DialogMember, Meta, UserDialogStats, UserDialogActivity } from '@chat3/models';
import * as dialogMemberUtils from '../utils/dialogMemberUtils.js';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { parseFilters, extractMetaFilters } from '../utils/queryParser.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { scheduleDialogReadTask } from '@chat3/utils/dialogReadTaskUtils.js';
import * as userUtils from '../utils/userUtils.js';
import { 
  updateUserStatsDialogCount,
  finalizeCounterUpdateContext,
  updateUnreadCount
} from '@chat3/utils/counterUtils.js';

const dialogMemberController = {
  // Add member to dialog
  async addDialogMember(req, res) {
    const routePath = '/:dialogId/members/add';
    const log = (...args) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { dialogId } = req.params;
      const { userId, type, name } = req.body;
      log(`Получены параметры: dialogId=${dialogId}, userId=${userId}`);

      if (!userId) {
        log(`Ошибка валидации: отсутствует userId`);
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required field: userId'
        });
      }

      // Найти Dialog по dialogId для получения ObjectId
      log(`Поиск диалога: dialogId=${dialogId}, tenantId=${req.tenantId}`);
      const dialog = await Dialog.findOne({ dialogId: dialogId, tenantId: req.tenantId });
      if (!dialog) {
        log(`Диалог не найден: dialogId=${dialogId}`);
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }
      log(`Диалог найден: dialogId=${dialog.dialogId}`);

      // Проверяем, существует ли участник уже в диалоге
      log(`Проверка существования участника: userId=${userId}, dialogId=${dialog.dialogId}`);
      const existingMember = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: dialog.dialogId,
        userId
      }).lean();

      if (existingMember) {
        // Участник уже существует - просто возвращаем успешный ответ
        log(`Участник уже существует в диалоге: userId=${userId}`);
        return res.status(200).json({
          data: sanitizeResponse({
            userId,
            dialogId: dialog.dialogId
          }),
          message: 'Member already exists in dialog'
        });
      }

      // Проверяем и создаем пользователя, если его нет
      log(`Проверка/создание пользователя: userId=${userId}, type=${type}, name=${name}`);
      await userUtils.ensureUserExists(req.tenantId, userId, {
        type,
        name
      });
      log(`Пользователь готов: userId=${userId}`);

      log(`Добавление участника в диалог: userId=${userId}, dialogId=${dialog.dialogId}`);
      const member = await dialogMemberUtils.addDialogMember(
        req.tenantId,
        userId,
        dialog.dialogId // Передаем строковый dialogId
      );
      log(`Участник добавлен: userId=${member.userId}`);

      // Получаем unreadCount из UserDialogStats
      log(`Получение статистики диалога: userId=${userId}, dialogId=${dialog.dialogId}`);
      const userDialogStats = await UserDialogStats.findOne({
        tenantId: req.tenantId,
        userId,
        dialogId: dialog.dialogId
      }).lean();
      const unreadCount = userDialogStats?.unreadCount || 0;
      log(`Статистика получена: unreadCount=${unreadCount}`);

      // Получаем метаданные диалога для события
      log(`Получение метаданных диалога: dialogId=${dialog.dialogId}`);
      const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialog.dialogId);
      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });
      log(`Метаданные диалога получены`);

      // Получаем активность из UserDialogActivity
      log(`Получение активности пользователя: userId=${member.userId}, dialogId=${dialog.dialogId}`);
      const activity = await UserDialogActivity.findOne({
        tenantId: req.tenantId,
        userId: member.userId,
        dialogId: dialog.dialogId
      }).lean();

      const memberSection = eventUtils.buildMemberSection({
        userId: member.userId,
        state: {
          unreadCount: unreadCount, // Используем unreadCount из UserDialogStats
          lastSeenAt: activity?.lastSeenAt || 0,
          lastMessageAt: activity?.lastMessageAt || 0
        }
      });
      log(`Секция участника построена: userId=${member.userId}`);

      const eventContext = eventUtils.buildEventContext({
        eventType: 'dialog.member.add',
        dialogId: dialog.dialogId,
        entityId: `${dialog.dialogId}:${userId}`, // Используем составной ID
        includedSections: ['dialog', 'member'],
        updatedFields: ['member']
      });

      // КРИТИЧНО: Создаем событие и сохраняем eventId для обновления счетчиков
      log(`Создание события: eventType=dialog.member.add, entityId=${dialog.dialogId}:${userId}`);
      const memberEvent = await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'dialog.member.add',
        entityType: 'dialogMember',
        entityId: `${dialog.dialogId}:${userId}`, // Используем составной ID
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api',
        data: eventUtils.composeEventData({
          context: eventContext,
          dialog: dialogSection,
          member: memberSection
        })
      });

      const sourceEventId = memberEvent?.eventId || null;
      log(`Событие создано: eventId=${sourceEventId}`);

      // КРИТИЧНО: Используем try-finally для гарантированной финализации контекстов
      try {
        // Обновление dialogCount
        log(`Обновление счетчика dialogCount: userId=${userId}, delta=1`);
        await updateUserStatsDialogCount(
          req.tenantId,
          userId,
          1, // delta
          'dialog.member.add',
          sourceEventId,
          req.apiKey?.name || 'unknown',
          'api'
        );
        log(`Счетчик dialogCount обновлен`);
      } finally {
        // Создаем user.stats.update после всех изменений счетчиков
        try {
          log(`Финализация контекста обновления счетчиков: userId=${userId}, eventId=${sourceEventId}`);
          await finalizeCounterUpdateContext(req.tenantId, userId, sourceEventId);
          log(`Контекст финализирован`);
        } catch (error) {
          log(`Ошибка финализации контекста для ${userId}:`, error);
        }
      }

      log(`Отправка успешного ответа: userId=${userId}, dialogId=${dialogId}`);
      res.status(201).json({
        data: sanitizeResponse({
          userId,
          dialogId
        }),
        message: 'Member added to dialog successfully'
      });
    } catch (error) {
      log(`Ошибка обработки запроса:`, error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  async getDialogMembers(req, res) {
    const routePath = '/:dialogId/members';
    const log = (...args) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { dialogId } = req.params;
      const { page: pageParam, limit: limitParam, filter, sort: sortParam, sortDirection } = req.query;
      log(`Получены параметры: dialogId=${dialogId}, page=${pageParam}, limit=${limitParam}, filter=${filter}, sort=${sortParam}`);

      // Преобразуем page и limit в числа
      const page = parseInt(pageParam, 10) || 1;
      const limit = parseInt(limitParam, 10) || 10;

      log(`Поиск диалога: dialogId=${dialogId}, tenantId=${req.tenantId}`);
      const dialog = await Dialog.findOne({ tenantId: req.tenantId, dialogId }).select('dialogId').lean();
      if (!dialog) {
        log(`Диалог не найден: dialogId=${dialogId}`);
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }
      log(`Диалог найден: dialogId=${dialog.dialogId}`);

      // Убеждаемся, что page и limit - числа
      const skip = Math.max(0, (page - 1) * limit);
      let parsedFilters = {};

      if (filter) {
        try {
          log(`Парсинг фильтров: filter=${filter}`);
          parsedFilters = parseFilters(filter);
          log(`Фильтры распарсены успешно`);
        } catch (error) {
          log(`Ошибка парсинга фильтров: ${error.message}`);
          return res.status(400).json({
            error: 'Bad Request',
            message: `Invalid filter format. ${error.message}`
          });
        }
      }

      const { metaFilters, regularFilters } = extractMetaFilters(parsedFilters);
      const allowedFilterFields = new Set(['userId', 'role', 'unreadCount', 'lastSeenAt', 'lastMessageAt', 'joinedAt']);

      const memberQuery = {
        tenantId: req.tenantId,
        dialogId: dialog.dialogId
      };

      if (regularFilters.$and && Array.isArray(regularFilters.$and)) {
        const andConditions = regularFilters.$and.filter(condition => {
          const [key] = Object.keys(condition);
          return allowedFilterFields.has(key);
        });

        if (andConditions.length > 0) {
          memberQuery.$and = andConditions;
        }

        delete regularFilters.$and;
      }

      for (const [key, value] of Object.entries(regularFilters)) {
        if (!allowedFilterFields.has(key)) {
          continue;
        }
        memberQuery[key] = value;
      }

      if (Object.keys(metaFilters).length > 0) {
        log(`Поиск участников по мета-фильтрам: metaFilters=${JSON.stringify(metaFilters)}`);
        const userIds = await findMemberUserIdsByMeta(req.tenantId, dialog.dialogId, metaFilters);
        log(`Найдено участников по мета-фильтрам: ${userIds.length}`);

        if (userIds.length === 0) {
          log(`Нет участников, соответствующих мета-фильтрам`);
          return res.json({
            data: [],
            pagination: {
              page,
              limit,
              total: 0,
              pages: 0
            }
          });
        }

        const metaCondition = { userId: { $in: userIds } };

        if (memberQuery.userId !== undefined) {
          memberQuery.$and = memberQuery.$and || [];
          memberQuery.$and.push({ userId: memberQuery.userId });
          delete memberQuery.userId;
        }

        memberQuery.$and = memberQuery.$and || [];
        memberQuery.$and.push(metaCondition);
      }

      // Парсим параметр sort, который может быть в формате (field,asc) или (field,desc)
      let sortField = 'joinedAt';
      let sortDir = -1; // По умолчанию desc
      
      if (sortParam) {
        // Проверяем формат (field,direction)
        const sortMatch = sortParam.match(/^\(([^,]+),([^)]+)\)$/);
        if (sortMatch) {
          const [, field, direction] = sortMatch;
          sortField = field.trim();
          sortDir = direction.trim().toLowerCase() === 'asc' ? 1 : -1;
        } else {
          // Простой формат: просто имя поля
          sortField = sortParam;
          sortDir = sortDirection === 'asc' ? 1 : -1;
        }
      } else if (sortDirection) {
        sortDir = sortDirection === 'asc' ? 1 : -1;
      }
      
      const allowedSortFields = new Set(['joinedAt', 'lastSeenAt', 'lastMessageAt', 'unreadCount', 'userId', 'isActive', 'role']);
      if (!allowedSortFields.has(sortField)) {
        sortField = 'joinedAt';
      }
      
      // Добавляем вторичную сортировку для стабильности (чтобы при одинаковых значениях порядок был предсказуемым)
      // Всегда используем _id как вторичную сортировку для гарантии стабильности
      const sortOptions = { 
        [sortField]: sortDir,
        _id: 1 // Вторичная сортировка по _id для стабильности (гарантирует предсказуемый порядок)
      };

      log(`Выполнение запроса участников: query=${JSON.stringify(memberQuery)}, sort=${JSON.stringify(sortOptions)}, skip=${skip}, limit=${limit}`);
      const [total, members] = await Promise.all([
        DialogMember.countDocuments(memberQuery),
        DialogMember.find(memberQuery)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .select('-__v')
          .lean()
      ]);
      log(`Найдено участников: ${members.length} из ${total}`);

      log(`Получение метаданных для ${members.length} участников`);
      const membersWithMeta = await Promise.all(
        members.map(async (member) => {
          const memberMeta = await metaUtils.getEntityMeta(
            req.tenantId,
            'dialogMember',
            `${dialog.dialogId}:${member.userId}`
          );

          return {
            ...member,
            meta: memberMeta
          };
        })
      );
      log(`Метаданные получены для всех участников`);

      log(`Отправка ответа: page=${page}, limit=${limit}, total=${total}, pages=${Math.ceil(total / limit)}`);
      return res.json({
        data: sanitizeResponse(membersWithMeta),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      log(`Ошибка обработки запроса:`, error.message);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Remove member from dialog
  async removeDialogMember(req, res) {
    const routePath = '/:dialogId/members/:userId/remove';
    const log = (...args) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { dialogId, userId } = req.params;
      log(`Получены параметры: dialogId=${dialogId}, userId=${userId}`);

      // Найти Dialog по dialogId для получения ObjectId
      log(`Поиск диалога: dialogId=${dialogId}, tenantId=${req.tenantId}`);
      const dialog = await Dialog.findOne({ dialogId: dialogId, tenantId: req.tenantId });
      if (!dialog) {
        log(`Диалог не найден: dialogId=${dialogId}`);
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }
      log(`Диалог найден: dialogId=${dialog.dialogId}`);

      // Получаем member перед удалением для события
      log(`Поиск участника перед удалением: userId=${userId}, dialogId=${dialog.dialogId}`);
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        userId,
        dialogId: dialog.dialogId // Используем строковый dialogId
      });

      // Получаем unreadCount из UserDialogStats перед удалением
      log(`Получение статистики участника: userId=${userId}, dialogId=${dialog.dialogId}`);
      const userDialogStats = await UserDialogStats.findOne({
        tenantId: req.tenantId,
        userId,
        dialogId: dialog.dialogId
      }).lean();
      const unreadCount = userDialogStats?.unreadCount || 0;
      log(`Статистика получена: unreadCount=${unreadCount}`);

      // Получаем активность из UserDialogActivity перед удалением
      log(`Получение активности участника: userId=${userId}, dialogId=${dialog.dialogId}`);
      const activity = await UserDialogActivity.findOne({
        tenantId: req.tenantId,
        userId,
        dialogId: dialog.dialogId
      }).lean();
      log(`Активность получена`);

      let sourceEventId = null;

      // Создаем событие только если member существует
      if (member) {
        log(`Участник найден, создание события перед удалением: userId=${userId}`);
        // Получаем метаданные диалога для события
        log(`Получение метаданных диалога: dialogId=${dialog.dialogId}`);
        const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialog.dialogId);
        const dialogSection = eventUtils.buildDialogSection({
          dialogId: dialog.dialogId,
          tenantId: dialog.tenantId,
          createdAt: dialog.createdAt,
          meta: dialogMeta || {}
        });
        log(`Метаданные диалога получены`);

        const memberSection = eventUtils.buildMemberSection({
          userId: member.userId,
          state: {
            unreadCount: unreadCount, // Используем unreadCount из UserDialogStats
            lastSeenAt: activity?.lastSeenAt || 0,
            lastMessageAt: activity?.lastMessageAt || 0
          }
        });

        const eventContext = eventUtils.buildEventContext({
          eventType: 'dialog.member.remove',
          dialogId: dialog.dialogId,
          entityId: `${dialog.dialogId}:${userId}`, // Используем составной ID
          includedSections: ['dialog', 'member'],
          updatedFields: ['member']
        });

        // КРИТИЧНО: Создаем событие ДО удаления, чтобы передать sourceEventId в утилиту
        log(`Создание события: eventType=dialog.member.remove, entityId=${dialog.dialogId}:${userId}`);
        const memberEvent = await eventUtils.createEvent({
          tenantId: req.tenantId,
          eventType: 'dialog.member.remove',
          entityType: 'dialogMember',
          entityId: `${dialog.dialogId}:${userId}`, // Используем составной ID
          actorId: req.apiKey?.name || 'unknown',
          actorType: 'api',
          data: eventUtils.composeEventData({
            context: eventContext,
            dialog: dialogSection,
            member: memberSection
          })
        });

        sourceEventId = memberEvent?.eventId || null;
        log(`Событие создано: eventId=${sourceEventId}`);
      } else {
        log(`Участник не найден, удаление будет идемпотентным: userId=${userId}`);
      }

      // КРИТИЧНО: Используем try-finally для гарантированной финализации контекстов
      try {
        // Удаляем участника через утилиту (она удалит UserDialogStats, UserDialogActivity и обновит счетчики)
        // КРИТИЧНО: Удаляем даже если member не найден (idempotent операция)
        log(`Удаление участника через утилиту: userId=${userId}, dialogId=${dialog.dialogId}`);
        await dialogMemberUtils.removeDialogMember(
          req.tenantId,
          userId,
          dialog.dialogId,
          sourceEventId,
          'dialog.member.remove',
          req.apiKey?.name || 'unknown',
          'api'
        );
        log(`Участник удален через утилиту`);

        // Обновление dialogCount (уменьшаем на 1) только если member существовал
        if (member && sourceEventId) {
          log(`Обновление счетчика dialogCount: userId=${userId}, delta=-1`);
          await updateUserStatsDialogCount(
            req.tenantId,
            userId,
            -1, // delta
            'dialog.member.remove',
            sourceEventId,
            req.apiKey?.name || 'unknown',
            'api'
          );
          log(`Счетчик dialogCount обновлен`);
        }
      } finally {
        // Создаем user.stats.update после всех изменений счетчиков
        if (sourceEventId) {
          try {
            log(`Финализация контекста обновления счетчиков: userId=${userId}, eventId=${sourceEventId}`);
            await finalizeCounterUpdateContext(req.tenantId, userId, sourceEventId);
            log(`Контекст финализирован`);
          } catch (error) {
            log(`Ошибка финализации контекста для ${userId}:`, error);
          }
        }
      }

      log(`Отправка успешного ответа: userId=${userId}, dialogId=${dialogId}`);
      res.json({
        message: 'Member removed from dialog successfully'
      });
    } catch (error) {
      log(`Ошибка обработки запроса:`, error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  async setUnreadCount(req, res) {
    const routePath = '/:dialogId/members/:userId/unread';
    const log = (...args) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { dialogId, userId } = req.params;
      // eslint-disable-next-line no-unused-vars
      const { unreadCount, lastSeenAt, reason } = req.body;
      log(`Получены параметры: dialogId=${dialogId}, userId=${userId}, unreadCount=${unreadCount}, lastSeenAt=${lastSeenAt}`);

      log(`Поиск диалога: dialogId=${dialogId}, tenantId=${req.tenantId}`);
      const dialog = await Dialog.findOne({ dialogId, tenantId: req.tenantId });
      if (!dialog) {
        log(`Диалог не найден: dialogId=${dialogId}`);
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }
      log(`Диалог найден: dialogId=${dialog.dialogId}`);

      const memberFilter = {
        tenantId: req.tenantId,
        dialogId: dialog.dialogId,
        userId
      };

      log(`Поиск участника: userId=${userId}, dialogId=${dialog.dialogId}`);
      const existingMember = await DialogMember.findOne(memberFilter).lean();
      if (!existingMember) {
        log(`Участник не найден: userId=${userId}`);
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog member not found'
        });
      }
      log(`Участник найден: userId=${userId}`);

      // Получаем текущий unreadCount из UserDialogStats
      log(`Получение текущей статистики: userId=${userId}, dialogId=${dialog.dialogId}`);
      const existingStats = await UserDialogStats.findOne({
        tenantId: req.tenantId,
        dialogId: dialog.dialogId,
        userId
      }).lean();
      const currentUnreadCount = existingStats?.unreadCount || 0;
      log(`Текущий unreadCount: ${currentUnreadCount}, новый unreadCount: ${unreadCount}`);

      if (unreadCount > currentUnreadCount) {
        log(`Ошибка валидации: новый unreadCount (${unreadCount}) больше текущего (${currentUnreadCount})`);
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Unread count cannot be greater than current unread count'
        });
      }

      const timestamp = generateTimestamp();
      let lastSeenAtValue = null;

      if (typeof lastSeenAt === 'number') {
        lastSeenAtValue = lastSeenAt;
      } else if (unreadCount < currentUnreadCount) {
        lastSeenAtValue = timestamp;
      }

      // Обновляем lastSeenAt в UserDialogActivity, если нужно
      if (lastSeenAtValue !== null) {
        log(`Обновление lastSeenAt: userId=${userId}, lastSeenAt=${lastSeenAtValue}`);
        await UserDialogActivity.findOneAndUpdate(
          {
            tenantId: req.tenantId,
            userId,
            dialogId: dialog.dialogId
          },
          { lastSeenAt: lastSeenAtValue },
          { upsert: true, new: true }
        );
        log(`lastSeenAt обновлен`);
      }

      // Получаем или создаем активность
      log(`Получение/создание активности: userId=${userId}, dialogId=${dialog.dialogId}`);
      let updatedActivity = await UserDialogActivity.findOne({
        tenantId: req.tenantId,
        userId,
        dialogId: dialog.dialogId
      }).lean();
      
      // Если активности нет, создаем её с дефолтными значениями
      if (!updatedActivity) {
        log(`Активность не найдена, создание с дефолтными значениями`);
        const defaultTimestamp = generateTimestamp();
        updatedActivity = await UserDialogActivity.findOneAndUpdate(
          {
            tenantId: req.tenantId,
            userId,
            dialogId: dialog.dialogId
          },
          {
            tenantId: req.tenantId,
            userId,
            dialogId: dialog.dialogId,
            lastSeenAt: defaultTimestamp,
            lastMessageAt: defaultTimestamp
          },
          { upsert: true, new: true }
        ).lean();
        log(`Активность создана`);
      } else {
        log(`Активность найдена`);
      }

      // Обновляем unreadCount в UserDialogStats
      const delta = unreadCount - currentUnreadCount;
      log(`Вычислен delta для unreadCount: ${delta}`);
      if (delta !== 0) {
        log(`Обновление unreadCount требуется: delta=${delta}`);
        // Создаем событие для обновления счетчиков
        log(`Создание события для обновления счетчиков: eventType=dialog.member.update`);
        const eventId = await eventUtils.createEvent({
          tenantId: req.tenantId,
          eventType: 'dialog.member.update',
          entityType: 'dialogMember',
          entityId: `${dialog.dialogId}:${userId}`,
          actorId: req.apiKey?.name || 'unknown',
          actorType: 'api',
          data: {}
        });
        const sourceEventId = eventId?.eventId || null;
        log(`Событие создано: eventId=${sourceEventId}`);

        try {
          log(`Обновление unreadCount: userId=${userId}, dialogId=${dialog.dialogId}, delta=${delta}`);
          await updateUnreadCount(
            req.tenantId,
            userId,
            dialog.dialogId,
            delta,
            'dialog.member.update',
            sourceEventId,
            dialog.dialogId,
            req.apiKey?.name || 'unknown',
            'api'
          );
          log(`unreadCount обновлен`);
          log(`Финализация контекста обновления счетчиков: userId=${userId}, eventId=${sourceEventId}`);
          await finalizeCounterUpdateContext(req.tenantId, userId, sourceEventId);
          log(`Контекст финализирован`);
        } catch (error) {
          log(`Ошибка обновления unreadCount:`, error);
        }
      } else {
        log(`Обновление unreadCount не требуется: delta=0`);
      }

      // Получаем обновленный unreadCount из UserDialogStats
      log(`Получение обновленной статистики: userId=${userId}, dialogId=${dialog.dialogId}`);
      const updatedStats = await UserDialogStats.findOne({
        tenantId: req.tenantId,
        dialogId: dialog.dialogId,
        userId
      }).lean();
      const finalUnreadCount = updatedStats?.unreadCount || 0;
      log(`Финальный unreadCount: ${finalUnreadCount}`);

      // Получаем метаданные диалога для события
      log(`Получение метаданных диалога для события: dialogId=${dialog.dialogId}`);
      const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialog.dialogId);
      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });
      log(`Метаданные диалога получены`);

      const memberSection = eventUtils.buildMemberSection({
        userId,
        state: {
          unreadCount: finalUnreadCount,
          lastSeenAt: updatedActivity?.lastSeenAt || 0,
          lastMessageAt: updatedActivity?.lastMessageAt || 0,
        }
      });

      const eventContext = eventUtils.buildEventContext({
        eventType: 'dialog.member.update',
        dialogId: dialog.dialogId,
        entityId: `${dialog.dialogId}:${userId}`,
        includedSections: ['dialog', 'member'],
        updatedFields: ['member.state.unreadCount', 'member.state.lastSeenAt']
      });

      log(`Создание финального события: eventType=dialog.member.update, entityId=${dialog.dialogId}:${userId}`);
      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'dialog.member.update',
        entityType: 'dialogMember',
        entityId: `${dialog.dialogId}:${userId}`,
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api',
        data: eventUtils.composeEventData({
          context: eventContext,
          dialog: dialogSection,
          member: memberSection,
          extra: {
            delta: {
              unreadCount: {
                from: currentUnreadCount,
                to: finalUnreadCount
              }
            }
          }
        })
      });
      log(`Финальное событие создано`);

      if (finalUnreadCount === 0) {
        log(`unreadCount=0, планирование задачи чтения диалога: userId=${userId}, dialogId=${dialog.dialogId}`);
        await scheduleDialogReadTask({
          tenantId: req.tenantId,
          dialogId: dialog.dialogId,
          userId,
          readUntil: updatedActivity?.lastSeenAt || 0,
          source: 'api.setUnreadCount'
        });
        log(`Задача чтения диалога запланирована`);
      }

      log(`Отправка успешного ответа: userId=${userId}, dialogId=${dialogId}, unreadCount=${finalUnreadCount}`);
      return res.json({
        data: sanitizeResponse({
          userId: existingMember.userId,
          dialogId: existingMember.dialogId,
          tenantId: existingMember.tenantId,
          unreadCount: finalUnreadCount,
          lastSeenAt: updatedActivity?.lastSeenAt || 0,
          lastMessageAt: updatedActivity?.lastMessageAt || 0
        }),
        message: 'Unread count updated successfully'
      });
    } catch (error) {
      log(`Ошибка обработки запроса:`, error.message);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  }
};

function extractUserIdFromEntityId(entityId) {
  if (typeof entityId !== 'string') {
    return null;
  }
  const parts = entityId.split(':');
  return parts.length === 2 ? parts[1] : null;
}

async function findMemberUserIdsByMeta(tenantId, dialogId, metaFilters) {
  if (!metaFilters || Object.keys(metaFilters).length === 0) {
    return [];
  }

  let matchingUserIds = null;

  for (const [key, condition] of Object.entries(metaFilters)) {
    const baseQuery = {
      tenantId,
      entityType: 'dialogMember',
      key,
      entityId: new RegExp(`^${dialogId}:`)
    };

    const isNegativeOperator =
      typeof condition === 'object' &&
      condition !== null &&
      (Object.prototype.hasOwnProperty.call(condition, '$ne') ||
        Object.prototype.hasOwnProperty.call(condition, '$nin'));

    let candidateUserIds = [];

    if (isNegativeOperator) {
      const allWithKey = await Meta.find(baseQuery).select('entityId value').lean();

      if (Array.isArray(condition.$nin)) {
        const excludeSet = new Set(condition.$nin);
        candidateUserIds = allWithKey
          .filter(record => !excludeSet.has(record.value))
          .map(record => extractUserIdFromEntityId(record.entityId))
          .filter(Boolean);
      } else if (condition.$ne !== undefined) {
        candidateUserIds = allWithKey
          .filter(record => record.value !== condition.$ne)
          .map(record => extractUserIdFromEntityId(record.entityId))
          .filter(Boolean);
      }
    } else {
      const metaRecords = await Meta.find({
        ...baseQuery,
        value: condition
      })
        .select('entityId')
        .lean();

      candidateUserIds = metaRecords
        .map(record => extractUserIdFromEntityId(record.entityId))
        .filter(Boolean);
    }

    if (candidateUserIds.length === 0) {
      return [];
    }

    if (matchingUserIds === null) {
      matchingUserIds = new Set(candidateUserIds);
    } else {
      const currentSet = new Set(candidateUserIds);
      matchingUserIds = new Set(
        Array.from(matchingUserIds).filter(userId => currentSet.has(userId))
      );
    }
  }

  return matchingUserIds ? Array.from(matchingUserIds) : [];
}

export default dialogMemberController;
