import { Tenant, Meta } from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';

// Хелпер для форматирования тенанта без _id и с мета-тегами
const formatTenantResponse = (tenant, meta = null) => {
  const tenantObj = tenant.toObject ? tenant.toObject() : tenant;
   
  const { _id, __v, ...rest } = tenantObj;
  
  // Форматируем createdAt в строку с 6 знаками после точки
  if (rest.createdAt !== undefined) {
    rest.createdAt = rest.createdAt.toFixed(6);
  }
  
  if (meta !== null) {
    return { ...rest, meta };
  }
  return rest;
};

export const tenantController = {
  // Get all tenants (paginated)
  async getAll(req, res) {
    const routePath = 'get /tenants/';
    const log = (...args) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      log(`Получены параметры: page=${page}, limit=${limit}`);

      log(`Поиск тенантов: skip=${skip}, limit=${limit}`);
      const tenants = await Tenant.find()
        .skip(skip)
        .limit(limit)
        .select('-__v -_id');
      log(`Найдено тенантов: ${tenants.length}`);

      const total = await Tenant.countDocuments();
      log(`Всего тенантов: ${total}`);

      // Получаем мета-теги для каждого тенанта
      log(`Получение мета-тегов для ${tenants.length} тенантов`);
      const tenantsWithMeta = await Promise.all(
        tenants.map(async (tenant) => {
          const meta = await metaUtils.getEntityMeta(tenant.tenantId, 'tenant', tenant.tenantId);
          return formatTenantResponse(tenant, meta);
        })
      );
      log(`Мета-теги получены для всех тенантов`);

      log(`Отправка ответа: ${tenantsWithMeta.length} тенантов, страница: ${page}, лимит: ${limit}`);
      res.json({
        data: tenantsWithMeta,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
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

  // Get tenant by tenantId
  async getById(req, res) {
    const routePath = 'get /tenants/:id';
    const log = (...args) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { id } = req.params;
      log(`Получены параметры: id=${id}`);
      
      // Ищем по tenantId, а не по MongoDB _id
      log(`Поиск тенанта: tenantId=${id}`);
      const tenant = await Tenant.findOne({ tenantId: id }).select('-__v -_id');

      if (!tenant) {
        log(`Тенант не найден: tenantId=${id}`);
        return res.status(404).json({
          error: 'Not Found',
          message: `Tenant with tenantId "${id}" not found`
        });
      }
      log(`Тенант найден: tenantId=${tenant.tenantId}`);

      // Получаем мета-теги тенанта
      log(`Получение мета-тегов: tenantId=${tenant.tenantId}`);
      const meta = await metaUtils.getEntityMeta(tenant.tenantId, 'tenant', tenant.tenantId);
      log(`Мета-теги получены: keys=${Object.keys(meta).length}`);

      log(`Отправка ответа: tenantId=${tenant.tenantId}`);
      res.json({ data: formatTenantResponse(tenant, meta) });
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

  // Create new tenant
  async create(req, res) {
    const routePath = 'post /tenants/';
    const log = (...args) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    // Сохраняем исходный tenantId для обработки ошибок
    let attemptedTenantId = null;
    
    try {
      // Извлекаем мета-теги из тела запроса
      const { meta, ...tenantData } = req.body;
      log(`Получены параметры: tenantId=${tenantData.tenantId || 'автогенерация'}, meta=${meta ? 'есть' : 'нет'}`);

      // Нормализуем tenantId если он указан (trim и lowercase, как в схеме)
      // Важно: проверяем не только truthy, но и пустую строку, null, undefined
      // КРИТИЧНО: если tenantId undefined/null/пустая строка, удаляем его полностью,
      // чтобы Mongoose применил default из схемы
      if (tenantData.tenantId !== undefined && tenantData.tenantId !== null) {
        if (typeof tenantData.tenantId === 'string') {
          const normalizedTenantId = tenantData.tenantId.trim().toLowerCase();
          
          // Если после trim tenantId стал пустым, удаляем его для автогенерации
          if (normalizedTenantId) {
            tenantData.tenantId = normalizedTenantId;
            attemptedTenantId = normalizedTenantId;
          } else {
            // Пустая строка после trim - удаляем для автогенерации
            delete tenantData.tenantId;
          }
        } else {
          // Если tenantId не строка, удаляем его (будет использован default)
          delete tenantData.tenantId;
        }
      } else {
        // Если tenantId undefined или null, удаляем его явно
        // чтобы Mongoose применил default из схемы
        delete tenantData.tenantId;
      }
      
      // Проверка уникальности будет выполнена MongoDB через unique index
      // Если tenantId уже существует, MongoDB вернет ошибку 11000

      // Создаем тенант
      // MongoDB проверит уникальность через unique index на tenantId
      log(`Создание тенанта: tenantData=${JSON.stringify(tenantData)}`);
      const tenant = await Tenant.create(tenantData);
      log(`Тенант создан: tenantId=${tenant.tenantId}`);

      // Сохраняем мета-теги в коллекцию Meta, если они были переданы
      if (meta && typeof meta === 'object') {
        log(`Добавление мета-тегов: tenantId=${tenant.tenantId}, keys=${Object.keys(meta).length}`);
        const newTenantId = tenant.tenantId;
        // Для мета-тегов тенанта используем tenantId созданного тенанта
        // как для контекста (первый параметр), так и для entityId (третий параметр)
        const createdBy = req.apiKey?.name || 'api';

        for (const [key, value] of Object.entries(meta)) {
          // Определяем тип данных
          let dataType = 'string';
          if (typeof value === 'number') {
            dataType = 'number';
          } else if (typeof value === 'boolean') {
            dataType = 'boolean';
          } else if (Array.isArray(value)) {
            dataType = 'array';
          } else if (typeof value === 'object' && value !== null) {
            dataType = 'object';
          }

          await metaUtils.setEntityMeta(
            newTenantId,
            'tenant',
            newTenantId,
            key,
            value,
            dataType,
            { createdBy }
          );
        }
        log(`Мета-теги добавлены: tenantId=${tenant.tenantId}`);
      }

      // Формируем ответ с мета-тегами (если они были переданы)
      const responseMeta = meta && typeof meta === 'object' ? meta : {};
      
      log(`Отправка успешного ответа: tenantId=${tenant.tenantId}`);
      res.status(201).json({
        data: formatTenantResponse(tenant, responseMeta),
        message: 'Tenant created successfully'
      });
    } catch (error) {
      log(`Ошибка обработки запроса:`, error.message);
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          details: error.errors
        });
      }
      if (error.code === 11000) {
        // Используем сохраненный attemptedTenantId или пытаемся извлечь из исходного запроса
        const conflictTenantId = attemptedTenantId || (req.body.tenantId ? req.body.tenantId.trim().toLowerCase() : null);
        
        if (conflictTenantId) {
          return res.status(409).json({
            error: 'Conflict',
            message: `Tenant with tenantId "${conflictTenantId}" already exists. Please choose a different tenantId or leave it empty for auto-generation.`
          });
        } else {
          // Если tenantId не был указан, но все равно произошла ошибка уникальности,
          // значит автогенерированный ID совпал с существующим (крайне маловероятно)
          return res.status(409).json({
            error: 'Conflict',
            message: 'Failed to create tenant. The auto-generated tenantId already exists. Please try again or specify a custom tenantId.'
          });
        }
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Delete tenant by tenantId
  async delete(req, res) {
    const routePath = 'delete /tenants/:id';
    const log = (...args) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { id } = req.params;
      log(`Получены параметры: id=${id}`);
      
      // Ищем и удаляем по tenantId, а не по MongoDB _id
      log(`Удаление тенанта: tenantId=${id}`);
      const tenant = await Tenant.findOneAndDelete({ tenantId: id });

      if (!tenant) {
        log(`Тенант не найден: tenantId=${id}`);
        return res.status(404).json({
          error: 'Not Found',
          message: `Tenant with tenantId "${id}" not found`
        });
      }
      log(`Тенант найден и удален: tenantId=${tenant.tenantId}`);

      // Удаляем все мета-теги тенанта
      log(`Удаление мета-тегов: tenantId=${tenant.tenantId}`);
      await Meta.deleteMany({ 
        tenantId: tenant.tenantId, 
        entityType: 'tenant', 
        entityId: tenant.tenantId 
      });
      log(`Мета-теги удалены: tenantId=${tenant.tenantId}`);

      log(`Отправка успешного ответа: tenantId=${tenant.tenantId}`);
      res.json({
        message: 'Tenant deleted successfully',
        tenantId: tenant.tenantId
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
  }
};

