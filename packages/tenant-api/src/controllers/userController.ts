import { User, Meta, UserStats, UserUnreadBySenderType } from '@chat3/models';
import { PACK_UNREAD_SENDER_TYPES } from '@chat3/utils/packUnreadSenderTypes.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { Response } from 'express';
import { parseFilters, extractMetaFilters, buildFilterQuery } from '../utils/queryParser.js';
import {
  extractStatsFilters,
  buildUserStatsQuery,
  validateSort,
  sortHasStatsKeys
} from '../utils/userStatsFilterUtils.js';
import type { AuthenticatedRequest } from '../middleware/apiAuth.js';

function appendFilterConditions(target: any[], filtersObject: any): void {
  if (!filtersObject || typeof filtersObject !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(filtersObject)) {
    if (key === '$and' && Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry && typeof entry === 'object') {
          target.push(entry);
        }
      });
    } else {
      target.push({ [key]: value });
    }
  }
}

async function findUserIdsByMeta(metaFilters: any, tenantId: string): Promise<string[]> {
  if (!metaFilters || Object.keys(metaFilters).length === 0) {
    return [];
  }

  let matchingIds: Set<string> | null = null;

  for (const [key, condition] of Object.entries(metaFilters)) {
    const metaQuery: any = {
      tenantId,
      entityType: 'user',
      key
    };

    if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
      metaQuery.value = condition;
    } else {
      metaQuery.value = condition;
    }

    const metaRecords = await Meta.find(metaQuery).select('entityId').lean();

    if (!metaRecords || metaRecords.length === 0) {
      return [];
    }

    const ids = metaRecords.map((record: any) => record.entityId.toString());

    if (matchingIds === null) {
      matchingIds = new Set(ids);
    } else {
      const nextMatch = new Set<string>();
      ids.forEach((id) => {
        if (matchingIds!.has(id)) {
          nextMatch.add(id);
        }
      });
      matchingIds = nextMatch;
      if (matchingIds.size === 0) {
        return [];
      }
    }
  }

  return matchingIds ? Array.from(matchingIds) : [];
}

/**
 * Агрегация GET /api/users при наличии stats в фильтре или в sort.
 * Возвращает список пользователей с обогащённым stats в том же формате, что и обычный путь.
 */
async function runGetUsersAggregation(
  tenantId: string,
  finalFilter: any,
  sort: Record<string, 1 | -1>,
  statsFilters: Record<string, unknown> | null,
  skip: number,
  limit: number,
  log: (...args: any[]) => void
): Promise<{ list: any[]; total: number }> {
  const sortStage: Record<string, 1 | -1> = {};
  for (const [key, value] of Object.entries(sort)) {
    const pipelineKey = key.startsWith('stats.') ? key.slice(6) : key;
    sortStage[pipelineKey] = value as 1 | -1;
  }

  const pipeline: any[] = [
    { $match: finalFilter },
    {
      $lookup: {
        from: 'userstats',
        let: { uid: '$userId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$tenantId', tenantId] }, { $eq: ['$userId', '$$uid'] }]
              }
            }
          }
        ],
        as: 'statsDoc'
      }
    },
    { $unwind: { path: '$statsDoc', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        dialogCount: { $ifNull: ['$statsDoc.dialogCount', 0] },
        unreadDialogsCount: { $ifNull: ['$statsDoc.unreadDialogsCount', 0] },
        totalUnreadCount: { $ifNull: ['$statsDoc.totalUnreadCount', 0] },
        totalMessagesCount: { $ifNull: ['$statsDoc.totalMessagesCount', 0] }
      }
    }
  ];

  if (statsFilters && Object.keys(statsFilters).length > 0) {
    pipeline.push({ $match: statsFilters });
  }

  pipeline.push(
    { $sort: sortStage },
    {
      $facet: {
        count: [{ $count: 'n' }],
        data: [{ $skip: skip }, { $limit: limit }]
      }
    }
  );

  const result = await User.aggregate(pipeline);
  const countDoc = result[0]?.count?.[0];
  const total = countDoc?.n ?? 0;
  const data = result[0]?.data ?? [];
  log(`Aggregation path: ${data.length} users, total=${total}`);

  if (data.length === 0) {
    return { list: [], total };
  }

  const userIds = data.map((d: any) => d.userId);
  const unreadBySenderRows = await UserUnreadBySenderType.find({
    tenantId,
    userId: { $in: userIds }
  })
    .select('userId fromType countUnread')
    .lean();

  const unreadByUser = new Map<string, Array<{ fromType: string; countUnread: number }>>();
  for (const uid of userIds) {
    unreadByUser.set(uid, PACK_UNREAD_SENDER_TYPES.map((ft) => ({ fromType: ft, countUnread: 0 })));
  }
  for (const row of unreadBySenderRows as Array<{ userId: string; fromType: string; countUnread: number }>) {
    const arr = unreadByUser.get(row.userId);
    if (arr) {
      const entry = arr.find((e) => e.fromType === row.fromType);
      if (entry) entry.countUnread = row.countUnread;
    }
  }

  const list = data.map((doc: any) => {
    const { statsDoc, dialogCount, unreadDialogsCount, totalUnreadCount, totalMessagesCount, ...user } = doc;
    const unreadBySenderType = unreadByUser.get(user.userId) ?? PACK_UNREAD_SENDER_TYPES.map((ft) => ({ fromType: ft, countUnread: 0 }));
    const totalUnread = unreadBySenderType.reduce((s: number, x: any) => s + x.countUnread, 0);
    user.stats = {
      dialogCount: dialogCount ?? 0,
      unreadDialogsCount: unreadDialogsCount ?? 0,
      totalUnreadCount: totalUnread,
      totalMessagesCount: totalMessagesCount ?? 0,
      unreadBySenderType
    };
    return user;
  });

  return { list, total };
}

