import { Response } from 'express';
import {
  createTenant,
  getTenant,
  listTenants,
  deleteTenant,
  isAppServiceError,
  appServiceErrorToHttpStatus,
  appServiceErrorToHttpBody
} from '@chat3/app-services';
import type { AuthenticatedRequest } from '../middleware/apiAuth.js';

function formatTenantResponse(tenant: {
  tenantId: string;
  createdAt: number;
  meta?: Record<string, unknown>;
}): any {
  return {
    tenantId: tenant.tenantId,
    createdAt: Number(tenant.createdAt).toFixed(6),
    meta: tenant.meta || {}
  };
}

function sendAppError(res: Response, error: unknown): boolean {
  if (!isAppServiceError(error)) return false;
  res.status(appServiceErrorToHttpStatus(error)).json(appServiceErrorToHttpBody(error));
  return true;
}

export const tenantController = {
  async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /tenants/';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    };
    log('>>>>> start');

    try {
      const page = parseInt(String(req.query.page)) || 1;
      const limit = parseInt(String(req.query.limit)) || 10;
      const sort = req.query.sort ? String(req.query.sort) : null;
      log(`Получены параметры: page=${page}, limit=${limit}, sort=${sort ? 'yes' : 'нет'}`);

      const result = await listTenants({ page, limit, sort });
      log(`Отправка ответа: ${result.data.length} тенантов, страница: ${page}, лимит: ${limit}`);
      res.json({
        data: result.data.map(formatTenantResponse),
        pagination: result.pagination
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      if (sendAppError(res, error)) return;
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /tenants/:id';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    };
    log('>>>>> start');

    try {
      const { id } = req.params;
      log(`Получены параметры: id=${id}`);
      const result = await getTenant({ tenantId: id });
      log(`Отправка ответа: tenantId=${result.tenant.tenantId}`);
      res.json({ data: formatTenantResponse(result.tenant) });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      if (sendAppError(res, error)) return;
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'post /tenants/';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    };
    log('>>>>> start');

    try {
      const { meta, tenantId } = req.body as { meta?: Record<string, unknown>; tenantId?: string };
      log(`Получены параметры: tenantId=${tenantId || 'автогенерация'}, meta=${meta ? 'есть' : 'нет'}`);

      const result = await createTenant({
        tenantId,
        meta,
        createdBy: req.apiKey?.name || 'api'
      });

      log(`Отправка успешного ответа: tenantId=${result.tenant.tenantId}`);
      res.status(201).json({
        data: formatTenantResponse(result.tenant),
        message: 'Tenant created successfully'
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      if (sendAppError(res, error)) return;
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'delete /tenants/:id';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    };
    log('>>>>> start');

    try {
      const { id } = req.params;
      log(`Получены параметры: id=${id}`);
      const result = await deleteTenant({ tenantId: id });
      log(`Отправка успешного ответа: tenantId=${result.tenantId}`);
      res.json({
        message: 'Tenant deleted successfully',
        tenantId: result.tenantId
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      if (sendAppError(res, error)) return;
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  }
};
