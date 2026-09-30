import mongoose from 'mongoose';

export type DepStatus = 'connected' | 'disconnected';

export async function checkMongo(timeoutMs = 1000): Promise<DepStatus> {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return 'disconnected';
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      mongoose.connection.db.admin().ping(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('mongo ping timeout')), timeoutMs);
      })
    ]);
    return 'connected';
  } catch {
    return 'disconnected';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const PROBE_PATHS = new Set(['/health', '/livez', '/ready', '/readyz']);

export function isProbePath(url: string): boolean {
  const path = (url || '').split('?')[0];
  return PROBE_PATHS.has(path);
}

export function livenessBody(version?: string): { status: 'ok'; version?: string } {
  if (version) {
    return { status: 'ok', version };
  }
  return { status: 'ok' };
}

export function readinessResult(services: { mongodb: DepStatus; rabbitmq?: DepStatus }): {
  statusCode: 200 | 503;
  body: { status: 'ok' | 'degraded'; services: { mongodb: DepStatus; rabbitmq?: DepStatus } };
} {
  const mongoOk = services.mongodb === 'connected';
  const rabbitOk = services.rabbitmq === undefined || services.rabbitmq === 'connected';
  const ok = mongoOk && rabbitOk;
  return {
    statusCode: ok ? 200 : 503,
    body: {
      status: ok ? 'ok' : 'degraded',
      services
    }
  };
}
