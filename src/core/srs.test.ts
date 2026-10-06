import { describe, expect, it } from 'vitest';

import { DAY_MS, createCard, dueCards, gradeFromAnswer, isDue, review } from './srs.ts';

const NOW = Date.parse('2026-01-15T10:00:00Z');

describe('review', () => {
  it('schedules a new card one day ahead on first success', () => {
    const card = review(createCard('a', 'deck', NOW), 'good', NOW);

    expect(card.phase).toBe('review');
    expect(card.intervalDays).toBe(1);
    expect(card.due).toBe(NOW + DAY_MS);
  });

  it('gives an easy first answer a longer head start', () => {
    const card = review(createCard('a', 'deck', NOW), 'easy', NOW);

    expect(card.intervalDays).toBe(3);
  });

  it('grows the interval by the ease factor on repeated success', () => {
    const first = review(createCard('a', 'deck', NOW), 'good', NOW);
    const second = review(first, 'good', first.due);

    expect(second.intervalDays).toBe(Math.round(first.intervalDays * first.ease));
    expect(second.intervalDays).toBeGreaterThan(first.intervalDays);
  });

  it('sends a failed card back into learning within the session', () => {
    const learned = review(createCard('a', 'deck', NOW), 'good', NOW);
    const failed = review(learned, 'again', NOW + DAY_MS);

    expect(failed.phase).toBe('learning');
    expect(failed.intervalDays).toBe(0);
    expect(failed.lapses).toBe(1);
    expect(failed.due - (NOW + DAY_MS)).toBeLessThanOrEqual(60_000);
  });

  it('restarts from a short interval after a lapse instead of resuming the old one', () => {
    let card = createCard('a', 'deck', NOW);

    for (let step = 0; step < 4; step += 1) {
      card = review(card, 'good', card.due);
    }

    const beforeLapse = card.intervalDays;
    const lapsed = review(card, 'again', card.due);
    const relearned = review(lapsed, 'good', lapsed.due);

    expect(beforeLapse).toBeGreaterThan(5);
    expect(relearned.intervalDays).toBe(1);
  });

  it('counts a lapse only when a graduated card is forgotten', () => {
    const failedNew = review(createCard('a', 'deck', NOW), 'again', NOW);
    const failedAgain = review(failedNew, 'again', NOW + 60_000);

    expect(failedAgain.lapses).toBe(0);
    expect(failedAgain.failures).toBe(2);
  });

  it('caps a quick right answer right after a failure at good', () => {
    const failed = review(createCard('a', 'deck', NOW), 'again', NOW);
    const relearned = review(failed, 'easy', failed.due);

    expect(relearned.intervalDays).toBe(1);
  });

  it('grows the interval a little on hard instead of shrinking it', () => {
    const graduated = { ...review(createCard('a', 'deck', NOW), 'good', NOW), intervalDays: 10 };
    const short = { ...graduated, intervalDays: 2 };

    expect(review(graduated, 'hard', NOW).intervalDays).toBe(12);
    expect(review(short, 'hard', NOW).intervalDays).toBe(3);
  });

  it('never lets the ease factor drop below the SM-2 floor', () => {
    let card = createCard('a', 'deck', NOW);

    for (let step = 0; step < 20; step += 1) {
      card = review(card, 'again', NOW);
    }

    expect(card.ease).toBeCloseTo(1.3, 5);
  });

  it('caps the interval at a year', () => {
    let card = createCard('a', 'deck', NOW);

    for (let step = 0; step < 30; step += 1) {
      card = review(card, 'easy', card.due);
    }

    expect(card.intervalDays).toBe(365);
  });
});

describe('gradeFromAnswer', () => {
  it('treats a wrong answer as a lapse regardless of speed', () => {
    expect(gradeFromAnswer(false, 500)).toBe('again');
  });

  it('rewards a fast correct answer and penalises a slow one', () => {
    expect(gradeFromAnswer(true, 2000)).toBe('easy');
    expect(gradeFromAnswer(true, 8000)).toBe('good');
    expect(gradeFromAnswer(true, 20_000)).toBe('hard');
  });

  it('does not read a backgrounded tab or a clock change as difficulty', () => {
    expect(gradeFromAnswer(true, 10 * 60_000)).toBe('good');
    expect(gradeFromAnswer(true, -5000)).toBe('good');
  });
});

describe('dueCards', () => {
  it('returns only due cards, soonest first', () => {
    const early = { ...createCard('early', 'deck', NOW), due: NOW - 1000 };
    const late = { ...createCard('late', 'deck', NOW), due: NOW - 10 };
    const future = { ...createCard('future', 'deck', NOW), due: NOW + DAY_MS };

    expect(dueCards([future, late, early], NOW).map((card) => card.exerciseId)).toEqual([
      'early',
      'late',
    ]);
    expect(isDue(future, NOW)).toBe(false);
  });
});
