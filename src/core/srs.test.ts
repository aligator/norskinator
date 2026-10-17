import { describe, expect, it } from 'vitest';

import { DAY_MS, createCard, dueCards, isDue, ratingOptions, review, type CardState } from './srs.ts';

const NOW = Date.parse('2026-01-15T10:00:00Z');
const MINUTE_MS = 60_000;

/** Answers right whenever the card is due, `count` times. */
function answeredGood(count: number): CardState {
  let card = createCard('a', 'deck', NOW);

  for (let step = 0; step < count; step += 1) {
    card = review(card, 'good', card.due);
  }

  return card;
}

/** A card that left the learning steps. */
const graduated = (): CardState => answeredGood(2);

describe('learning steps', () => {
  it('keeps a new card learning after the first right answer and graduates it after the second', () => {
    const first = answeredGood(1);
    const second = review(first, 'good', first.due);

    expect(first.phase).toBe('learning');
    expect(first.due - NOW).toBe(10 * MINUTE_MS);
    expect(second.phase).toBe('review');
    expect(second.due - first.due).toBeGreaterThanOrEqual(DAY_MS);
  });

  it('lets an easy first answer graduate at once, with a longer wait than a good one', () => {
    const easy = review(createCard('a', 'deck', NOW), 'easy', NOW);

    expect(easy.phase).toBe('review');
    expect(easy.due - NOW).toBeGreaterThan(graduated().due - NOW - 10 * MINUTE_MS);
  });

  it('brings a failed new card back after a minute', () => {
    const failed = review(createCard('a', 'deck', NOW), 'again', NOW);

    expect(failed.phase).toBe('learning');
    expect(failed.lapses).toBe(0);
    expect(failed.due - NOW).toBe(MINUTE_MS);
  });

  it('brings a forgotten graduated card back in ten minutes', () => {
    const card = graduated();
    const lapsed = review(card, 'again', card.due);

    expect(lapsed.phase).toBe('relearning');
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.due - card.due).toBe(10 * MINUTE_MS);
  });

  it('graduates a forgotten card again on the next right answer', () => {
    const card = graduated();
    const lapsed = review(card, 'again', card.due);
    const recovered = review(lapsed, 'good', lapsed.due);

    expect(recovered.phase).toBe('review');
    expect(recovered.due - lapsed.due).toBeGreaterThanOrEqual(DAY_MS);
  });

  it('treats hard on a card being learned as hard, not as good', () => {
    const fresh = createCard('a', 'deck', NOW);

    expect(review(fresh, 'hard', NOW).phase).toBe('learning');
    expect(review(fresh, 'hard', NOW).due).toBeLessThan(review(fresh, 'good', NOW).due);
  });
});

