import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import {
  Dialog,
  DialogMember,
  Event,
  Message,
  Update
} from '@chat3/models';
import { processUpdateEvent } from '../updateProcessor/processUpdateEvent.js';
import { toOutboxPublishPayload } from '../domainEventPayload.js';
import { generateTimestamp } from '../timestampUtils.js';

const tenantId = 'tnt_update_processor';

describe('processUpdateEvent', () => {
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

  test('creates MessageUpdate from outbox-relay payload (eventId, no _id)', async () => {
    const dialogId = 'dlg_aaaaaaaaaaaaaaaaaaaa';
    const messageId = 'msg_bbbbbbbbbbbbbbbbbbbb';
    const now = generateTimestamp();

    await Dialog.create({ tenantId, dialogId, createdAt: now });
    await DialogMember.insertMany([
      { tenantId, dialogId, userId: 'alice', createdAt: now },
      { tenantId, dialogId, userId: 'bob', createdAt: now }
    ]);
    await Message.create({
      tenantId,
      dialogId,
      messageId,
      senderId: 'alice',
      type: 'internal.text',
      content: 'hi',
      createdAt: now
    });

    const event = await Event.create({
      tenantId,
      eventType: 'message.create',
      entityType: 'message',
      entityId: messageId,
      actorId: 'alice',
      data: {
        context: { dialogId, messageId, eventType: 'message.create' },
        message: { messageId, dialogId, senderId: 'alice', type: 'internal.text' },
        dialog: { dialogId, tenantId }
      }
    });

    const mqPayload = toOutboxPublishPayload({
      eventId: event.eventId,
      tenantId,
      eventType: 'message.create',
      entityType: 'message',
      entityId: messageId,
      actorId: 'alice',
      actorType: 'user',
      data: event.data,
      createdAt: now
    });

    expect(mqPayload._id).toBeUndefined();

    await processUpdateEvent(mqPayload);

    const updates = await Update.find({ tenantId, entityId: messageId, eventId: event.eventId }).lean();
    expect(updates.length).toBe(2);
    updates.forEach((row) => {
      expect(row.eventId).toBe(event.eventId);
    });
  });

  test('creates DialogUpdate from outbox-relay payload for dialog.member.add', async () => {
    const dialogId = 'dlg_cccccccccccccccccccc';
    const now = generateTimestamp();

    await Dialog.create({ tenantId, dialogId, createdAt: now });
    await DialogMember.create({ tenantId, dialogId, userId: 'alice', createdAt: now });

    const event = await Event.create({
      tenantId,
      eventType: 'dialog.member.add',
      entityType: 'dialogMember',
      entityId: `${dialogId}:usr_newmember1`,
      actorId: 'alice',
      data: {
        context: { dialogId, eventType: 'dialog.member.add' },
        member: { userId: 'usr_newmember1' },
        dialog: { dialogId, tenantId }
      }
    });

    await DialogMember.create({ tenantId, dialogId, userId: 'usr_newmember1', createdAt: now });

    await processUpdateEvent(
      toOutboxPublishPayload({
        eventId: event.eventId,
        tenantId,
        eventType: 'dialog.member.add',
        entityType: 'dialogMember',
        entityId: event.entityId,
        actorId: 'alice',
        actorType: 'user',
        data: event.data,
        createdAt: now
      })
    );

    const update = await Update.findOne({
      tenantId,
      entityId: dialogId,
      userId: 'usr_newmember1',
      eventId: event.eventId
    }).lean();

    expect(update).toBeTruthy();
  });

  test('legacy _id-only payload still resolves via ObjectId lookup', async () => {
    const dialogId = 'dlg_dddddddddddddddddddd';
    const now = generateTimestamp();

    await Dialog.create({ tenantId, dialogId, createdAt: now });
    await DialogMember.create({ tenantId, dialogId, userId: 'alice', createdAt: now });

    const event = await Event.create({
      tenantId,
      eventType: 'dialog.create',
      entityType: 'dialog',
      entityId: dialogId,
      actorId: 'alice',
      data: {
        dialog: { dialogId, tenantId },
        context: { dialogId, eventType: 'dialog.create' }
      }
    });

    await processUpdateEvent({
      _id: event._id,
      tenantId,
      eventType: 'dialog.create',
      entityType: 'dialog',
      entityId: dialogId,
      data: event.data
    });

    const update = await Update.findOne({
      tenantId,
      entityId: dialogId,
      userId: 'alice',
      eventId: event.eventId
    }).lean();

    expect(update?.eventId).toBe(event.eventId);
  });
});
