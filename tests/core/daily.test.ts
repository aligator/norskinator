import { describe, expect, it } from 'vitest';

import { CountedAnswer, dailyRoom, recommendedReviewLimit, recordCounted } from '../../src/core/daily.ts';
import { INITIAL_PROGRESS } from '../../src/core/gamification.ts';

const NOW = Date.parse('2026-01-15T10:00:00Z');
const LIMITS = { newPerDay: 10, reviewsPerDay: 100 };

describe('dailyRoom', () => {
  it('offers the whole limit on a day nothing was counted', () => {
    expect(dailyRoom(INITIAL_PROGRESS, LIMITS, NOW)).toEqual({ newLeft: 10, reviewsLeft: 100 });
  });

  it('subtracts what was counted today', () => {
    const counted = recordCounted(recordCounted(INITIAL_PROGRESS, CountedAnswer.New, NOW), CountedAnswer.Review, NOW);

    expect(dailyRoom(counted, LIMITS, NOW + 1000)).toEqual({ newLeft: 9, reviewsLeft: 99 });
  });

  it('starts from zero on the next local day', () => {
    const counted = recordCounted(INITIAL_PROGRESS, CountedAnswer.New, NOW);

    expect(dailyRoom(counted, LIMITS, NOW + 24 * 3_600_000)).toEqual({ newLeft: 10, reviewsLeft: 100 });
  });

  it('never goes below zero when the limit is lowered after counting', () => {
    const counted = recordCounted(INITIAL_PROGRESS, CountedAnswer.New, NOW);

    expect(dailyRoom(counted, { newPerDay: 0, reviewsPerDay: 10 }, NOW).newLeft).toBe(0);
  });
});

describe('recordCounted', () => {
  it('counts new items and reviews separately', () => {
    const reviewed = recordCounted(recordCounted(INITIAL_PROGRESS, CountedAnswer.New, NOW), CountedAnswer.Review, NOW);
    const counted = recordCounted(reviewed, CountedAnswer.Review, NOW);

    expect(counted).toMatchObject({ newToday: 1, reviewsToday: 2, limitsDay: '2026-01-15' });
  });

  it('resets both counters when the day changes', () => {
    const yesterday = recordCounted(recordCounted(INITIAL_PROGRESS, CountedAnswer.New, NOW), CountedAnswer.Review, NOW);
    const today = recordCounted(yesterday, CountedAnswer.Review, NOW + 24 * 3_600_000);

    expect(today).toMatchObject({ newToday: 0, reviewsToday: 1 });
  });
});

describe('recommendedReviewLimit', () => {
  it('follows the rule of thumb of ten reviews per new item', () => {
    expect(recommendedReviewLimit(10)).toBe(100);
    expect(recommendedReviewLimit(0)).toBe(0);
  });
});
