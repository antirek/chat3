import { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/apiAuth.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import {
  loadDefinitions,
  registerDefinition,
  deleteDefinition,
  type IndexDefinitionSpec
} from '@chat3/utils/metaIndexUtils.js';
import type { MetaEntityType } from '@chat3/models';
import { handleMetaIndexError } from '../utils/metaIndexErrorHandler.js';

function parseSpecs(body: Record<string, unknown>): IndexDefinitionSpec[] {
  if (Array.isArray(body.indexes)) {
    return body.indexes as IndexDefinitionSpec[];
  }
  return [{
    keys: body.keys as string[],
    mode: body.mode as 'unique' | 'required',
    id: body.id as string | undefined
  }];
}

const metaIndexController = {
  async listDefinitions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const entityType = req.params.entityType as MetaEntityType;
      const definitions = await loadDefinitions(req.tenantId!, entityType);
      res.json({ data: sanitizeResponse(definitions) });
    } catch (error: unknown) {
      if (handleMetaIndexError(res, error)) {
        return;
      }
      res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
    }
  },

  async getDefinition(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const entityType = req.params.entityType as MetaEntityType;
      const { indexId } = req.params;
      const definitions = await loadDefinitions(req.tenantId!, entityType);
      const found = definitions.find((d) => d.indexId === indexId);
      if (!found) {
        res.status(404).json({ error: 'Not Found', message: `Index definition ${indexId} not found` });
        return;
      }
      res.json({ data: sanitizeResponse(found) });
    } catch (error: unknown) {
      if (handleMetaIndexError(res, error)) {
        return;
      }
      res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
    }
  },

  async registerDefinitions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const entityType = req.params.entityType as MetaEntityType;
      const dryRun = req.query.dryRun === 'true';
      const specs = parseSpecs(req.body as Record<string, unknown>);
      const createdBy = req.apiKey?.name || req.userId || 'api';
      const results = [];

      for (const spec of specs) {
        const result = await registerDefinition(req.tenantId!, entityType, spec, {
          dryRun,
          createdBy
        });
        results.push(result);
      }

      const status = dryRun ? 200 : 201;
      res.status(status).json({
        data: sanitizeResponse(results.length === 1 ? results[0] : results),
        message: dryRun ? 'Dry run passed' : 'Index definition(s) registered'
      });
    } catch (error: unknown) {
      if (handleMetaIndexError(res, error)) {
        return;
      }
      res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
    }
  },

  async deleteDefinition(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const entityType = req.params.entityType as MetaEntityType;
      const { indexId } = req.params;
      const deleted = await deleteDefinition(req.tenantId!, entityType, indexId);
      if (!deleted) {
        res.status(404).json({ error: 'Not Found', message: `Index definition ${indexId} not found` });
        return;
      }
      res.json({ message: 'Index definition deleted' });
    } catch (error: unknown) {
      if (handleMetaIndexError(res, error)) {
        return;
      }
      res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
    }
  }
};

export default metaIndexController;
