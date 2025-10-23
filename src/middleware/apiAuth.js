import ApiKey from '../models/ApiKey.js';

export const apiAuth = async (req, res, next) => {
  try {
    // Get API key from header
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required. Please provide it in the X-API-Key header.'
      });
    }

    // Find and validate API key
    const key = await ApiKey.findOne({ key: apiKey }).populate('tenantId');

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

    // Attach key info to request
    req.apiKey = key;
    req.tenantId = key.tenantId._id;
    req.tenant = key.tenantId;

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

