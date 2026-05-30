import { ProcessedCounterEvent } from '@chat3/models';
import { generateTimestamp } from '../timestampUtils.js';
import { isCounterEventType } from './counterEvents.js';
import { toEventPayload } from './eventPayload.js';
import { publishCounterUpdates } from './publishCounterUpdates.js';
import { recalculateSlice } from './recalculateSlice.js';
import { resolveSlice } from './resolveSlice.js';

export class CounterProcessorError extends Error {
  constructor(message: string, public readonly retryable = true) {
    super(message);
    this.name = 'CounterProcessorError';
  }
}

/**
 * Идемпотентная обработка доменного события: slice → stats → counter-Updates.
 */
export async function processCounterEvent(eventData: unknown): Promise<void> {
  const event = toEventPayload(eventData);
  if (!event) {
    console.warn('[counterProcessor] skip: invalid event payload');
    return;
  }

  if (!isCounterEventType(event.eventType)) {
    return;
  }

  const already = await ProcessedCounterEvent.findOne({
    tenantId: event.tenantId,
    eventId: event.eventId
  }).lean();

  if (already) {
    return;
  }

  let slice;
  try {
    slice = await resolveSlice(event);
    await recalculateSlice(slice);
    await publishCounterUpdates(slice);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[counterProcessor] slice failed: tenant=${event.tenantId} eventId=${event.eventId} type=${event.eventType}: ${message}`
    );
    throw err instanceof CounterProcessorError
      ? err
      : new CounterProcessorError(message, true);
  }

  try {
    await ProcessedCounterEvent.create({
      tenantId: event.tenantId,
      eventId: event.eventId,
      eventType: event.eventType,
      processedAt: generateTimestamp()
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 11000) {
      return;
    }
    throw err;
  }
}
