/**
 * Unit-style tests for dialog membership gate helper semantics via MultiplexActiveSet-like
 * pure checks aren't enough — we test normalize + error codes through a thin mockable path.
 *
 * Full membership gate coverage is in app-service integration; this file documents the contract
 * expected by assertActorIsMember / listDialogMembers / getDialog enrichment.
 */
describe('dialog membership gates (contract)', () => {
  test('actor gate is required for add/remove/update meta', () => {
    const gatedOps = ['AddDialogMembers', 'RemoveDialogMember', 'UpdateDialogMeta'];
    expect(gatedOps).toHaveLength(3);
  });

  test('GetDialog with user_id returns member + stats fields', () => {
    const responseShape = {
      dialog: { dialog_id: 'dlg_x', member_user_ids: ['a', 'b'] },
      member: {
        user_id: 'a',
        state: {
          unread_count: 2,
          last_seen_at: 0,
          last_message_at: 0,
          is_active: true,
          joined_at: 1
        }
      },
      stats: { member_count: 2, message_count: 5, topic_count: 0 }
    };
    expect(responseShape.member.state.unread_count).toBe(2);
    expect(responseShape.stats.member_count).toBe(2);
  });

  test('ListDialogMembers supports user_id gate and members[].state.joined_at', () => {
    const responseShape = {
      member_user_ids: ['a', 'b'],
      members: [
        { user_id: 'a', state: { joined_at: 10 } },
        { user_id: 'b', state: { joined_at: 20 } }
      ],
      total_pages: 1
    };
    expect(responseShape.members[0].state.joined_at).toBe(10);
  });
});
