import { metrics, type Attributes, type Counter, type Histogram } from '@opentelemetry/api';
import { isEnabled } from './state.js';

const FORBIDDEN = new Set([
  'branchId',
  'tenantId',
  'contactId',
  'dialogId',
  'messageId',
  'userId',
  'packId',
  'clientId',
  'email',
  'domain',
  'token',
  'apiKey'
]);

const SEC_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60];

const counters = new Map<string, Counter>();
const histograms = new Map<string, Histogram>();
const gaugeSeries = new Map<string, Map<string, { value: number; attrs: Attributes }>>();
const gaugeRegistered = new Set<string>();

function meter() {
  return metrics.getMeter('chat3');
}

export function safeAttrs(attrs?: Record<string, unknown>): Attributes {
  const safe: Attributes = {};
  for (const [key, value] of Object.entries(attrs || {})) {
    if (FORBIDDEN.has(key) || value == null || value === '') continue;
    safe[key] = String(value);
  }
  return safe;
}

function attrsKey(attrs: Attributes): string {
  const keys = Object.keys(attrs).sort();
  return keys.map((k) => `${k}=${String(attrs[k])}`).join('|');
}

export function count(name: string, attrs?: Record<string, unknown>): void {
  if (!isEnabled()) return;
  let counter = counters.get(name);
  if (!counter) {
    counter = meter().createCounter(name);
    counters.set(name, counter);
  }
  counter.add(1, safeAttrs(attrs));
}

export function recordSeconds(name: string, seconds: number, attrs?: Record<string, unknown>): void {
  if (!isEnabled()) return;
  if (seconds == null || Number.isNaN(Number(seconds))) return;
  let histogram = histograms.get(name);
  if (!histogram) {
    histogram = meter().createHistogram(name, {
      unit: 's',
      advice: { explicitBucketBoundaries: SEC_BUCKETS }
    });
    histograms.set(name, histogram);
  }
  histogram.record(Number(seconds), safeAttrs(attrs));
}

/** Last-value gauge; multiple attribute series supported (e.g. queue name). */
export function setGauge(name: string, value: number, attrs?: Record<string, unknown>): void {
  if (!isEnabled()) return;
  const safe = safeAttrs(attrs);
  if (!gaugeRegistered.has(name)) {
    gaugeRegistered.add(name);
    const series = new Map<string, { value: number; attrs: Attributes }>();
    gaugeSeries.set(name, series);
    const obs = meter().createObservableGauge(name);
    obs.addCallback((result) => {
      for (const point of series.values()) {
        result.observe(point.value, point.attrs);
      }
    });
  }
  const series = gaugeSeries.get(name)!;
  series.set(attrsKey(safe), { value, attrs: safe });
}

export function resetMetricsForTests(): void {
  counters.clear();
  histograms.clear();
  gaugeSeries.clear();
  gaugeRegistered.clear();
}
