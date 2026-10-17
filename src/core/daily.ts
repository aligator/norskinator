/**
 * Daily limits, as in Anki and FSRS: so many new items and so many reviews of
 * graduated cards per day. Cards still being learned are never counted or
 * held back, so a failed card always comes back.
 *
 * The counters live in `Progress` and start from zero on a new local day.
 */
import { dayKey, type Progress } from './gamification.ts';

export interface DailyLimits {
  readonly newPerDay: number;
  readonly reviewsPerDay: number;
}

/** What is left of today's limits. */
export interface DailyRoom {
  readonly newLeft: number;
  readonly reviewsLeft: number;
}

export function dailyRoom(progress: Progress, limits: DailyLimits, now: number): DailyRoom {
  const counting = progress.limitsDay === dayKey(now);

  return {
    newLeft: Math.max(0, limits.newPerDay - (counting ? progress.newToday : 0)),
    reviewsLeft: Math.max(0, limits.reviewsPerDay - (counting ? progress.reviewsToday : 0)),
  };
}

export type CountedAnswer = 'new' | 'review';

/** Counts an answer that used up today's room: an item seen for the first time, or a graduated card. */
export function recordCounted(progress: Progress, kind: CountedAnswer, now: number): Progress {
  const today = dayKey(now);
  const counting = progress.limitsDay === today;
  const newToday = counting ? progress.newToday : 0;
  const reviewsToday = counting ? progress.reviewsToday : 0;

  return {
    ...progress,
    limitsDay: today,
    newToday: newToday + (kind === 'new' ? 1 : 0),
    reviewsToday: reviewsToday + (kind === 'review' ? 1 : 0),
  };
}

/**
 * Anki's rule of thumb: allow ten times as many reviews as new items per day,
 * or the reviews pile up. Returns the lowest sensible review limit.
 */
export const REVIEWS_PER_NEW = 10;

export function recommendedReviewLimit(newPerDay: number): number {
  return newPerDay * REVIEWS_PER_NEW;
}
