import mongoose, { Model, Schema } from 'mongoose';
import {
  Tenant,
  User,
  Dialog,
  Message,
  Meta,
  ApiKey,
  MessageStatus,
  DialogMember,
  Event,
  MessageReaction,
  Update,
  ApiJournal,
  DialogReadTask,
  UserStats,
  UserDialogStats,
  UserDialogActivity,
  MessageReactionStats,
  MessageStatusStats,
  CounterHistory
} from '@chat3/models';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { Request, Response } from 'express';

// Маппинг имен моделей на классы
const MODELS_MAP: Record<string, Model<any>> = {
  'Tenant': Tenant,
  'User': User,
  'Dialog': Dialog,
  'Message': Message,
  'Meta': Meta,
  'ApiKey': ApiKey,
  'MessageStatus': MessageStatus,
  'DialogMember': DialogMember,
  'Event': Event,
  'MessageReaction': MessageReaction,
  'Update': Update,
  'ApiJournal': ApiJournal,
  'DialogReadTask': DialogReadTask,
  'UserStats': UserStats,
  'UserDialogStats': UserDialogStats,
  'UserDialogActivity': UserDialogActivity,
  'MessageReactionStats': MessageReactionStats,
  'MessageStatusStats': MessageStatusStats,
  'CounterHistory': CounterHistory
};

// Группировка моделей по категориям
const MODEL_CATEGORIES: Record<string, string[]> = {
  'Система': ['ApiKey', 'Tenant', 'User'],
  'Чаты': ['Dialog', 'DialogMember', 'Message', 'MessageStatus', 'MessageReaction', 'Meta'],
  'События': ['Event', 'Update'],
  'Журналы': ['ApiJournal', 'DialogReadTask'],
  'Счетчики': ['UserStats', 'UserDialogStats', 'UserDialogActivity', 'MessageReactionStats', 'MessageStatusStats', 'CounterHistory']
};

/**
 * Получить список доступных моделей
 */
