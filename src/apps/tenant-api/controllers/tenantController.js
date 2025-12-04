import { Tenant, Meta } from '../../../models/index.js';
import * as metaUtils from '../utils/metaUtils.js';

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
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const tenants = await Tenant.find()
        .skip(skip)
        .limit(limit)
        .select('-__v -_id');

      const total = await Tenant.countDocuments();

      // Получаем мета-теги для каждого тенанта
      const tenantsWithMeta = await Promise.all(
        tenants.map(async (tenant) => {
          const meta = await metaUtils.getEntityMeta(tenant.tenantId, 'tenant', tenant.tenantId);
          return formatTenantResponse(tenant, meta);
        })
      );

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
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get tenant by tenantId
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      // Ищем по tenantId, а не по MongoDB _id
      const tenant = await Tenant.findOne({ tenantId: id }).select('-__v -_id');

      if (!tenant) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Tenant with tenantId "${id}" not found`
        });
      }

      // Получаем мета-теги тенанта
      const meta = await metaUtils.getEntityMeta(tenant.tenantId, 'tenant', tenant.tenantId);

      res.json({ data: formatTenantResponse(tenant, meta) });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Create new tenant
  async create(req, res) {
    // Сохраняем исходный tenantId для обработки ошибок
    let attemptedTenantId = null;
    
    try {
      // Извлекаем мета-теги из тела запроса
      const { meta, ...tenantData } = req.body;

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
      const tenant = await Tenant.create(tenantData);

      // Сохраняем мета-теги в коллекцию Meta, если они были переданы
      if (meta && typeof meta === 'object') {
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
      }

      // Формируем ответ с мета-тегами (если они были переданы)
      const responseMeta = meta && typeof meta === 'object' ? meta : {};
      
      res.status(201).json({
        data: formatTenantResponse(tenant, responseMeta),
        message: 'Tenant created successfully'
      });
    } catch (error) {
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
    }
  },

  // Delete tenant by tenantId
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // Ищем и удаляем по tenantId, а не по MongoDB _id
      const tenant = await Tenant.findOneAndDelete({ tenantId: id });

      if (!tenant) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Tenant with tenantId "${id}" not found`
        });
      }

      // Удаляем все мета-теги тенанта
      await Meta.deleteMany({ 
        tenantId: tenant.tenantId, 
        entityType: 'tenant', 
        entityId: tenant.tenantId 
      });

      res.json({
        message: 'Tenant deleted successfully',
        tenantId: tenant.tenantId
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

