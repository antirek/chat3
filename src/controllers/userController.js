import { User, DialogMember, Meta } from '../models/index.js';
import * as metaUtils from '../utils/metaUtils.js';
import { sanitizeResponse } from '../utils/responseUtils.js';
import { parseFilters, extractMetaFilters } from '../utils/queryParser.js';
import { generateTimestamp } from '../utils/timestampUtils.js';

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
    appendFilterConditions(andConditions, regularFilters);

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

    const includeDialogCount = String(req.query.includeDialogCount).toLowerCase() === 'true';
    let dialogCountsByUser = null;

    if (includeDialogCount && users.length > 0) {
      const userIds = users.map(user => user.userId);
      const aggregationResults = await DialogMember.aggregate([
        {
          $match: {
            tenantId: req.tenantId,
            isActive: true,
            userId: { $in: userIds }
          }
        },
        {
          $group: {
            _id: '$userId',
            dialogCount: { $sum: 1 }
          }
        }
      ]);

      dialogCountsByUser = new Map(
        aggregationResults.map(({ _id, dialogCount }) => [_id, dialogCount])
      );

      users.forEach((user) => {
        const count = dialogCountsByUser.get(user.userId) || 0;
        user.dialogCount = count;
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
        return res.json({
          data: sanitizeResponse({
            userId: userId,
            tenantId: req.tenantId,
            name: null, // Имя отсутствует, так как пользователя нет в User
            lastActiveAt: null,
            createdAt: null,
            updatedAt: null,
            meta: userMeta
          })
        });
      }
      
      // Пользователя нет и мета-тегов нет
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Пользователь существует, обогащаем мета-тегами
    const enrichedUser = {
      ...user,
      meta: userMeta
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
    const { userId, name } = req.body;

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
      name: name,
      lastActiveAt: generateTimestamp()
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
    const { name } = req.body;

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

    // Обновляем поля
    if (name !== undefined) user.name = name;

    await user.save();

    res.json({
      data: sanitizeResponse(user.toObject())
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

    res.status(204).send();
  } catch (error) {
    console.error('Error in deleteUser:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

/**
 * Обновить lastActiveAt для пользователя
 * POST /api/users/:userId/activity
 */
export async function updateUserActivity(req, res) {
  try {
    const { userId } = req.params;

    const user = await User.findOneAndUpdate(
      {
        userId: userId,
        tenantId: req.tenantId
      },
      {
        lastActiveAt: generateTimestamp(),
        updatedAt: generateTimestamp()
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    res.json({
      data: sanitizeResponse(user.toObject())
    });
  } catch (error) {
    console.error('Error in updateUserActivity:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

