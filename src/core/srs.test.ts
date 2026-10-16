import { describe, expect, it } from 'vitest';

import { DAY_MS, createCard, dueCards, isDue, ratingOptions, review, type CardState } from './srs.ts';

const NOW = Date.parse('2026-01-15T10:00:00Z');

function reviewedGood(steps: number): CardState {
  let card = createCard('a', 'deck', NOW);

  for (let step = 0; step < steps; step += 1) {
    card = review(card, 'good', card.due);
  }

  return card;
}

describe('review', () => {
  it('graduates a new card on the first right answer', () => {
    const card = review(createCard('a', 'deck', NOW), 'good', NOW);

    expect(card.phase).toBe('review');
    expect(card.reps).toBe(1);
    expect(card.lastReviewed).toBe(NOW);
    expect(card.stability).toBeGreaterThan(0);
    expect(card.due).toBeGreaterThanOrEqual(NOW + DAY_MS);
  });

  it('gives an easy first answer a longer head start than a good one', () => {
    const good = review(createCard('a', 'deck', NOW), 'good', NOW);
    const easy = review(createCard('a', 'deck', NOW), 'easy', NOW);

    expect(easy.due).toBeGreaterThan(good.due);
    expect(easy.stability).toBeGreaterThan(good.stability);
  });

  it('is deterministic: the same card and time schedule the same way', () => {
    const card = reviewedGood(3);

    expect(review(card, 'good', card.due)).toEqual(review(card, 'good', card.due));
  });

  it('grows the stability and the wait on repeated success', () => {
    const first = reviewedGood(1);
    const second = review(first, 'good', first.due);

    expect(second.stability).toBeGreaterThan(first.stability);
    expect(second.due - first.due).toBeGreaterThan(first.due - NOW);
  });

  it('sends a failed card back into relearning within the session', () => {
    const learned = reviewedGood(1);
    const failed = review(learned, 'again', learned.due);

    expect(failed.phase).toBe('relearning');
    expect(failed.lapses).toBe(1);
    expect(failed.due - learned.due).toBeLessThanOrEqual(60_000);
  });

  it('sends a failed new card into learning within the session', () => {
    const failed = review(createCard('a', 'deck', NOW), 'again', NOW);

    expect(failed.phase).toBe('learning');
    expect(failed.lapses).toBe(0);
    expect(failed.due - NOW).toBeLessThanOrEqual(60_000);
  });

  it('graduates a failed card again on the next right answer', () => {
    const grown = reviewedGood(3);
    const failed = review(grown, 'again', grown.due);
    const recovered = review(failed, 'good', failed.due);

    expect(recovered.phase).toBe('review');
    expect(recovered.due - failed.due).toBeGreaterThanOrEqual(DAY_MS);
  });

  it('remembers less after a lapse than before it', () => {
    const grown = reviewedGood(4);
    const lapsed = review(grown, 'again', grown.due);

    expect(lapsed.stability).toBeLessThan(grown.stability);
  });

  it('counts a lapse only when a graduated card is forgotten', () => {
    const failedNew = review(createCard('a', 'deck', NOW), 'again', NOW);
    const failedAgain = review(failedNew, 'again', NOW + 60_000);

    expect(failedAgain.lapses).toBe(0);
    expect(failedAgain.failures).toBe(2);
  });

  it('reads a hard answer on a card still being learned as good', () => {
    const fresh = createCard('a', 'deck', NOW);
    const failed = review(fresh, 'again', NOW);

    expect(review(fresh, 'hard', NOW)).toEqual(review(fresh, 'good', NOW));
    expect(review(failed, 'hard', failed.due)).toEqual(review(failed, 'good', failed.due));
  });

  it('keeps hard on a graduated card shorter than good', () => {
    const card = reviewedGood(3);

    expect(review(card, 'hard', card.due).due).toBeLessThan(review(card, 'good', card.due).due);
  });

  it('keeps the wait near a year however well it is known', () => {
    let card = createCard('a', 'deck', NOW);

    for (let step = 0; step < 30; step += 1) {
      card = review(card, 'easy', card.due);
    }

    // The library keeps hard < good < easy even at the cap, so easy may pass it by two days.
    expect(card.due - (card.lastReviewed ?? 0)).toBeLessThanOrEqual(367 * DAY_MS);
  });
});

describe('ratingOptions', () => {
  it('offers hard, good and easy on a graduated card, each longer than the one before', () => {
    const card = reviewedGood(2);
    const options = ratingOptions(card, card.due);

    expect(options.map((option) => option.grade)).toEqual(['hard', 'good', 'easy']);
    expect(options[0]!.delayMs).toBeLessThan(options[1]!.delayMs);
    expect(options[1]!.delayMs).toBeLessThan(options[2]!.delayMs);
  });

  it('offers no hard on a card still being learned', () => {
    expect(ratingOptions(createCard('a', 'deck', NOW), NOW).map((option) => option.grade)).toEqual(['good', 'easy']);
  });

  it('shows exactly the wait the review will give', () => {
    const card = reviewedGood(2);

    for (const option of ratingOptions(card, card.due)) {
      expect(review(card, option.grade, card.due).due).toBe(card.due + option.delayMs);
    }
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
