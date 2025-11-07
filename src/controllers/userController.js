import User from '../models/User.js';
import * as metaUtils from '../utils/metaUtils.js';
import { sanitizeResponse } from '../utils/responseUtils.js';
import { parseFilters } from '../utils/queryParser.js';
import { generateTimestamp } from '../utils/timestampUtils.js';

/**
 * Получить список всех пользователей
 * GET /api/users
 */
export async function getUsers(req, res) {
  try {
    // Парсим фильтры из query
    const filter = req.query.filter ? parseFilters(req.query.filter) : {};
    const sort = req.query.sort ? JSON.parse(req.query.sort) : { createdAt: -1 };
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    // Добавляем фильтр по tenantId
    const finalFilter = { ...filter, tenantId: req.tenantId };

    const skip = (page - 1) * limit;

    // Подсчитываем общее количество
    const total = await User.countDocuments(finalFilter);

    // Получаем пользователей с пагинацией
    const users = await User.find(finalFilter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

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

