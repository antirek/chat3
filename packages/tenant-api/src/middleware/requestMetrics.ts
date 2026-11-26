import type { Request, Response, NextFunction } from 'express';
import { count, runWithOutboxFailHook } from '@chat3/utils/otel.js';
import { isMongoUnavailableError } from '@chat3/utils/updateProcessor/processOutcome.js';

export type MetricOutcome = 'success' | 'rejected' | 'error' | 'partial';

export interface RequestMetricState {
  name: string;
  outcome?: MetricOutcome;
  reason?: string;
  labels?: Record<string, string>;
  recorded?: boolean;
}

const STATE_KEY = '__chat3RequestMetric';

type ReqWithMetric = Request & { [STATE_KEY]?: RequestMetricState };

function getState(req: Request): RequestMetricState | undefined {
  return (req as ReqWithMetric)[STATE_KEY];
}

export function bindRouteMetric(name: string, labels?: Record<string, string>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const state: RequestMetricState = {
      name,
      labels: labels ? { ...labels } : undefined
    };
    (req as ReqWithMetric)[STATE_KEY] = state;

    res.on('finish', () => {
      if (state.recorded) return;
      state.recorded = true;
      let outcome = state.outcome;
      let reason = state.reason;
      if (!outcome || !reason) {
        const code = res.statusCode || 500;
        if (code >= 200 && code < 300) {
          outcome = outcome || 'success';
          reason = reason || 'ok';
        } else if (code >= 400 && code < 500) {
          outcome = outcome || 'rejected';
          reason = reason || 'internal_error';
        } else {
          outcome = outcome || 'error';
          reason = reason || 'internal_error';
        }
      }
      count(state.name, {
        outcome,
        reason,
        ...(state.labels || {})
      });
    });

    runWithOutboxFailHook(() => {
      setRequestMetric(req, 'partial', 'event_outbox_write_failed', { event_stage: 'outbox' });
    }, () => next());
  };
}

export function setRequestMetric(
  req: Request,
  outcome: MetricOutcome,
  reason: string,
  labels?: Record<string, string>
): void {
  const state = getState(req);
  if (!state) return;
  state.outcome = outcome;
  state.reason = reason;
  if (labels) {
    state.labels = { ...(state.labels || {}), ...labels };
  }
}

/** Map AppService / auth failures to TZ reason labels when a route metric is bound. */
export function setAuthMetricFromError(req: Request, error: unknown, permission?: string): void {
  const state = getState(req);
  if (!state) return;

  const err = error as { code?: string; message?: string; name?: string; stage?: string };
  if (err?.code === 'UNAUTHORIZED') {
    setRequestMetric(req, 'rejected', 'apikey_not_found');
    return;
  }
  if (err?.code === 'FORBIDDEN') {
    const perm = permission || 'read';
    setRequestMetric(req, 'rejected', perm === 'write' ? 'forbidden_write' : 'forbidden_read');
    return;
  }
  if (err?.code === 'NOT_FOUND' && String(err.message || '').toLowerCase().includes('tenant')) {
    setRequestMetric(req, 'rejected', 'tenant_not_found');
    return;
  }
  if (err?.code === 'VALIDATION') {
    setRequestMetric(req, 'rejected', 'invalid_params');
    return;
  }
  if (isMongoUnavailableError(error) || err?.code === 'INTERNAL') {
    const stage = err?.stage;
    setRequestMetric(
      req,
      'error',
      stage === 'tenant' ? 'tenant_unavailable' : 'apikey_unavailable'
    );
    return;
  }
  // Mongo / infra during auth
  setRequestMetric(req, 'error', 'apikey_unavailable');
}

export function setInvalidParamsMetric(req: Request): void {
  setRequestMetric(req, 'rejected', 'invalid_params');
}

export function setInvalidBodyMetric(req: Request): void {
  setRequestMetric(req, 'rejected', 'invalid_body');
}