describe('review', () => {
  it('is deterministic: the same card and time schedule the same way', () => {
    const card = answeredGood(4);

    expect(review(card, 'good', card.due)).toEqual(review(card, 'good', card.due));
  });

  it('schedules from the clock the learner sees when it was set back behind the last review', () => {
    const card = graduated();
    const behind = card.lastReviewed! - 3 * DAY_MS;
    const again = review(card, 'again', behind);

    expect(() => review(card, 'good', behind)).not.toThrow();
    expect(again.lastReviewed).toBe(behind);
    expect(again.due).toBe(behind + 10 * MINUTE_MS);
    expect(review(card, 'good', behind).lastReviewed).toBe(behind);
  });

  it('does not throw for any phase and grade with the clock behind the last review', () => {
    const learning = answeredGood(1);
    const relearning = review(graduated(), 'again', graduated().due);
    const cards = [review(createCard('a', 'deck', NOW), 'good', NOW), learning, graduated(), relearning];
    const offsets = [MINUTE_MS, 3 * DAY_MS, 400 * DAY_MS, 5 * 365 * DAY_MS];

    expect(cards.map((card) => card.phase)).toEqual(['learning', 'learning', 'review', 'relearning']);

    for (const card of cards) {
      for (const offset of offsets) {
        for (const grade of ['again', 'hard', 'good', 'easy'] as const) {
          const behind = card.lastReviewed! - offset;
          const next = review(card, grade, behind);

          expect(next.lastReviewed).toBe(behind);
          expect(next.due).toBeGreaterThan(behind);
        }
      }
    }
  });

  it('counts a new card with a last review in the future from the clock', () => {
    const card = { ...createCard('a', 'deck', NOW), lastReviewed: NOW + DAY_MS };

    expect(() => review(card, 'good', NOW)).not.toThrow();
    expect(review(card, 'good', NOW).lastReviewed).toBe(NOW);
    expect(review(card, 'good', NOW).due).toBe(NOW + 10 * MINUTE_MS);
  });

  it('counts a learning card with a last review in the future from the clock', () => {
    const first = answeredGood(1);
    const behind = first.lastReviewed! - DAY_MS;
    const next = review(first, 'good', behind);

    expect(first.phase).toBe('learning');
    expect(next.lastReviewed).toBe(behind);
    expect(next.due).toBeGreaterThan(behind);
    expect(next.due - behind).toBe(review({ ...first, lastReviewed: behind }, 'good', behind).due - behind);
  });

  it('records the answer on the card', () => {
    const card = review(createCard('a', 'deck', NOW), 'hard', NOW);

    expect(card).toMatchObject({ reps: 1, lastReviewed: NOW, lastGrade: 'hard' });
    expect(card.stability).toBeGreaterThan(0);
    expect(card.difficulty).toBeGreaterThanOrEqual(1);
  });

  it('grows the stability and the wait on repeated success', () => {
    const first = graduated();
    const second = review(first, 'good', first.due);

    expect(second.stability).toBeGreaterThan(first.stability);
    expect(second.due - first.due).toBeGreaterThan(first.due - first.lastReviewed!);
  });

  it('remembers less after a lapse than before it', () => {
    const grown = answeredGood(5);
    const lapsed = review(grown, 'again', grown.due);

    expect(lapsed.stability).toBeLessThan(grown.stability);
  });

  it('counts a lapse only when a graduated card is forgotten', () => {
    const failedNew = review(createCard('a', 'deck', NOW), 'again', NOW);
    const failedAgain = review(failedNew, 'again', NOW + MINUTE_MS);

    expect(failedAgain.lapses).toBe(0);
    expect(failedAgain.failures).toBe(2);
  });

  it('keeps hard shorter than good and good shorter than easy on a graduated card', () => {
    const card = graduated();
    const wait = (grade: 'hard' | 'good' | 'easy'): number => review(card, grade, card.due).due - card.due;

    expect(wait('hard')).toBeLessThan(wait('good'));
    expect(wait('good')).toBeLessThan(wait('easy'));
  });

  it('lets the wait grow far beyond a year for what is known well', () => {
    let card = createCard('a', 'deck', NOW);

    for (let step = 0; step < 12; step += 1) {
      card = review(card, 'easy', card.due);
    }

    expect(card.due - (card.lastReviewed ?? 0)).toBeGreaterThan(365 * DAY_MS);
  });
});

describe('ratingOptions', () => {
  it('offers hard, good and easy, each longer than the one before', () => {
    const card = graduated();
    const options = ratingOptions(card, card.due);

    expect(options.map((option) => option.grade)).toEqual(['hard', 'good', 'easy']);
    expect(options[0]!.delayMs).toBeLessThan(options[1]!.delayMs);
    expect(options[1]!.delayMs).toBeLessThan(options[2]!.delayMs);
  });

  it('offers the same ratings on a new card', () => {
    const options = ratingOptions(createCard('a', 'deck', NOW), NOW);

    expect(options.map((option) => option.grade)).toEqual(['hard', 'good', 'easy']);
  });

  it('shows exactly the wait the review will give', () => {
    const card = graduated();

    for (const option of ratingOptions(card, card.due)) {
      expect(review(card, option.grade, card.due).due).toBe(card.due + option.delayMs);
    }
  });
});

describe('ratingOptions with the clock set back', () => {
  it('measures every delay from the clock the learner sees', () => {
    const card = graduated();
    const behind = card.lastReviewed! - 3 * DAY_MS;

    for (const option of ratingOptions(card, behind)) {
      expect(option.delayMs).toBe(review(card, option.grade, behind).due - behind);
      expect(option.delayMs).toBeGreaterThan(0);
    }
  });

  it('offers the same delays as for a card last reviewed at the clock', () => {
    const card = graduated();
    const behind = card.lastReviewed! - 3 * DAY_MS;
    const reviewedNow = { ...card, lastReviewed: behind, due: behind + (card.due - card.lastReviewed!) };

    expect(ratingOptions(card, behind)).toEqual(ratingOptions(reviewedNow, behind));
    expect(ratingOptions(card, behind)[0]!.delayMs).toBeGreaterThan(0);
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
