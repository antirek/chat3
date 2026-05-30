import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Event, OutboxEvent } from '@chat3/models';
import { createEventWithOutbox } from '../outboxUtils.js';

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
});
