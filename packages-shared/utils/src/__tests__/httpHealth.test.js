import { isProbePath, livenessBody, readinessResult } from '../httpHealth.js';

describe('httpHealth', () => {
  test('liveness is ok and keeps version when given', () => {
    expect(livenessBody()).toEqual({ status: 'ok' });
    expect(livenessBody('0.0.88')).toEqual({ status: 'ok', version: '0.0.88' });
  });

  test('probe paths include aliases and ignore query', () => {
    expect(isProbePath('/health')).toBe(true);
    expect(isProbePath('/livez')).toBe(true);
    expect(isProbePath('/ready?x=1')).toBe(true);
    expect(isProbePath('/readyz')).toBe(true);
    expect(isProbePath('/api/tenants')).toBe(false);
  });

  test('tenant readiness is 503 when rabbit or mongo is down', () => {
    expect(readinessResult({
      mongodb: 'connected',
      rabbitmq: 'connected'
    }).statusCode).toBe(200);

    const down = readinessResult({
      mongodb: 'disconnected',
      rabbitmq: 'connected'
    });
    expect(down.statusCode).toBe(503);
    expect(down.body.status).toBe('degraded');
    expect(down.body.services.rabbitmq).toBe('connected');
  });

  test('controlo readiness ignores rabbit when the field is absent', () => {
    expect(readinessResult({ mongodb: 'connected' }).statusCode).toBe(200);
    expect(readinessResult({ mongodb: 'disconnected' }).statusCode).toBe(503);
  });
});
