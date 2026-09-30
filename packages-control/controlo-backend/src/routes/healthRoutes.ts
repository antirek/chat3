import { Router, Request, Response } from 'express';
import { checkMongo, livenessBody, readinessResult } from '@chat3/utils/httpHealth.js';

const router = Router();

export function createHealthRouter(version?: string): Router {
  function sendLiveness(_req: Request, res: Response): void {
    res.status(200).json(livenessBody(version));
  }

  async function sendReadiness(_req: Request, res: Response): Promise<void> {
    const result = readinessResult({ mongodb: await checkMongo() });
    res.status(result.statusCode).json(result.body);
  }

  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Liveness
   *     description: Процесс слушает. Без проверки Mongo.
   *     tags: [Health]
   *     security: []
   *     responses:
   *       200:
   *         description: Процесс жив
   * /livez:
   *   get:
   *     summary: Liveness alias
   *     tags: [Health]
   *     security: []
   *     responses:
   *       200:
   *         description: Тот же ответ, что GET /health
   * /ready:
   *   get:
   *     summary: Readiness
   *     description: Ping Mongo (timeout 1s). RabbitMQ этот процесс не держит.
   *     tags: [Health]
   *     security: []
   *     responses:
   *       200:
   *         description: Mongo доступна
   *       503:
   *         description: Mongo недоступна
   * /readyz:
   *   get:
   *     summary: Readiness alias
   *     tags: [Health]
   *     security: []
   *     responses:
   *       200:
   *         description: Тот же ответ, что GET /ready
   *       503:
   *         description: Тот же ответ, что GET /ready
   */
  router.get('/health', sendLiveness);
  router.get('/livez', sendLiveness);
  router.get('/ready', sendReadiness);
  router.get('/readyz', sendReadiness);
  return router;
}
