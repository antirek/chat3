import { setEnabled, isEnabled } from './state.js';
import { startSdk, shutdownOtel, type InstrumentationName } from './startSdk.js';
import {
  setHealth,
  currentHealth,
  startHealthPoll,
  stopHealthPoll,
  registerHealthGauge,
  resetHealthForTests
} from './health.js';
import { count, recordSeconds, setGauge, safeAttrs, resetMetricsForTests } from './metrics.js';
import { emitLog } from './emitLog.js';

const ENDPOINTS = [
  'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
  'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
  'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT'
] as const;

let started = false;

export function endpointsReady(env: Record<string, string | undefined> = process.env): boolean {
  return ENDPOINTS.every((name) => String(env[name] || '').trim());
}

export function initOtel(options: { instrumentations?: InstrumentationName[] } = {}): {
  enabled: boolean;
} {
  if (started) return { enabled: isEnabled() };
  started = true;
  if (!endpointsReady()) {
    console.log('OTEL endpoints are not set, telemetry disabled');
    setEnabled(false);
    return { enabled: false };
  }
  try {
    startSdk(options);
    setEnabled(true);
  } catch (err) {
    setEnabled(false);
    console.error('telemetry start failed', err instanceof Error ? err.message : err);
    return { enabled: false };
  }
  if (!String(process.env.SERVICE_NAME || '').trim()) {
    console.log('SERVICE_NAME is empty, telemetry service.name=unknown');
  }
  return { enabled: true };
}

export function resetOtelForTests(): void {
  started = false;
  setEnabled(false);
  resetHealthForTests();
  resetMetricsForTests();
}

export {
  isEnabled,
  shutdownOtel,
  setHealth,
  currentHealth,
  startHealthPoll,
  stopHealthPoll,
  registerHealthGauge,
  count,
  recordSeconds,
  setGauge,
  safeAttrs,
  emitLog
};

export type { InstrumentationName };
