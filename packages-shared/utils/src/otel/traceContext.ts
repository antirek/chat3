import { context, propagation, type Context } from '@opentelemetry/api';

export type W3cCarrier = { traceparent?: string | null; tracestate?: string | null };

export function captureTraceContext(ctx: Context = context.active()): W3cCarrier {
  const carrier: Record<string, string> = {};
  propagation.inject(ctx, carrier);
  return {
    traceparent: carrier.traceparent || null,
    tracestate: carrier.tracestate || null
  };
}

export function restoreTraceContext(carrier: W3cCarrier, parent: Context = context.active()): Context {
  const map: Record<string, string> = {};
  if (carrier.traceparent) map.traceparent = carrier.traceparent;
  if (carrier.tracestate) map.tracestate = carrier.tracestate;
  if (!map.traceparent) return parent;
  return propagation.extract(parent, map);
}
