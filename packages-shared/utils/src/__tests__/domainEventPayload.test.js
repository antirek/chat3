import { resolveEventIdFromMqPayload, toOutboxPublishPayload } from '../domainEventPayload.js';

describe('domainEventPayload', () => {
  test('resolveEventIdFromMqPayload prefers eventId (outbox-relay contract)', () => {
    expect(
      resolveEventIdFromMqPayload({
        eventId: 'evt_a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0',
        tenantId: 'tnt_test'
      })
    ).toBe('evt_a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0');
  });

  test('resolveEventIdFromMqPayload falls back to _id (legacy direct publish)', () => {
    expect(
      resolveEventIdFromMqPayload({
        _id: '507f1f77bcf86cd799439011',
        tenantId: 'tnt_test'
      })
    ).toBe('507f1f77bcf86cd799439011');
  });

  test('resolveEventIdFromMqPayload returns null when both missing', () => {
    expect(resolveEventIdFromMqPayload({ tenantId: 'tnt_test' })).toBeNull();
    expect(resolveEventIdFromMqPayload(null)).toBeNull();
  });

  test('toOutboxPublishPayload uses eventId and omits _id', () => {
    const payload = toOutboxPublishPayload({
      eventId: 'evt_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      tenantId: 'tnt_test',
      eventType: 'message.create',
      entityType: 'message',
      entityId: 'msg_cccccccccccccccccccc',
      actorId: 'alice',
      actorType: 'user',
      data: { context: { dialogId: 'dlg_dddddddddddddddddddd' } },
      createdAt: 1_700_000_000_000
    });

    expect(payload.eventId).toBe('evt_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(payload._id).toBeUndefined();
    expect(payload.tenantId).toBe('tnt_test');
    expect(payload.eventType).toBe('message.create');
  });
});
