import {
  toGrpcDialogFromListRow,
  toGrpcDialogMember,
  toGrpcDialogStatsLite,
  toGrpcMessage,
  toGrpcMessageStatus,
  valueFromProtobuf,
  valueToProtobuf
} from '../handlers/grpcMappers.js';

describe('toGrpcDialogFromListRow', () => {
  test('maps created_at, tenant_id, members_count, joined_at, unread', () => {
    const grpc = toGrpcDialogFromListRow({
      dialogId: 'dlg_aaaaaaaaaaaaaaaaaaaa',
      tenantId: 'tnt_a',
      createdAt: 1000,
      membersCount: 3,
      context: {
        userId: 'alice',
        unreadCount: 7,
        lastSeenAt: 11,
        lastMessageAt: 12,
        joinedAt: 99
      },
      stats: {
        memberCount: 3,
        messageCount: 40,
        topicCount: 1
      },
      meta: { type: 'dm' },
      lastMessage: {
        messageId: 'msg_1',
        dialogId: 'dlg_aaaaaaaaaaaaaaaaaaaa',
        senderId: 'bob',
        content: 'hi',
        type: 'internal.text',
        createdAt: 50
      }
    });

    expect(grpc.dialog_id).toBe('dlg_aaaaaaaaaaaaaaaaaaaa');
    expect(grpc.tenant_id).toBe('tnt_a');
    expect(grpc.created_at).toBe(1000);
    expect(grpc.members_count).toBe(3);
    expect(grpc.member.state.unread_count).toBe(7);
    expect(grpc.member.state.joined_at).toBe(99);
    expect(grpc.stats.member_count).toBe(3);
    expect(grpc.stats.message_count).toBe(40);
    expect(grpc.last_message.message_id).toBe('msg_1');
  });
});

describe('toGrpcDialogMember / stats', () => {
  test('maps joined_at and unread', () => {
    const m = toGrpcDialogMember({
      userId: 'bob',
      state: {
        unreadCount: 2,
        lastSeenAt: 1,
        lastMessageAt: 2,
        isActive: true,
        joinedAt: 55
      }
    });
    expect(m.user_id).toBe('bob');
    expect(m.state.unread_count).toBe(2);
    expect(m.state.joined_at).toBe(55);
  });

  test('stats lite', () => {
    expect(
      toGrpcDialogStatsLite({ memberCount: 2, messageCount: 9, topicCount: 0 })
    ).toEqual({ member_count: 2, message_count: 9, topic_count: 0 });
  });
});

describe('toGrpcMessage / Value codec', () => {
  test('maps message fields and statuses', () => {
    const grpc = toGrpcMessage({
      messageId: 'msg_1',
      dialogId: 'dlg_1',
      senderId: 'alice',
      type: 'internal.text',
      content: 'hi',
      meta: { k: 'v' },
      statuses: [{ userId: 'bob', status: 'read', createdAt: 42 }],
      reactionSet: { '👍': 1 },
      senderInfo: { userId: 'alice', name: 'Alice', createdAt: 1, meta: {} },
      createdAt: 10,
      deleted: false,
      statusMessageMatrix: { user: { read: 1 } }
    });

    expect(grpc.message_id).toBe('msg_1');
    expect(grpc.dialog_id).toBe('dlg_1');
    expect(grpc.statuses[0].user_id).toBe('bob');
    expect(grpc.statuses[0].read_at).toBe(42);
    expect(grpc.meta.fields.k.stringValue).toBe('v');
    expect(grpc.sender_info.user_id).toBe('alice');
  });

  test('valueToProtobuf / valueFromProtobuf roundtrip', () => {
    expect(valueFromProtobuf(valueToProtobuf('x'))).toBe('x');
    expect(valueFromProtobuf(valueToProtobuf(3))).toBe(3);
    expect(valueFromProtobuf(valueToProtobuf(true))).toBe(true);
    expect(valueFromProtobuf(valueToProtobuf(null))).toBeNull();
    expect(valueFromProtobuf(valueToProtobuf(['a', 1]))).toEqual(['a', 1]);
    expect(valueFromProtobuf(valueToProtobuf({ a: 'b' }))).toEqual({ a: 'b' });
  });

  test('toGrpcMessageStatus', () => {
    expect(
      toGrpcMessageStatus({ userId: 'bob', status: 'delivered', createdAt: 9 })
    ).toEqual({
      user_id: 'bob',
      status: 'delivered',
      read_at: 0,
      created_at: 9
    });
  });
});