/**
 * Получить список всех пользователей
 * GET /api/users
 */
export async function getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const routePath = 'get /users/';
  const log = (...args: any[]) => {
    console.log(`[${routePath}]`, ...args);
  }
  log('>>>>> start');
  
  try {
    // Парсим фильтры из query
    let parsedFilters: any = {};
    if (req.query.filter) {
      const rawFilter = String(req.query.filter);
      log(`Парсинг фильтров: filter=${rawFilter}`);
      try {
        parsedFilters = parseFilters(rawFilter);
      } catch (error: any) {
        log(`Ошибка парсинга фильтров: ${error.message}`);
        res.status(400).json({
          error: 'Bad Request',
          message: `Invalid filter format. ${error.message}`
        });
        return;
      }

      if (!parsedFilters || Object.keys(parsedFilters).length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid filter format. No valid conditions were parsed.'
        });
        return;
      }
    }

    const extracted = extractMetaFilters(parsedFilters);
    let sort: Record<string, 1 | -1> = { createdAt: -1 };
    if (req.query.sort) {
      try {
        sort = JSON.parse(String(req.query.sort)) as Record<string, 1 | -1>;
      } catch (_e) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid sort format. Expected JSON object (e.g. {"createdAt":-1})'
        });
        return;
      }
      const sortError = validateSort(sort);
      if (sortError) {
        res.status(400).json({ error: 'Bad Request', message: sortError });
        return;
      }
    }
    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 50;
    log(`Получены параметры: page=${page}, limit=${limit}, sort=${JSON.stringify(sort)}, filter=${req.query.filter || 'нет'}`);

    const andConditions: any[] = [{ tenantId: req.tenantId! }];
    let statsFilters: Record<string, unknown> | null = null;

    if ('branches' in extracted) {
      const filterQuery = await buildFilterQuery(req.tenantId!, 'user', parsedFilters);
      andConditions.push(filterQuery);
    } else {
      const { metaFilters, regularFilters } = extracted;
      const { statsFilters: extractedStats, rest } = extractStatsFilters(regularFilters || {});
      statsFilters = extractedStats;
      if (rest && Object.keys(rest).length > 0) {
        appendFilterConditions(andConditions, rest);
      }
      if (metaFilters && Object.keys(metaFilters).length > 0) {
        log(`Поиск пользователей по мета-фильтрам: metaFilters=${JSON.stringify(metaFilters)}`);
        const userIdsFromMeta = await findUserIdsByMeta(metaFilters, req.tenantId!);
        if (!userIdsFromMeta || userIdsFromMeta.length === 0) {
          log(`Нет пользователей, соответствующих мета-фильтрам`);
          res.json({
            data: [],
            pagination: {
              page,
              limit,
              total: 0,
              pages: 0
            }
          });
          return;
        }
        log(`Найдено пользователей по мета-фильтрам: ${userIdsFromMeta.length}`);
        andConditions.push({ userId: { $in: userIdsFromMeta } });
      }
    }

    const useAggregation = statsFilters !== null || sortHasStatsKeys(sort);

    if (!useAggregation && statsFilters !== null) {
      const statsQuery = buildUserStatsQuery(req.tenantId!, statsFilters);
      const statsDocs = await UserStats.find(statsQuery as any).select('userId').lean();
      const userIds = (statsDocs as { userId: string }[]).map((d) => d.userId);
      log(`Stats filter applied: ${userIds.length} userIds from UserStats`);
      if (userIds.length === 0) {
        res.json({
          data: [],
          pagination: { page, limit, total: 0, pages: 0 }
        });
        return;
      }
      andConditions.push({ userId: { $in: userIds } });
    }

    const finalFilter = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };
    const skip = (page - 1) * limit;

    if (useAggregation) {
      const result = await runGetUsersAggregation(req.tenantId!, finalFilter, sort, statsFilters, skip, limit, log);
      res.json({
        data: result.list.map((u: any) => sanitizeResponse(u)),
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit)
        }
      });
      return;
    }

    // Подсчитываем общее количество
    log(`Выполнение запроса пользователей: skip=${skip}, limit=${limit}`);
    const total = await User.countDocuments(finalFilter);

    // Получаем пользователей с пагинацией
    const users = await User.find(finalFilter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    log(`Найдено пользователей: ${users.length} из ${total}`);

    // Всегда вычисляем количество диалогов для каждого пользователя
    if (users.length > 0) {
      const userIds = users.map((user: any) => user.userId);
      log(`Получение статистики для ${userIds.length} пользователей`);

      const [userStatsList, unreadBySenderRows] = await Promise.all([
        UserStats.find({ tenantId: req.tenantId!, userId: { $in: userIds } }).lean(),
        UserUnreadBySenderType.find({ tenantId: req.tenantId!, userId: { $in: userIds } })
          .select('userId fromType countUnread')
          .lean()
      ]);
      log(`Статистика получена для ${userStatsList.length} пользователей`);

      const unreadByUser = new Map<string, Array<{ fromType: string; countUnread: number }>>();
      for (const uid of userIds) {
        unreadByUser.set(uid, PACK_UNREAD_SENDER_TYPES.map((ft) => ({ fromType: ft, countUnread: 0 })));
      }
      for (const row of unreadBySenderRows as Array<{ userId: string; fromType: string; countUnread: number }>) {
        const arr = unreadByUser.get(row.userId);
        if (arr) {
          const entry = arr.find((e) => e.fromType === row.fromType);
          if (entry) entry.countUnread = row.countUnread;
        }
      }

      const statsByUser = new Map(
        userStatsList.map((stats: any) => {
          const unreadBySenderType = unreadByUser.get(stats.userId) ?? PACK_UNREAD_SENDER_TYPES.map((ft) => ({ fromType: ft, countUnread: 0 }));
          const totalUnreadCount = unreadBySenderType.reduce((s, x) => s + x.countUnread, 0);
          return [
            stats.userId,
            {
              dialogCount: stats.dialogCount || 0,
              unreadDialogsCount: stats.unreadDialogsCount || 0,
              totalUnreadCount,
              totalMessagesCount: stats.totalMessagesCount || 0,
              unreadBySenderType
            }
          ];
        })
      );

      users.forEach((user: any) => {
        const stats = statsByUser.get(user.userId) || {
          dialogCount: 0,
          unreadDialogsCount: 0,
          totalUnreadCount: 0,
          totalMessagesCount: 0,
          unreadBySenderType: PACK_UNREAD_SENDER_TYPES.map((ft) => ({ fromType: ft, countUnread: 0 }))
        };
        user.stats = stats;
      });
    } else {
      users.forEach((user: any) => {
        user.stats = {
          dialogCount: 0,
          unreadDialogsCount: 0,
          totalUnreadCount: 0,
          totalMessagesCount: 0,
          unreadBySenderType: PACK_UNREAD_SENDER_TYPES.map((ft) => ({ fromType: ft, countUnread: 0 }))
        };
      });
    }

    log(`Отправка ответа: ${users.length} пользователей, страница: ${page}, лимит: ${limit}`);
    res.json({
      data: users.map((user: any) => sanitizeResponse(user)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    log(`Ошибка обработки запроса:`, error.message);
    console.error('Error in getUsers:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  } finally {
    log('>>>>> end');
  }
}

/**
 * Получить пользователя по userId
 * GET /api/users/:userId
 */
export async function getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const routePath = 'get /users/:userId';
  const log = (...args: any[]) => {
    console.log(`[${routePath}]`, ...args);
  }
  log('>>>>> start');
  
  try {
    const { userId } = req.params;
    log(`Получены параметры: userId=${userId}, tenantId=${req.tenantId}`);

    log(`Поиск пользователя: userId=${userId}, tenantId=${req.tenantId}`);
    const user = await User.findOne({
      userId: userId,
      tenantId: req.tenantId!
    }).lean();

    // Получаем метаданные пользователя (даже если пользователя нет в User модели)
    log(`Получение метаданных пользователя: userId=${userId}`);
    const userMeta = await metaUtils.getEntityMeta(req.tenantId!, 'user', userId);

    if (!user) {
      log(`Пользователь не найден в User модели: userId=${userId}`);
      // Fallback: если пользователя нет в User модели, но есть meta теги, возвращаем их
      if (userMeta && Object.keys(userMeta).length > 0) {
        log(`Найдены мета-теги для пользователя: userId=${userId}`);
        const [userStats, unreadRows] = await Promise.all([
          UserStats.findOne({ tenantId: req.tenantId!, userId }).lean(),
          UserUnreadBySenderType.find({ tenantId: req.tenantId!, userId }).select('fromType countUnread').lean()
        ]);
        const unreadBySenderType = PACK_UNREAD_SENDER_TYPES.map((ft) => ({
          fromType: ft,
          countUnread: (unreadRows as Array<{ fromType: string; countUnread: number }>).find((r) => r.fromType === ft)?.countUnread ?? 0
        }));
        const totalUnreadCount = unreadBySenderType.reduce((s, x) => s + x.countUnread, 0);
        const stats = userStats
          ? {
              dialogCount: userStats.dialogCount || 0,
              unreadDialogsCount: userStats.unreadDialogsCount || 0,
              totalUnreadCount,
              totalMessagesCount: userStats.totalMessagesCount || 0,
              unreadBySenderType
            }
          : {
              dialogCount: 0,
              unreadDialogsCount: 0,
              totalUnreadCount,
              totalMessagesCount: 0,
              unreadBySenderType
            };

        log(`Отправка ответа с мета-тегами: userId=${userId}`);
        res.json({
          data: sanitizeResponse({
            userId: userId,
            tenantId: req.tenantId!,
            createdAt: null,
            meta: userMeta,
            stats: stats
          })
        });
        return;
      }
      
      // Пользователя нет и мета-тегов нет
      log(`Пользователь не найден и мета-тегов нет: userId=${userId}`);
      res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
      return;
    }
    log(`Пользователь найден: userId=${userId}`);

    // Получаем статистику из UserStats и UserUnreadBySenderType
    log(`Получение статистики пользователя: userId=${userId}`);
    const [userStats, unreadRows] = await Promise.all([
      UserStats.findOne({ tenantId: req.tenantId!, userId }).lean(),
      UserUnreadBySenderType.find({ tenantId: req.tenantId!, userId }).select('fromType countUnread').lean()
    ]);
    const unreadBySenderType = PACK_UNREAD_SENDER_TYPES.map((ft) => ({
      fromType: ft,
      countUnread: (unreadRows as Array<{ fromType: string; countUnread: number }>).find((r) => r.fromType === ft)?.countUnread ?? 0
    }));
    const totalUnreadCount = unreadBySenderType.reduce((s, x) => s + x.countUnread, 0);
    const stats = userStats
      ? {
          dialogCount: userStats.dialogCount || 0,
          unreadDialogsCount: userStats.unreadDialogsCount || 0,
          totalUnreadCount,
          totalMessagesCount: userStats.totalMessagesCount || 0,
          unreadBySenderType
        }
      : {
          dialogCount: 0,
          unreadDialogsCount: 0,
          totalUnreadCount,
          totalMessagesCount: 0,
          unreadBySenderType
        };

    // Пользователь существует, обогащаем мета-тегами и данными о диалогах
    const enrichedUser = {
      ...user,
      meta: userMeta,
      stats: stats
    };

    log(`Отправка ответа: userId=${userId}`);
    res.json({
      data: sanitizeResponse(enrichedUser)
    });
  } catch (error: any) {
    log(`Ошибка обработки запроса:`, error.message);
    console.error('Error in getUserById:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  } finally {
    log('>>>>> end');
  }
}

/**
 * Создать нового пользователя
 * POST /api/users
 */
export async function createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const routePath = 'post /users/';
  const log = (...args: any[]) => {
    console.log(`[${routePath}]`, ...args);
  }
  log('>>>>> start');
  
  try {
    const { userId, type } = req.body as { userId?: string; type?: string };
    log(`Получены параметры: userId=${userId}, type=${type || 'user'}, tenantId=${req.tenantId}`);

    // Проверяем, что пользователь не существует
    log(`Проверка существования пользователя: userId=${userId}`);
    const existingUser = await User.findOne({
      userId: userId!,
      tenantId: req.tenantId!
    });

    if (existingUser) {
      log(`Пользователь уже существует: userId=${userId}`);
      res.status(409).json({
        error: 'Conflict',
        message: 'User already exists'
      });
      return;
    }

    // Создаем пользователя
    log(`Создание пользователя: userId=${userId}, type=${type || 'user'}`);
    const user = await User.create({
      userId: userId!,
      tenantId: req.tenantId!,
      type: type || 'user'
    });
    log(`Пользователь создан: userId=${user.userId}`);

    // Получаем мета-теги пользователя
    log(`Получение мета-тегов пользователя: userId=${userId}`);
    const userMeta = await metaUtils.getEntityMeta(req.tenantId!, 'user', userId!);

    // Создаем событие user.add
    log(`Создание события user.add: userId=${userId}`);
    const userSection = eventUtils.buildUserSection({
      userId: user.userId,
      type: user.type,
      meta: userMeta || {}
    });

    const userContext = eventUtils.buildEventContext({
      eventType: 'user.add',
      entityId: userId!,
      includedSections: ['user']
    });

    await eventUtils.createEvent({
      tenantId: req.tenantId!,
      eventType: 'user.add',
      entityType: 'user',
      entityId: userId!,
      actorId: userId!,
      actorType: 'user',
      data: eventUtils.composeEventData({
        context: userContext,
        user: userSection
      })
    });

    log(`Отправка успешного ответа: userId=${userId}`);
    res.status(201).json({
      data: sanitizeResponse(user.toObject())
    });
  } catch (error: any) {
    log(`Ошибка обработки запроса:`, error.message);
    console.error('Error in createUser:', error);
    
    if (error.code === 11000) {
      res.status(409).json({
        error: 'Conflict',
        message: 'User already exists'
      });
      return;
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  } finally {
    log('>>>>> end');
  }
}

/**
 * Обновить пользователя
 * PUT /api/users/:userId
 */
export async function updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const routePath = 'put /users/:userId';
  const log = (...args: any[]) => {
    console.log(`[${routePath}]`, ...args);
  }
  log('>>>>> start');
  
  try {
    const { userId } = req.params;
    const { type } = req.body as { type?: string };
    log(`Получены параметры: userId=${userId}, type=${type || 'нет'}, tenantId=${req.tenantId}`);

    log(`Поиск пользователя: userId=${userId}, tenantId=${req.tenantId}`);
    const user = await User.findOne({
      userId: userId,
      tenantId: req.tenantId!
    });

    if (!user) {
      log(`Пользователь не найден: userId=${userId}`);
      res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
      return;
    }
    log(`Пользователь найден: userId=${user.userId}, текущий type=${user.type}`);

    // Формируем объект обновления
    const updateData: any = {};
    if (type !== undefined) {
      updateData.type = type;
    }

    // Используем updateOne для явного обновления, затем загружаем обновленного пользователя
    log(`Обновление пользователя: userId=${userId}, updateData=${JSON.stringify(updateData)}`);
    const updateResult = await User.updateOne(
      {
        userId: userId,
        tenantId: req.tenantId!
      },
      { $set: updateData }
    );

    if (updateResult.matchedCount === 0) {
      log(`Пользователь не найден при обновлении: userId=${userId}`);
      res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
      return;
    }
    log(`Пользователь обновлен: userId=${userId}, modifiedCount=${updateResult.modifiedCount}`);

    // Загружаем обновленного пользователя
    const updatedUser = await User.findOne({
      userId: userId,
      tenantId: req.tenantId!
    }).lean();

    if (!updatedUser) {
      log(`Пользователь не найден после обновления: userId=${userId}`);
      res.status(404).json({
        error: 'Not Found',
        message: 'User not found after update'
      });
      return;
    }

    // Получаем мета-теги пользователя
    log(`Получение мета-тегов пользователя: userId=${userId}`);
    const userMeta = await metaUtils.getEntityMeta(req.tenantId!, 'user', userId);

    // Создаем событие user.update
    const userSection = eventUtils.buildUserSection({
      userId: updatedUser.userId,
      type: updatedUser.type,
      meta: userMeta || {}
    });

    const updatedFields: string[] = [];
    if (type !== undefined && type !== user.type) {
      updatedFields.push('user.type');
    }

    const userContext = eventUtils.buildEventContext({
      eventType: 'user.update',
      entityId: userId,
      includedSections: ['user'],
      updatedFields: updatedFields.length > 0 ? updatedFields : ['user']
    });

    log(`Создание события user.update: userId=${userId}`);
    await eventUtils.createEvent({
      tenantId: req.tenantId!,
      eventType: 'user.update',
      entityType: 'user',
      entityId: userId,
      actorId: userId,
      actorType: 'user',
      data: eventUtils.composeEventData({
        context: userContext,
        user: userSection
      })
    });

    log(`Отправка успешного ответа: userId=${userId}`);
    res.json({
      data: sanitizeResponse(updatedUser)
    });
  } catch (error: any) {
    log(`Ошибка обработки запроса:`, error.message);
    console.error('Error in updateUser:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  } finally {
    log('>>>>> end');
  }
}

/**
 * Удалить пользователя
 * DELETE /api/users/:userId
 */
export async function deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const routePath = 'delete /users/:userId';
  const log = (...args: any[]) => {
    console.log(`[${routePath}]`, ...args);
  }
  log('>>>>> start');
  
  try {
    const { userId } = req.params;
    log(`Получены параметры: userId=${userId}, tenantId=${req.tenantId}`);

    // Получаем мета-теги пользователя перед удалением
    log(`Получение мета-тегов пользователя перед удалением: userId=${userId}`);
    const userMeta = await metaUtils.getEntityMeta(req.tenantId!, 'user', userId);

    log(`Удаление пользователя: userId=${userId}`);
    const user = await User.findOneAndDelete({
      userId: userId,
      tenantId: req.tenantId!
    });

    if (!user) {
      log(`Пользователь не найден: userId=${userId}`);
      res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
      return;
    }
    log(`Пользователь найден и удален: userId=${user.userId}`);

    // Создаем событие user.remove
    log(`Создание события user.remove: userId=${userId}`);
    const userSection = eventUtils.buildUserSection({
      userId: user.userId,
      type: user.type,
      meta: userMeta || {}
    });

    const userContext = eventUtils.buildEventContext({
      eventType: 'user.remove',
      entityId: userId,
      includedSections: ['user']
    });

    await eventUtils.createEvent({
      tenantId: req.tenantId!,
      eventType: 'user.remove',
      entityType: 'user',
      entityId: userId,
      actorId: userId,
      actorType: 'user',
      data: eventUtils.composeEventData({
        context: userContext,
        user: userSection
      })
    });

    log(`Отправка успешного ответа: userId=${userId}`);
    res.status(204).send();
  } catch (error: any) {
    log(`Ошибка обработки запроса:`, error.message);
    console.error('Error in deleteUser:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  } finally {
    log('>>>>> end');
  }
}

