import util from 'node:util';
import { createRequire } from 'node:module';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { registerHealthGauge } from './health.js';
import { emitLog } from './emitLog.js';

const require = createRequire(import.meta.url);

export type InstrumentationName = 'http' | 'mongoose' | 'amqplib';

let sdkInstance: { shutdown: () => Promise<void> } | null = null;

function serviceName(): string {
  const name = String(process.env.SERVICE_NAME || '').trim();
  return name || 'unknown';
}

function deploymentEnvironment(): string {
  const value = String(process.env.DEPLOYMENT_ENVIRONMENT || '').trim();
  return value || 'unknown';
}

function buildInstrumentations(names: InstrumentationName[] | undefined) {
  const allow = new Set(names || []);
  const list: unknown[] = [];

  if (allow.has('http')) {
    const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
    list.push(new HttpInstrumentation());
  }
  if (allow.has('mongoose')) {
    const { MongooseInstrumentation } = require('@opentelemetry/instrumentation-mongoose');
    list.push(new MongooseInstrumentation());
  }
  if (allow.has('amqplib')) {
    const { AmqplibInstrumentation } = require('@opentelemetry/instrumentation-amqplib');
    list.push(new AmqplibInstrumentation());
  }
  return list;
}

function serializeConsoleArgsForOtel(args: unknown[]): string {
  const body = args
    .map((value) => {
      if (typeof value === 'string') return value;
      if (value instanceof Error) {
        return value.stack || `${value.name}: ${value.message}`;
      }
      return util.inspect(value, {
        depth: null,
        maxArrayLength: null,
        maxStringLength: null,
        breakLength: Infinity,
        compact: false
      });
    })
    .join(' ');
  const maxChars = Number.parseInt(process.env.OTEL_LOG_BODY_MAX_CHARS || '0', 10);
  if (!maxChars || body.length <= maxChars) return body;
  return `${body.slice(0, maxChars)}\n...[otel body truncated, ${body.length - maxChars} more chars]`;
}

function installConsoleBridge(): void {
  const map: Record<string, string> = {
    log: 'info',
    info: 'info',
    warn: 'warn',
    error: 'error',
    debug: 'debug'
  };
  for (const [method, severity] of Object.entries(map)) {
    const consoleAny = console as unknown as Record<string, (...a: unknown[]) => void>;
    if (typeof consoleAny[method] !== 'function') continue;
    const original = consoleAny[method].bind(console);
    consoleAny[method] = (...args: unknown[]) => {
      original(...args);
      try {
        const attrs: Record<string, string> = { 'log.source': 'console' };
        const err = args.find((a) => a instanceof Error) as Error | undefined;
        if (err) {
          attrs['exception.type'] = err.name;
          attrs['exception.message'] = err.message;
          attrs['exception.stacktrace'] = err.stack || '';
          attrs['error.type'] = err.name;
        }
        emitLog(severity, serializeConsoleArgsForOtel(args), attrs);
      } catch {
        // never break app logging
      }
    };
  }
}

function installProcessHandlers(): void {
  const crash = async (err: unknown) => {
    const error = err instanceof Error ? err : new Error(String(err));
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    }
    try {
      emitLog('error', error.message, {
        'exception.type': error.name,
        'exception.message': error.message,
        'exception.stacktrace': error.stack || '',
        'error.type': error.name
      });
    } catch {
      // ignore
    }
    try {
      await shutdownOtel();
    } catch {
      // best-effort
    }
    process.exit(1);
  };
  process.on('uncaughtException', (err) => {
    void crash(err);
  });
  process.on('unhandledRejection', (err) => {
    void crash(err);
  });
}

export function startSdk(options: { instrumentations?: InstrumentationName[] } = {}): void {
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
  const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-grpc');
  const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
  const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-grpc');
  const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
  const { resourceFromAttributes } = require('@opentelemetry/resources');

  const resource = resourceFromAttributes({
    'service.name': serviceName(),
    'service.namespace': 'mms3',
    'deployment.environment': deploymentEnvironment()
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
    }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
        })
      })
    ],
    logRecordProcessors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({
          url: process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
        })
      )
    ],
    instrumentations: buildInstrumentations(options.instrumentations)
  });
  sdk.start();
  sdkInstance = sdk;
  registerHealthGauge();
  installConsoleBridge();
  installProcessHandlers();
}

export async function shutdownOtel(): Promise<void> {
  if (!sdkInstance) return;
  const instance = sdkInstance;
  sdkInstance = null;
  try {
    await instance.shutdown();
  } catch (err) {
    console.error('otel shutdown failed', err instanceof Error ? err.message : err);
  }
}

export { serviceName, deploymentEnvironment, serializeConsoleArgsForOtel, installConsoleBridge };
