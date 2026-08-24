import { unreadMessageMatchExtras } from '../counterProcessor/isUnreadForUser.js';

describe('isUnreadForUser / unreadMessageMatchExtras', () => {
  test('excludes sender and system messages', () => {
    const extras = unreadMessageMatchExtras('bob');
    expect(extras.senderId).toEqual({ $ne: 'bob' });
    expect(extras.type).toEqual({ $not: { $regex: /^system\./ } });
    expect(extras.deleted).toEqual({ $ne: true });
  });

  test('normalizes viewer userId to lowercase in sender filter', () => {
    const extras = unreadMessageMatchExtras('Bob');
    expect(extras.senderId).toEqual({ $ne: 'bob' });
  });

  test('adds createdAt $gte when memberJoinedAt is set', () => {
    const joinAt = 1_700_000_000_000;
    const extras = unreadMessageMatchExtras('bob', { memberJoinedAt: joinAt });
    expect(extras.createdAt).toEqual({ $gte: joinAt });
    expect(extras.senderId).toEqual({ $ne: 'bob' });
  });

  test('excludes soft-deleted messages from unread match', () => {
    const extras = unreadMessageMatchExtras('bob');
    expect(extras.deleted).toEqual({ $ne: true });
  });
});
