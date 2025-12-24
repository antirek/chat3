import { User, DialogMember, Meta, UserStats } from '../../../models/index.js';
import * as metaUtils from '../utils/metaUtils.js';
import * as eventUtils from '../utils/eventUtils.js';
import { sanitizeResponse } from '../utils/responseUtils.js';
import { parseFilters, extractMetaFilters } from '../utils/queryParser.js';
// eslint-disable-next-line no-unused-vars
import { generateTimestamp } from '../../../utils/timestampUtils.js';

function appendFilterConditions(target, filtersObject) {
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

async function findUserIdsByMeta(metaFilters, tenantId) {
  if (!metaFilters || Object.keys(metaFilters).length === 0) {
    return [];
  }

  let matchingIds = null;

  for (const [key, condition] of Object.entries(metaFilters)) {
    const metaQuery = {
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

    const ids = metaRecords.map((record) => record.entityId.toString());

    if (matchingIds === null) {
      matchingIds = new Set(ids);
    } else {
      const nextMatch = new Set();
      ids.forEach((id) => {
        if (matchingIds.has(id)) {
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
 * Получить список всех пользователей
 * GET /api/users
 */
export async function getUsers(req, res) {
  try {
    // Парсим фильтры из query
    let parsedFilters = {};
    if (req.query.filter) {
      const rawFilter = String(req.query.filter);
      try {
        parsedFilters = parseFilters(rawFilter);
      } catch (error) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid filter format. ${error.message}`
        });
      }

      if (!parsedFilters || Object.keys(parsedFilters).length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid filter format. No valid conditions were parsed.'
        });
      }
    }

    const { metaFilters, regularFilters } = extractMetaFilters(parsedFilters);
    const sort = req.query.sort ? JSON.parse(req.query.sort) : { createdAt: -1 };
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    // Добавляем фильтр по tenantId
    const andConditions = [{ tenantId: req.tenantId }];
    
    // Применяем regularFilters (включая type)
    if (regularFilters && Object.keys(regularFilters).length > 0) {
      appendFilterConditions(andConditions, regularFilters);
    }

    if (metaFilters && Object.keys(metaFilters).length > 0) {
      const userIdsFromMeta = await findUserIdsByMeta(metaFilters, req.tenantId);
      if (!userIdsFromMeta || userIdsFromMeta.length === 0) {
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

      andConditions.push({ userId: { $in: userIdsFromMeta } });
    }

    const finalFilter = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    const skip = (page - 1) * limit;

    // Подсчитываем общее количество
    const total = await User.countDocuments(finalFilter);

    // Получаем пользователей с пагинацией
    const users = await User.find(finalFilter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Всегда вычисляем количество диалогов для каждого пользователя
    if (users.length > 0) {
      const userIds = users.map(user => user.userId);
      
      // Получаем статистику из UserStats
      const { UserStats } = await import('../../../models/index.js');
      const userStatsList = await UserStats.find({
        tenantId: req.tenantId,
        userId: { $in: userIds }
      }).lean();

      const dialogCountsByUser = new Map(
        userStatsList.map((stats) => [
          stats.userId,
          { dialogCount: stats.dialogCount || 0, unreadDialogsCount: stats.unreadDialogsCount || 0 }
        ])
      );

      users.forEach((user) => {
        const counts = dialogCountsByUser.get(user.userId) || { dialogCount: 0, unreadDialogsCount: 0 };
        user.dialogCount = counts.dialogCount;
        user.unreadDialogsCount = counts.unreadDialogsCount;
      });
    } else {
      // Если пользователей нет, устанавливаем нулевые значения
      users.forEach((user) => {
        user.dialogCount = 0;
        user.unreadDialogsCount = 0;
      });
    }

    res.json({
      data: users.map(user => sanitizeResponse(user)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getUsers:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

/**
 * Получить пользователя по userId
 * GET /api/users/:userId
 */
export async function getUserById(req, res) {
  try {
    const { userId } = req.params;

    const user = await User.findOne({
      userId: userId,
      tenantId: req.tenantId
    }).lean();

    // Получаем метаданные пользователя (даже если пользователя нет в User модели)
    const userMeta = await metaUtils.getEntityMeta(req.tenantId, 'user', userId);

    if (!user) {
      // Fallback: если пользователя нет в User модели, но есть meta теги, возвращаем их
      if (userMeta && Object.keys(userMeta).length > 0) {
        // Получаем статистику из UserStats
        const userStats = await UserStats.findOne({
          tenantId: req.tenantId,
          userId: userId
        }).lean();

        const counts = userStats 
          ? { dialogCount: userStats.dialogCount || 0, unreadDialogsCount: userStats.unreadDialogsCount || 0 }
          : { dialogCount: 0, unreadDialogsCount: 0 };

        return res.json({
          data: sanitizeResponse({
            userId: userId,
            tenantId: req.tenantId,
            createdAt: null,
            meta: userMeta,
            dialogCount: counts.dialogCount,
            unreadDialogsCount: counts.unreadDialogsCount
          })
        });
      }
      
      // Пользователя нет и мета-тегов нет
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Получаем статистику из UserStats
    const userStats = await UserStats.findOne({
      tenantId: req.tenantId,
      userId: userId
    }).lean();

    const counts = userStats 
      ? { dialogCount: userStats.dialogCount || 0, unreadDialogsCount: userStats.unreadDialogsCount || 0 }
      : { dialogCount: 0, unreadDialogsCount: 0 };

    // Пользователь существует, обогащаем мета-тегами и данными о диалогах
    const enrichedUser = {
      ...user,
      meta: userMeta,
      dialogCount: counts.dialogCount,
      unreadDialogsCount: counts.unreadDialogsCount
    };

    res.json({
      data: sanitizeResponse(enrichedUser)
    });
  } catch (error) {
    console.error('Error in getUserById:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

/**
 * Создать нового пользователя
 * POST /api/users
 */
export async function createUser(req, res) {
  try {
    const { userId, type } = req.body;

    // Проверяем, что пользователь не существует
    const existingUser = await User.findOne({
      userId: userId,
      tenantId: req.tenantId
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User already exists'
      });
    }

    // Создаем пользователя
    const user = await User.create({
      userId: userId,
      tenantId: req.tenantId,
      type: type || 'user'
    });

    // Получаем мета-теги пользователя
    const userMeta = await metaUtils.getEntityMeta(req.tenantId, 'user', userId);

    // Создаем событие user.add
    const userSection = eventUtils.buildUserSection({
      userId: user.userId,
      type: user.type,
      meta: userMeta || {}
    });

    const userContext = eventUtils.buildEventContext({
      eventType: 'user.add',
      entityId: userId,
      includedSections: ['user']
    });

    await eventUtils.createEvent({
      tenantId: req.tenantId,
      eventType: 'user.add',
      entityType: 'user',
      entityId: userId,
      actorId: userId,
      actorType: 'user',
      data: eventUtils.composeEventData({
        context: userContext,
        user: userSection
      })
    });

    res.status(201).json({
      data: sanitizeResponse(user.toObject())
    });
  } catch (error) {
    console.error('Error in createUser:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User already exists'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

/**
 * Обновить пользователя
 * PUT /api/users/:userId
 */
export async function updateUser(req, res) {
  try {
    const { userId } = req.params;
    const { type } = req.body;

    const user = await User.findOne({
      userId: userId,
      tenantId: req.tenantId
    });

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Формируем объект обновления
    const updateData = {};
    if (type !== undefined) {
      updateData.type = type;
    }

    // Используем updateOne для явного обновления, затем загружаем обновленного пользователя
    const updateResult = await User.updateOne(
      {
        userId: userId,
        tenantId: req.tenantId
      },
      { $set: updateData }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Загружаем обновленного пользователя
    const updatedUser = await User.findOne({
      userId: userId,
      tenantId: req.tenantId
    }).lean();

    if (!updatedUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found after update'
      });
    }

    // Получаем мета-теги пользователя
    const userMeta = await metaUtils.getEntityMeta(req.tenantId, 'user', userId);

    // Создаем событие user.update
    const userSection = eventUtils.buildUserSection({
      userId: updatedUser.userId,
      type: updatedUser.type,
      meta: userMeta || {}
    });

    const updatedFields = [];
    if (type !== undefined && type !== user.type) {
      updatedFields.push('user.type');
    }

    const userContext = eventUtils.buildEventContext({
      eventType: 'user.update',
      entityId: userId,
      includedSections: ['user'],
      updatedFields: updatedFields.length > 0 ? updatedFields : ['user']
    });

    await eventUtils.createEvent({
      tenantId: req.tenantId,
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

    res.json({
      data: sanitizeResponse(updatedUser)
    });
  } catch (error) {
    console.error('Error in updateUser:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

/**
 * Удалить пользователя
 * DELETE /api/users/:userId
 */
export async function deleteUser(req, res) {
  try {
    const { userId } = req.params;

    // Получаем мета-теги пользователя перед удалением
    const userMeta = await metaUtils.getEntityMeta(req.tenantId, 'user', userId);

    const user = await User.findOneAndDelete({
      userId: userId,
      tenantId: req.tenantId
    });

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Создаем событие user.remove
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
      tenantId: req.tenantId,
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

    res.status(204).send();
  } catch (error) {
    console.error('Error in deleteUser:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}