export async function getModels(req: Request, res: Response): Promise<void> {
  try {
    const categories: Record<string, Array<{ name: string; collection: string }>> = {};
    
    // Формируем структуру с категориями
    for (const [categoryName, modelNames] of Object.entries(MODEL_CATEGORIES)) {
      categories[categoryName] = modelNames.map(modelName => ({
        name: modelName,
        collection: MODELS_MAP[modelName].collection.name
      }));
    }

    res.json({
      data: categories,
      message: 'Models retrieved successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

/**
 * Получить данные модели с пагинацией
 */
export async function getModelData(req: Request, res: Response): Promise<void> {
  try {
    const { modelName } = req.params;
    const { page = '1', limit = '50', filter, sort, sortDirection = 'desc' } = req.query;

    if (!MODELS_MAP[modelName]) {
      res.status(404).json({
        error: 'Not Found',
        message: `Model '${modelName}' not found`
      });
      return;
    }

    const Model = MODELS_MAP[modelName];
    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 50;
    const skip = Math.max(0, (pageNum - 1) * limitNum);

    // Формируем запрос
    let query: any = {};

    // Применяем фильтр по tenantId если он есть в модели
    if (req.query.tenantId) {
      const schema: Schema = Model.schema;
      if (schema.paths.tenantId) {
        query.tenantId = req.query.tenantId;
      }
    }

    // Применяем дополнительные фильтры (простая поддержка)
    if (filter) {
      try {
        const parsedFilter = JSON.parse(String(filter));
        query = { ...query, ...parsedFilter };
      } catch (_e) {
        // Игнорируем ошибки парсинга фильтра
      }
    }

    // Формируем сортировку
    let sortOptions: Record<string, 1 | -1> = {};
    if (sort) {
      const direction = sortDirection === 'asc' ? 1 : -1;
      sortOptions[String(sort)] = direction;
    } else {
      // Сортировка по умолчанию: по _id в обратном порядке (новые первыми)
      sortOptions._id = -1;
    }

    // Выполняем запрос
    const [total, data] = await Promise.all([
      Model.countDocuments(query),
      Model.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    res.json({
      data: sanitizeResponse(data),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      message: 'Model data retrieved successfully'
    });
  } catch (error: any) {
    console.error('Error in getModelData:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

/**
 * Получить одну запись по ID
 */
export async function getModelItem(req: Request, res: Response): Promise<void> {
  try {
    const { modelName, id } = req.params;

    if (!MODELS_MAP[modelName]) {
      res.status(404).json({
        error: 'Not Found',
        message: `Model '${modelName}' not found`
      });
      return;
    }

    const Model = MODELS_MAP[modelName];
    
    let item: any = null;
    
    // Проверяем, является ли id валидным ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id) && 
                            String(new mongoose.Types.ObjectId(id)) === id;
    
    if (isValidObjectId) {
      // Пытаемся найти по _id только если это валидный ObjectId
      try {
        item = await Model.findById(id).lean();
      } catch (_error) {
        // Игнорируем ошибки при поиске по _id
      }
    }
    
    // Если не найдено по _id или id не является ObjectId, пробуем найти по основному полю
    if (!item) {
      const schema: Schema = Model.schema;
      const idFields = ['userId', 'dialogId', 'messageId', 'tenantId', 'key', 'eventId', 'updateId', 'taskId'];
      
      for (const field of idFields) {
        if (schema.paths[field]) {
          try {
            item = await Model.findOne({ [field]: id } as any).lean();
            if (item) break;
          } catch (_error) {
            // Продолжаем поиск по следующему полю
            continue;
          }
        }
      }
    }

    if (!item) {
      res.status(404).json({
        error: 'Not Found',
        message: `Item with id '${id}' not found in model '${modelName}'`
      });
      return;
    }

    res.json({
      data: sanitizeResponse(item),
      message: 'Item retrieved successfully'
    });
  } catch (error: any) {
    console.error('Error in getModelItem:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

/**
 * Создать новую запись
 */
export async function createModelItem(req: Request, res: Response): Promise<void> {
  try {
    const { modelName } = req.params;
    const data = req.body;

    if (!MODELS_MAP[modelName]) {
      res.status(404).json({
        error: 'Not Found',
        message: `Model '${modelName}' not found`
      });
      return;
    }

    const Model = MODELS_MAP[modelName];
    const item = await Model.create(data);

    res.status(201).json({
      data: sanitizeResponse(item.toObject()),
      message: 'Item created successfully'
    });
  } catch (error: any) {
    console.error('Error in createModelItem:', error);
    res.status(400).json({
      error: 'Bad Request',
      message: error.message
    });
  }
}

/**
 * Обновить запись
 */
export async function updateModelItem(req: Request, res: Response): Promise<void> {
  try {
    const { modelName, id } = req.params;
    const data = req.body;

    if (!MODELS_MAP[modelName]) {
      res.status(404).json({
        error: 'Not Found',
        message: `Model '${modelName}' not found`
      });
      return;
    }

    const Model = MODELS_MAP[modelName];
    
    let item: any = null;
    
    // Проверяем, является ли id валидным ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id) && 
                            String(new mongoose.Types.ObjectId(id)) === id;
    
    if (isValidObjectId) {
      // Пытаемся обновить по _id только если это валидный ObjectId
      try {
        item = await Model.findByIdAndUpdate(
          id,
          { $set: data },
          { new: true, runValidators: true }
        ).lean();
      } catch (_error) {
        // Игнорируем ошибки при поиске по _id
      }
    }

    if (!item) {
      // Если не найдено по _id или id не является ObjectId, пробуем найти по основному полю
      const schema: Schema = Model.schema;
      const idFields = ['userId', 'dialogId', 'messageId', 'tenantId', 'key', 'eventId', 'updateId', 'taskId'];
      
      for (const field of idFields) {
        if (schema.paths[field]) {
          try {
            item = await Model.findOneAndUpdate(
              { [field]: id } as any,
              { $set: data },
              { new: true, runValidators: true }
            ).lean();
            if (item) break;
          } catch (_error) {
            // Продолжаем поиск по следующему полю
            continue;
          }
        }
      }
    }

    if (!item) {
      res.status(404).json({
        error: 'Not Found',
        message: `Item with id '${id}' not found in model '${modelName}'`
      });
      return;
    }

    res.json({
      data: sanitizeResponse(item),
      message: 'Item updated successfully'
    });
  } catch (error: any) {
    console.error('Error in updateModelItem:', error);
    res.status(400).json({
      error: 'Bad Request',
      message: error.message
    });
  }
}

/**
 * Удалить запись
 */
export async function deleteModelItem(req: Request, res: Response): Promise<void> {
  try {
    const { modelName, id } = req.params;

    if (!MODELS_MAP[modelName]) {
      res.status(404).json({
        error: 'Not Found',
        message: `Model '${modelName}' not found`
      });
      return;
    }

    const Model = MODELS_MAP[modelName];
    
    let item: any = null;
    
    // Проверяем, является ли id валидным ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id) && 
                            String(new mongoose.Types.ObjectId(id)) === id;
    
    if (isValidObjectId) {
      // Пытаемся удалить по _id только если это валидный ObjectId
      try {
        item = await Model.findByIdAndDelete(id).lean();
      } catch (_error) {
        // Игнорируем ошибки при поиске по _id
      }
    }

    if (!item) {
      // Если не найдено по _id или id не является ObjectId, пробуем найти по основному полю
      const schema: Schema = Model.schema;
      const idFields = ['userId', 'dialogId', 'messageId', 'tenantId', 'key', 'eventId', 'updateId', 'taskId'];
      
      for (const field of idFields) {
        if (schema.paths[field]) {
          try {
            item = await Model.findOneAndDelete({ [field]: id } as any).lean();
            if (item) break;
          } catch (_error) {
            // Продолжаем поиск по следующему полю
            continue;
          }
        }
      }
    }

    if (!item) {
      res.status(404).json({
        error: 'Not Found',
        message: `Item with id '${id}' not found in model '${modelName}'`
      });
      return;
    }

    res.json({
      data: sanitizeResponse(item),
      message: 'Item deleted successfully'
    });
  } catch (error: any) {
    console.error('Error in deleteModelItem:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}
