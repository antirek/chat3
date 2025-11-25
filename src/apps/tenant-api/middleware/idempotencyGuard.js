const recentRequests = new Map();
const DEFAULT_TTL_MS = 500; // 0.5 seconds
const CUSTOM_TTL_RULES = [
  {
    method: 'POST',
    pathRegex: /^\/api\/dialogs\/[^/]+\/member\/[^/]+\/typing(?:\/)?$/i,
    ttlMs: 1000
  }
];
const GUARDED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function buildSignature(req) {
  const rawBody = safeStringify(req.body);
  const rawQuery = safeStringify(req.query);
  return `${req.method}:${req.originalUrl}:${rawBody}:${rawQuery}`;
}

function safeStringify(payload) {
  try {
    if (payload === undefined || payload === null) {
      return '';
    }
    return JSON.stringify(payload);
  } catch (error) {
    console.warn('[IdempotencyGuard] Failed to stringify payload', error);
    return '';
  }
}

function getTtlForRequest(req) {
  const pathOnly = req.originalUrl.split('?')[0];
  const method = req.method.toUpperCase();

  for (const rule of CUSTOM_TTL_RULES) {
    if (rule.method === method && rule.pathRegex.test(pathOnly)) {
      return rule.ttlMs;
    }
  }

  return DEFAULT_TTL_MS;
}

export default function idempotencyGuard(req, res, next) {
  if (!GUARDED_METHODS.has(req.method)) {
    return next();
  }

  const signature = buildSignature(req);
  const now = Date.now();
  const existing = recentRequests.get(signature);
  const ttlMs = getTtlForRequest(req);

  if (existing && now - existing.timestamp < existing.ttlMs) {
    console.warn(`[IdempotencyGuard] Duplicate request blocked: ${req.method} ${req.originalUrl}`);
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Duplicate request detected. Please retry shortly.'
    });
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

