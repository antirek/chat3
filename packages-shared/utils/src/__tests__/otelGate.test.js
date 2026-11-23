/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';

describe('otel gate', () => {
  const ENDPOINTS = [
    'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
    'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
    'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT'
  ];

  let otel;

  beforeEach(async () => {
    jest.resetModules();
    for (const name of ENDPOINTS) {
      delete process.env[name];
    }
    otel = await import('../otel/index.ts');
    otel.resetOtelForTests();
  });

  test('endpointsReady is false without env', () => {
    expect(otel.endpointsReady()).toBe(false);
  });

  test('initOtel disables when endpoints missing', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const result = otel.initOtel({ instrumentations: ['mongoose'] });
    expect(result).toEqual({ enabled: false });
    expect(otel.isEnabled()).toBe(false);
    expect(logSpy).toHaveBeenCalledWith('OTEL endpoints are not set, telemetry disabled');
    logSpy.mockRestore();
  });

  test('count is no-op when disabled', () => {
    otel.initOtel();
    expect(() => otel.count('pack_messages_requests_total', { outcome: 'success', reason: 'ok' })).not.toThrow();
  });
});
