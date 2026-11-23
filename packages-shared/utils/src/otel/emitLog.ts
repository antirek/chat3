import { context, isSpanContextValid, trace } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { isEnabled } from './state.js';

const SEVERITY: Record<string, SeverityNumber> = {
  trace: SeverityNumber.TRACE,
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  warning: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
  fatal: SeverityNumber.FATAL
};

export function emitLog(
  severity: string,
  body: string,
  attributes?: Record<string, string>,
  options?: { context?: ReturnType<typeof context.active> }
): void {
  if (!isEnabled()) return;
  const level = String(severity || 'info').toLowerCase();
  const logger = logs.getLogger('chat3');
  const ctx = options?.context || context.active();
  const spanContext = trace.getSpanContext(ctx);
  const attrs: Record<string, string> = { ...(attributes || {}) };
  if (spanContext && isSpanContextValid(spanContext)) {
    attrs.trace_id = spanContext.traceId;
    attrs.traceId = spanContext.traceId;
    attrs.spanId = spanContext.spanId;
  }
  logger.emit({
    severityText: level.toUpperCase(),
    severityNumber: SEVERITY[level] ?? SeverityNumber.INFO,
    body,
    attributes: attrs,
    context: ctx
  });
}
