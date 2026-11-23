import { metrics } from '@opentelemetry/api';

let status = 0;
let registered = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

export function setHealth(value: boolean | 0 | 1): void {
  status = value ? 1 : 0;
}

export function currentHealth(): number {
  return status;
}

export function registerHealthGauge(meterName = 'chat3'): void {
  if (registered) return;
  registered = true;
  const gauge = metrics.getMeter(meterName).createObservableGauge('health_check_status', {
    description: 'Process readiness: 1 = deps ok, 0 = unhealthy / shutdown'
  });
  gauge.addCallback((result) => {
    result.observe(status);
  });
}

export type HealthCheckFn = () => boolean | Promise<boolean>;

/** Periodic readiness poll; interval defaults to 1000ms (outbox relay cadence). */
export function startHealthPoll(check: HealthCheckFn, intervalMs = 1000): void {
  if (pollTimer) return;
  const tick = async () => {
    try {
      setHealth(await check());
    } catch {
      setHealth(0);
    }
  };
  void tick();
  pollTimer = setInterval(() => {
    void tick();
  }, intervalMs);
  if (typeof pollTimer.unref === 'function') {
    pollTimer.unref();
  }
}

export function stopHealthPoll(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function resetHealthForTests(): void {
  stopHealthPoll();
  status = 0;
  registered = false;
}
