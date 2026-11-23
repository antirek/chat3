import { Request, Response, NextFunction } from 'express';
import {
  authenticateApiKey,
  assertPermission,
  isAppServiceError,
  appServiceErrorToHttpStatus,
  appServiceErrorToHttpBody
} from '@chat3/app-services';
import { setAuthMetricFromError } from './requestMetrics.js';

// Расширяем Request для добавления кастомных полей
export interface AuthenticatedRequest extends Request {
  apiKey?: any;
  tenantId?: string;
  tenant?: any;
  tenantObjectId?: any;
  userId?: string; // Для некоторых контроллеров
}

function sendAuthError(
  req: AuthenticatedRequest,
  res: Response,
  error: unknown,
  permission?: string
): void {
  setAuthMetricFromError(req, error, permission);
  if (isAppServiceError(error)) {
    res.status(appServiceErrorToHttpStatus(error)).json(appServiceErrorToHttpBody(error));
    return;
  }
  console.error('API Auth error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Authentication failed'
  });
}

export const apiAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ctx = await authenticateApiKey({
      apiKey: req.headers['x-api-key'] as string | undefined,
      tenantId: req.headers['x-tenant-id'] as string | undefined
    });

    req.apiKey = ctx.apiKey;
    req.tenantId = ctx.tenantId;
    req.tenant = ctx.tenant;
    req.tenantObjectId = ctx.tenantObjectId;

    next();
  } catch (error: any) {
    sendAuthError(req, res, error);
  }
};

// Check specific permission
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      assertPermission(req.apiKey, permission);
      next();
    } catch (error: any) {
      sendAuthError(req, res, error, permission);
    }
  };
};

// Middleware для создания тенанта - требует только валидный API ключ, запрещает X-Tenant-Id
export const apiAuthForTenantCreation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantIdHeader =
      req.headers['x-tenant-id'] ||
      req.headers['X-Tenant-Id'] ||
      req.headers['X-Tenant-ID'] ||
      req.headers['X-TENANT-ID'];

    if (tenantIdHeader) {
      console.log('⚠️  Tenant creation blocked: X-Tenant-Id header detected:', tenantIdHeader);
    }

    const ctx = await authenticateApiKey({
      apiKey: req.headers['x-api-key'] as string | undefined,
      tenantId: tenantIdHeader as string | undefined,
      skipTenant: true,
      forbidTenantHeader: true
    });

    assertPermission(ctx.apiKey, 'write');

    req.apiKey = ctx.apiKey;
    next();
  } catch (error: any) {
    if (isAppServiceError(error) && error.code === 'FORBIDDEN') {
      setAuthMetricFromError(req, error, 'write');
      res.status(403).json({
        error: 'Forbidden',
        message: 'Permission "write" is required to create tenants'
      });
      return;
    }
    sendAuthError(req, res, error);
  }
};
