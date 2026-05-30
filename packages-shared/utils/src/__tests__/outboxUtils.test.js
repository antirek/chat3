import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Event, OutboxEvent } from '@chat3/models';
import { createEventWithOutbox } from '../outboxUtils.js';
import { toOutboxPublishPayload } from '../domainEventPayload.js';

describe('outboxUtils', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('createEventWithOutbox writes Event and OutboxEvent (sequential fallback on standalone Mongo)', async () => {
    const event = await createEventWithOutbox({
      tenantId: 'tnt_test',
      eventType: 'dialog.create',
      entityType: 'dialog',
      entityId: 'dlg_test123456789012345',
      actorId: 'api',
      actorType: 'api',
      data: { context: { dialogId: 'dlg_test123456789012345' } }
    });

    expect(event).toBeTruthy();
    const journal = await Event.findOne({ eventId: event.eventId }).lean();
    const outbox = await OutboxEvent.findOne({ eventId: event.eventId }).lean();
    expect(journal).toBeTruthy();
    expect(outbox).toBeTruthy();
    expect(outbox.published).toBe(false);
    expect(outbox.eventType).toBe('dialog.create');
  });

  test('OutboxEvent row maps to relay payload with eventId (no _id)', async () => {
    const event = await createEventWithOutbox({
      tenantId: 'tnt_outbox_map',
      eventType: 'message.create',
      entityType: 'message',
      entityId: 'msg_outbox12345678901234',
      actorId: 'alice',
      actorType: 'user',
      data: { context: { dialogId: 'dlg_outbox123456789012345' } }
    });
    expect(event).toBeTruthy();

    const row = await OutboxEvent.findOne({ eventId: event.eventId }).lean();
    const payload = toOutboxPublishPayload(row);

    expect(payload.eventId).toBe(event.eventId);
    expect(payload._id).toBeUndefined();
    expect(payload.tenantId).toBe('tnt_outbox_map');
    expect(payload.eventType).toBe('message.create');
  });
});
