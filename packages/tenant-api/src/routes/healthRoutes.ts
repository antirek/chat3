import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { isRabbitMQConnected } from '@chat3/utils/rabbitmqUtils.js';
import { checkMongo, livenessBody, readinessResult, type DepStatus } from '@chat3/utils/httpHealth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, '../../../../package.json');
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version?: string };

const router = Router();

function sendLiveness(_req: Request, res: Response): void {
  res.status(200).json(livenessBody(pkg.version));
}

async function sendReadiness(_req: Request, res: Response): Promise<void> {
  const services = {
    mongodb: await checkMongo(),
    rabbitmq: (isRabbitMQConnected() ? 'connected' : 'disconnected') as DepStatus
  };
  const result = readinessResult(services);
  res.status(result.statusCode).json(result.body);
}

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Liveness
 *     description: Процесс слушает. Без проверки Mongo и RabbitMQ.
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
 *     description: Ping Mongo (timeout 1s) и флаг соединения RabbitMQ. 503 не должен рестартить контейнер.
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Зависимости доступны
 *       503:
 *         description: Mongo или RabbitMQ недоступны
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

export default router;
