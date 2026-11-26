import { Request, Response, NextFunction } from 'express';
import { count } from '@chat3/utils/otel.js';

interface RequestRecord {
  timestamp: number;
  timeoutId: ReturnType<typeof setTimeout>;
  ttlMs: number;
}

interface TtlRule {
  method: string;
  pathRegex: RegExp;
  ttlMs: number;
}

const recentRequests = new Map<string, RequestRecord>();
const DEFAULT_TTL_MS = 500; // 0.5 seconds
const CUSTOM_TTL_RULES: TtlRule[] = [
  {
    method: 'POST',
    pathRegex: /^\/api\/dialogs\/[^/]+\/member\/[^/]+\/typing(?:\/)?$/i,
    ttlMs: 1000
  }
];
const GUARDED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function buildSignature(req: Request): string {
  const rawBody = safeStringify(req.body);
  const rawQuery = safeStringify(req.query);
  return `${req.method}:${req.originalUrl}:${rawBody}:${rawQuery}`;
}

function safeStringify(payload: any): string {
  try {
    if (payload === undefined || payload === null) {
      return '';
    }
    return JSON.stringify(payload);
  } catch (error: any) {
    console.warn('[IdempotencyGuard] Failed to stringify payload', error);
    return '';
  }
}

function getTtlForRequest(req: Request): number {
  const pathOnly = req.originalUrl.split('?')[0];
  const method = req.method.toUpperCase();

  for (const rule of CUSTOM_TTL_RULES) {
    if (rule.method === method && rule.pathRegex.test(pathOnly)) {
      return rule.ttlMs;
    }
  }

  return DEFAULT_TTL_MS;
}

function metricNameForPath(method: string, path: string): string | null {
  const m = method.toUpperCase();
  const p = path.split('?')[0];

  if (m === 'POST' && /\/dialogs\/[^/]+\/messages\/?$/.test(p)) {
    return 'dialog_messages_requests_total';
  }
  if (m === 'POST' && /^\/api\/packs\/?$/.test(p)) {
    return 'pack_write_requests_total';
  }
  if (m === 'POST' && /\/packs\/[^/]+\/dialogs\/?$/.test(p)) {
    return 'pack_write_requests_total';
  }
  if (m === 'DELETE' && /\/packs\/[^/]+\/dialogs\/[^/]+\/?$/.test(p)) {
    return 'pack_write_requests_total';
  }
  if (m === 'POST' && /^\/api\/dialogs\/?$/.test(p)) {
    return 'dialog_write_requests_total';
  }
  if (m === 'POST' && /\/dialogs\/[^/]+\/members\/add\/?$/.test(p)) {
    return 'dialog_write_requests_total';
  }
  if (m === 'POST' && /\/members\/[^/]+\/remove\/?$/.test(p)) {
    return 'dialog_write_requests_total';
  }
  if (m === 'POST' && /\/messages\/[^/]+\/status\/[^/]+\/?$/.test(p)) {
    return 'message_status_requests_total';
  }
  return null;
}

export default function idempotencyGuard(req: Request, res: Response, next: NextFunction): void {
  if (!GUARDED_METHODS.has(req.method)) {
    return next();
  }

  const signature = buildSignature(req);
  const now = Date.now();
  const existing = recentRequests.get(signature);
  const ttlMs = getTtlForRequest(req);

  if (existing && now - existing.timestamp < existing.ttlMs) {
    console.warn(`[IdempotencyGuard] Duplicate request blocked: ${req.method} ${req.originalUrl}`);
    const pathOnly = req.originalUrl.split('?')[0];
    const name = metricNameForPath(req.method, pathOnly);
    if (name) {
      count(name, { outcome: 'rejected', reason: 'duplicate_request' });
    }
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Duplicate request detected. Please retry shortly.'
    });
    return;
  }

  const timeoutId = setTimeout(() => {
    const current = recentRequests.get(signature);
    if (current && current.timeoutId === timeoutId) {
      recentRequests.delete(signature);
    }
  }, ttlMs);

  if (typeof timeoutId.unref === 'function') {
    timeoutId.unref();
  }

  recentRequests.set(signature, {
    timestamp: now,
    timeoutId,
    ttlMs
  });

  return next();
}
