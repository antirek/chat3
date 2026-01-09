import { ApiKey, Tenant } from '@chat3/models';

export const apiAuth = async (req, res, next) => {
  try {
    // 1. Get API key from header
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required. Please provide it in the X-API-Key header.'
      });
    }

    // 2. Find and validate API key (без привязки к tenant)
    const key = await ApiKey.findOne({ key: apiKey });

    if (!key) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    if (!key.isValid()) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is expired or inactive'
      });
    }

    // Update last used timestamp
    await key.updateLastUsed();

    // 3. Get tenantId from X-TENANT-ID header or use default
    let tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
      tenantId = 'tnt_default';
    }

    // Normalize tenantId (lowercase, trim)
    tenantId = tenantId.toLowerCase().trim();

    // 4. Validate tenant exists
    const tenant = await Tenant.findOne({ tenantId: tenantId });
    
    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Tenant '${tenantId}' not found`
      });
    }

    // 5. Attach info to request
    req.apiKey = key;
    req.tenantId = tenant.tenantId; // String ID (tnt_XXXXXXXX)
    req.tenant = tenant; // Full tenant object
    req.tenantObjectId = tenant._id; // MongoDB ObjectId для обратной совместимости

    next();
  } catch (error) {
    console.error('API Auth error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};

// Check specific permission
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.apiKey || !req.apiKey.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Permission '${permission}' is required`
      });
    }
    next();
  };
};

// Middleware для создания тенанта - требует только валидный API ключ, запрещает X-Tenant-Id
export const apiAuthForTenantCreation = async (req, res, next) => {
  try {
    // 1. Get API key from header
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required. Please provide it in the X-API-Key header.'
      });
    }

    // 2. Find and validate API key
    const key = await ApiKey.findOne({ key: apiKey });

    if (!key) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    if (!key.isValid()) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is expired or inactive'
      });
    }

    // 3. Проверяем, что заголовок X-Tenant-Id отсутствует
    // Создание тенанта должно происходить вне контекста другого тенанта
    // Express нормализует заголовки в lowercase, но проверяем все варианты для надежности
    const tenantIdHeader = 
      req.headers['x-tenant-id'] || 
      req.headers['X-Tenant-Id'] ||
      req.headers['X-Tenant-ID'] ||
      req.headers['X-TENANT-ID'];
    
    if (tenantIdHeader) {
      console.log('⚠️  Tenant creation blocked: X-Tenant-Id header detected:', tenantIdHeader);
      return res.status(400).json({
        error: 'Bad Request',
        message: 'X-Tenant-Id header is not allowed when creating a tenant. Tenant creation must be performed outside of any tenant context.'
      });
    }
    

    // 4. Проверяем права доступа
    if (!key.permissions.includes('write')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Permission "write" is required to create tenants'
      });
    }

    // 5. Attach API key to request (но НЕ tenantId)
    req.apiKey = key;
    // req.tenantId НЕ устанавливается - создание тенанта вне контекста

    next();
  } catch (error) {
    console.error('API Auth for tenant creation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};

