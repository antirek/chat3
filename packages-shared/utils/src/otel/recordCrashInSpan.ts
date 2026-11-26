import { SpanStatusCode, trace } from '@opentelemetry/api';
import { emitLog } from './emitLog.js';
import { isEnabled } from './state.js';

/** Record crash on active span + OTLP log without changing process exit policy. */
export function recordCrashInSpan(err: unknown): void {
  if (!isEnabled()) return;
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
    // never break crash path
  }
}
