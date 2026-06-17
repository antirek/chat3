import { shouldApplyUserStatsUpdate } from '../updateUtils.js';

describe('shouldApplyUserStatsUpdate', () => {
  test('принимает update с большим statsVersion', () => {
    expect(
      shouldApplyUserStatsUpdate(
        { statsVersion: 2, lastUpdatedAt: 100 },
        { statsVersion: 3, lastUpdatedAt: 50 }
      )
    ).toBe(true);
  });

  test('отклоняет stale update с меньшим statsVersion', () => {
    expect(
      shouldApplyUserStatsUpdate(
        { statsVersion: 5, lastUpdatedAt: 100 },
        { statsVersion: 4, lastUpdatedAt: 200, 'packs.messages.totalUnreadCount': 1 }
      )
    ).toBe(false);
  });

  test('при равном statsVersion сравнивает lastUpdatedAt', () => {
    expect(
      shouldApplyUserStatsUpdate(
        { statsVersion: 2, lastUpdatedAt: 100, 'packs.messages.lastUpdatedAt': 100 },
        { statsVersion: 2, lastUpdatedAt: 99, 'packs.messages.lastUpdatedAt': 101 }
      )
    ).toBe(true);

    expect(
      shouldApplyUserStatsUpdate(
        { statsVersion: 2, lastUpdatedAt: 200, 'packs.messages.lastUpdatedAt': 200 },
        { statsVersion: 2, lastUpdatedAt: 100, 'packs.messages.lastUpdatedAt': 150 }
      )
    ).toBe(false);
  });

  test('симулирует bounce 0→1 после markAllRead: stale message.create отклоняется', () => {
    const afterMarkAllRead = {
      statsVersion: 4,
      lastUpdatedAt: 1000,
      'packs.messages.lastUpdatedAt': 1000,
      'packs.messages.totalUnreadCount': 0
    };
    const staleMessageCreate = {
      statsVersion: 3,
      lastUpdatedAt: 900,
      'packs.messages.lastUpdatedAt': 900,
      'packs.messages.totalUnreadCount': 1
    };

    expect(shouldApplyUserStatsUpdate(afterMarkAllRead, staleMessageCreate)).toBe(false);
    expect(shouldApplyUserStatsUpdate(null, afterMarkAllRead)).toBe(true);
  });
});
