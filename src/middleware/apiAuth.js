import ApiKey from '../models/ApiKey.js';
import Tenant from '../models/Tenant.js';

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
    const tenant = await Tenant.findOne({ tenantId: tenantId, isActive: true });
    
    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Tenant '${tenantId}' not found or inactive`
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

