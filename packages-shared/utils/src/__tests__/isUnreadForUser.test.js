import { unreadMessageMatchExtras } from '../counterProcessor/isUnreadForUser.js';

describe('isUnreadForUser / unreadMessageMatchExtras', () => {
  test('excludes sender and system messages', () => {
    const extras = unreadMessageMatchExtras('bob');
    expect(extras.senderId).toEqual({ $ne: 'bob' });
    expect(extras.type).toEqual({ $not: { $regex: /^system\./ } });
  });

  test('normalizes viewer userId to lowercase in sender filter', () => {
    const extras = unreadMessageMatchExtras('Bob');
    expect(extras.senderId).toEqual({ $ne: 'bob' });
  });
});
