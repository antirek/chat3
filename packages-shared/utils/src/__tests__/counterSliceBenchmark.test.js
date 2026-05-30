import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { DialogMember, Message } from '@chat3/models';
import { resolveSlice } from '../counterProcessor/resolveSlice.js';
import { recalculateSlice } from '../counterProcessor/recalculateSlice.js';
import { generateTimestamp } from '../timestampUtils.js';

/**
 * Baseline длительности recalculateSlice (VI.6).
 * Не load-test — sanity ceiling для регрессии в CI.
 */
describe('counterSliceBenchmark', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('message.create slice p99 baseline under 5s (50 messages, 5 members)', async () => {
    const tenantId = 'tnt_bench';
    const dialogId = 'dlg_bbbbbbbbbbbbbbbbbbbb';
    const senderId = 'alice';
    const now = generateTimestamp();
    const memberIds = ['bob', 'carol', 'dave', 'erin', 'frank'];

    await DialogMember.insertMany(
      [senderId, ...memberIds].map((userId) => ({
        tenantId,
        dialogId,
        userId,
        createdAt: now
      }))
    );

    const messages = [];
    for (let i = 0; i < 50; i++) {
      const messageId = `msg_${String(i).padStart(20, '0')}`;
      messages.push({
        tenantId,
        dialogId,
        messageId,
        senderId,
        type: 'internal.text',
        content: `m${i}`,
        createdAt: now + i
      });
    }
    await Message.insertMany(messages);

    const lastMessage = messages[messages.length - 1];
    const event = {
      eventId: 'evt_c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1',
      tenantId,
      eventType: 'message.create',
      entityType: 'message',
      entityId: lastMessage.messageId,
      data: {
        context: { dialogId, messageId: lastMessage.messageId },
        message: {
          messageId: lastMessage.messageId,
          dialogId,
          senderId,
          type: 'internal.text'
        }
      }
    };

    const slice = await resolveSlice(event);
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      await recalculateSlice(slice);
      samples.push(performance.now() - t0);
    }

    samples.sort((a, b) => a - b);
    const p99Index = Math.min(samples.length - 1, Math.ceil(samples.length * 0.99) - 1);
    const p99 = samples[p99Index];

    // eslint-disable-next-line no-console
    console.log(`[counterSliceBenchmark] samples(ms)=${samples.map((n) => n.toFixed(1)).join(',')} p99=${p99.toFixed(1)}`);

    expect(p99).toBeLessThan(5000);
  });
});
