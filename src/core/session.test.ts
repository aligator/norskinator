import { describe, expect, it } from 'vitest';

import {
  buildPracticeSession,
  buildSession,
  canRequeue,
  countDue,
  requeue,
  sessionPreview,
  shuffleOptions,
} from './session.ts';
import { CardPhase, DAY_MS, createCard, type CardState } from './srs.ts';
import { ExerciseKind, type Exercise } from './types.ts';

const NOW = Date.parse('2026-01-15T10:00:00Z');

/** Cycles through fixed values so ordering in tests is reproducible. */
function sequence(values: readonly number[]): () => number {
  let index = 0;

  return () => {
    const value = values[index % values.length]!;
    index += 1;

    return value;
  };
}

function exercise(id: string, level: 1 | 2 | 3 = 1, deckId = 'deck'): Exercise {
  return {
    kind: ExerciseKind.MultipleChoice,
    id,
    deckId,
    prompt: `${id} ___`,
    answer: 'i',
    options: ['i', 'på', 'til', 'av'],
    level,
    tags: ['i'],
  };
}

function countInDeck(queue: readonly Exercise[], deckId: string): number {
  return queue.filter((item) => item.deckId === deckId).length;
}

function cardsOf(entries: readonly CardState[]): Record<string, CardState> {
  return Object.fromEntries(entries.map((card) => [card.exerciseId, card]));
}

describe('buildSession', () => {
  it('introduces at most the configured number of new exercises', () => {
    const pool = Array.from({ length: 50 }, (_unused, index) => exercise(`e${index}`));

    const queue = buildSession(pool, {}, { newLeft: 5, reviewsLeft: 1000, random: () => 0 }, NOW);

    expect(queue).toHaveLength(5);
  });

  it('prefers due cards and fills the rest with new material', () => {
    const pool = [exercise('seen'), exercise('fresh-a'), exercise('fresh-b')];
    const due = { ...createCard('seen', 'deck', NOW), due: NOW - DAY_MS };

    const queue = buildSession(pool, cardsOf([due]), { newLeft: 1, reviewsLeft: 1000, random: () => 0 }, NOW);

    expect(queue.map((item) => item.id)).toContain('seen');
    expect(queue).toHaveLength(2);
  });

  it('leaves out cards that are not due yet', () => {
    const pool = [exercise('later')];
    const future = { ...createCard('later', 'deck', NOW), due: NOW + DAY_MS };

    const queue = buildSession(pool, cardsOf([future]), { newLeft: 0, reviewsLeft: 1000, random: () => 0 }, NOW);

    expect(queue).toHaveLength(0);
  });

  it('ignores stored cards whose exercise no longer exists', () => {
    const orphan = { ...createCard('removed', 'deck', NOW), due: NOW - DAY_MS };

    const queue = buildSession([], cardsOf([orphan]), { newLeft: 5, reviewsLeft: 1000, random: () => 0 }, NOW);

    expect(queue).toHaveLength(0);
  });

  it('never exceeds the session size even with many due cards', () => {
    const pool = Array.from({ length: 80 }, (_unused, index) => exercise(`e${index}`));
    const cards = pool.map((item) => ({ ...createCard(item.id, 'deck', NOW), due: NOW - DAY_MS }));

    const queue = buildSession(
      pool,
      cardsOf(cards),
      { newLeft: 10, reviewsLeft: 1000, sessionSize: 20, random: () => 0 },
      NOW,
    );

    expect(queue).toHaveLength(20);
  });

  it('draws new material from the easiest levels first', () => {
    const pool = [exercise('hard', 3), exercise('easy', 1), exercise('medium', 2)];

    const queue = buildSession(pool, {}, { newLeft: 1, reviewsLeft: 1000, random: () => 0 }, NOW);

    expect(queue[0]?.id).toBe('easy');
  });

  it('mixes the pools of a deck within a level instead of taking the first one', () => {
    const authored = Array.from({ length: 60 }, (_unused, index) => exercise(`authored-${index}`));
    const corpus = Array.from({ length: 60 }, (_unused, index) => exercise(`corpus-${index}`));
    const random = sequence([0.13, 0.71, 0.42, 0.88, 0.05, 0.57, 0.33, 0.96]);

    const queue = buildSession([...authored, ...corpus], {}, { newLeft: 6, reviewsLeft: 1000, random }, NOW);

    expect(queue.some((item) => item.id.startsWith('corpus-'))).toBe(true);
    expect(queue.some((item) => item.id.startsWith('authored-'))).toBe(true);
  });

  it('splits new material evenly across decks', () => {
    const pool = [
      ...Array.from({ length: 100 }, (_unused, index) => exercise(`a${index}`, 1, 'big')),
      ...Array.from({ length: 20 }, (_unused, index) => exercise(`b${index}`, 1, 'small')),
      ...Array.from({ length: 20 }, (_unused, index) => exercise(`c${index}`, 1, 'other')),
    ];

    const queue = buildSession(pool, {}, { newLeft: 9, reviewsLeft: 1000, random: () => 0 }, NOW);

    expect(countInDeck(queue, 'big')).toBe(3);
    expect(countInDeck(queue, 'small')).toBe(3);
    expect(countInDeck(queue, 'other')).toBe(3);
  });

  it('ranks levels within a deck, not across decks', () => {
    const pool = [
      ...Array.from({ length: 100 }, (_unused, index) => exercise(`easy${index}`, 1, 'first')),
      ...Array.from({ length: 10 }, (_unused, index) => exercise(`hard${index}`, 3, 'second')),
    ];

    const queue = buildSession(pool, {}, { newLeft: 10, reviewsLeft: 1000, random: () => 0 }, NOW);

    expect(countInDeck(queue, 'second')).toBe(5);
  });

  it('hands the slots of an exhausted deck to the others', () => {
    const pool = [
      exercise('only', 1, 'tiny'),
      ...Array.from({ length: 20 }, (_unused, index) => exercise(`e${index}`, 1, 'large')),
    ];

    const queue = buildSession(pool, {}, { newLeft: 6, reviewsLeft: 1000, random: () => 0 }, NOW);

    expect(queue).toHaveLength(6);
    expect(countInDeck(queue, 'tiny')).toBe(1);
  });

  it('keeps room for other decks when one deck has a large review backlog', () => {
    const backlog = Array.from({ length: 40 }, (_unused, index) => exercise(`a${index}`, 1, 'backlog'));
    const quiet = Array.from({ length: 20 }, (_unused, index) => exercise(`b${index}`, 1, 'quiet'));
    const cards = backlog.map((item) => ({ ...createCard(item.id, 'backlog', NOW), due: NOW - DAY_MS }));

    const queue = buildSession([...backlog, ...quiet], cardsOf(cards), { newLeft: 10, reviewsLeft: 1000, random: () => 0 }, NOW);

    expect(queue).toHaveLength(20);
    expect(countInDeck(queue, 'quiet')).toBeGreaterThan(0);
  });

  it('shares review slots across decks', () => {
    const large = Array.from({ length: 40 }, (_unused, index) => exercise(`a${index}`, 1, 'large'));
    const small = Array.from({ length: 5 }, (_unused, index) => exercise(`b${index}`, 1, 'small'));
    const cards = [...large, ...small].map((item) => ({
      ...createCard(item.id, item.deckId, NOW),
      due: NOW - DAY_MS,
    }));

    const queue = buildSession([...large, ...small], cardsOf(cards), { newLeft: 0, reviewsLeft: 1000, random: () => 0 }, NOW);

    expect(countInDeck(queue, 'small')).toBe(5);
    expect(countInDeck(queue, 'large')).toBe(15);
  });

  it('mixes new items and reviews in proportion to what is available today', () => {
    const seen = Array.from({ length: 30 }, (_unused, index) => exercise(`s${index}`));
    const fresh = Array.from({ length: 30 }, (_unused, index) => exercise(`f${index}`));
    const cards = seen.map((item) => ({ ...createCard(item.id, 'deck', NOW), phase: CardPhase.Review, due: NOW - DAY_MS }));

    const queue = buildSession([...seen, ...fresh], cardsOf(cards), { newLeft: 10, reviewsLeft: 30, random: () => 0 }, NOW);
    const newOnes = queue.filter((item) => item.id.startsWith('f')).length;

    expect(queue).toHaveLength(20);
    expect(newOnes).toBe(5);
  });

  it('does not let a backlog keep new items out', () => {
    const seen = Array.from({ length: 200 }, (_unused, index) => exercise(`s${index}`));
    const fresh = Array.from({ length: 30 }, (_unused, index) => exercise(`f${index}`));
    const cards = seen.map((item) => ({ ...createCard(item.id, 'deck', NOW), phase: CardPhase.Review, due: NOW - DAY_MS }));

    const queue = buildSession([...seen, ...fresh], cardsOf(cards), { newLeft: 10, reviewsLeft: 100, random: () => 0 }, NOW);

    expect(queue.some((item) => item.id.startsWith('f'))).toBe(true);
  });

  it('takes no more graduated cards than today\'s review limit allows', () => {
    const pool = Array.from({ length: 40 }, (_unused, index) => exercise(`e${index}`));
    const cards = pool.map((item) => ({ ...createCard(item.id, 'deck', NOW), phase: CardPhase.Review, due: NOW - DAY_MS }));

    const queue = buildSession(pool, cardsOf(cards), { newLeft: 0, reviewsLeft: 5, random: () => 0 }, NOW);

    expect(queue).toHaveLength(5);
  });

  it('keeps the earliest due cards when the review limit cuts the rest', () => {
    const pool = [exercise('late'), exercise('early')];
    const cards = [
      { ...createCard('late', 'deck', NOW), phase: CardPhase.Review, due: NOW - 1000 },
      { ...createCard('early', 'deck', NOW), phase: CardPhase.Review, due: NOW - DAY_MS },
    ];

    const queue = buildSession(pool, cardsOf(cards), { newLeft: 0, reviewsLeft: 1, random: () => 0 }, NOW);

    expect(queue.map((item) => item.id)).toEqual(['early']);
  });

  it('always takes cards still being learned, whatever the review limit', () => {
    const pool = [exercise('failed'), exercise('relearning'), exercise('graduated')];
    const cards = [
      { ...createCard('failed', 'deck', NOW), phase: CardPhase.Learning, due: NOW - 1000 },
      { ...createCard('relearning', 'deck', NOW), phase: CardPhase.Relearning, due: NOW - 1000 },
      { ...createCard('graduated', 'deck', NOW), phase: CardPhase.Review, due: NOW - 1000 },
    ];

    const queue = buildSession(pool, cardsOf(cards), { newLeft: 0, reviewsLeft: 0, random: () => 0 }, NOW);

    expect(queue.map((item) => item.id).sort()).toEqual(['failed', 'relearning']);
  });

  it('introduces no new items once today\'s limit is used up', () => {
    const fresh = Array.from({ length: 10 }, (_unused, index) => exercise(`f${index}`));

    expect(buildSession(fresh, {}, { newLeft: 0, reviewsLeft: 100, random: () => 0 }, NOW)).toHaveLength(0);
  });

  it('rotates which deck gets the remainder of an uneven split', () => {
    const pool = [
      ...Array.from({ length: 10 }, (_unused, index) => exercise(`a${index}`, 1, 'first')),
      ...Array.from({ length: 10 }, (_unused, index) => exercise(`b${index}`, 1, 'second')),
    ];

    const queue = buildSession(pool, {}, { newLeft: 3, reviewsLeft: 1000, random: () => 0.99 }, NOW);

    expect(countInDeck(queue, 'second')).toBe(2);
  });
});

describe('buildPracticeSession', () => {
  it('picks known items only, even when they are not due', () => {
    const pool = [exercise('known-a'), exercise('known-b'), exercise('fresh')];
    const later = (id: string): CardState => ({ ...createCard(id, 'deck', NOW), due: NOW + DAY_MS });

    const queue = buildPracticeSession(pool, cardsOf([later('known-a'), later('known-b')]), { random: () => 0 });

    expect(queue.map((item) => item.id).sort()).toEqual(['known-a', 'known-b']);
  });

  it('falls back to every item when nothing is known yet', () => {
    const pool = Array.from({ length: 30 }, (_unused, index) => exercise(`e${index}`));

    expect(buildPracticeSession(pool, {}, { sessionSize: 8, random: () => 0.5 })).toHaveLength(8);
  });
});

describe('requeue', () => {
  it('reinserts a failed exercise a few steps later', () => {
    const queue = [exercise('a'), exercise('b'), exercise('c'), exercise('d'), exercise('e')];

    const next = requeue(queue, 0, queue[0]!);

    expect(next.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd', 'a', 'e']);
  });

  it('appends at the end when the queue is nearly over', () => {
    const queue = [exercise('a'), exercise('b')];

    const next = requeue(queue, 1, queue[1]!);

    expect(next.map((item) => item.id)).toEqual(['a', 'b', 'b']);
  });
});

describe('canRequeue', () => {
  it('allows one re-queue per exercise and session', () => {
    expect(canRequeue([], 'a')).toBe(true);
    expect(canRequeue(['b'], 'a')).toBe(true);
    expect(canRequeue(['a'], 'a')).toBe(false);
  });
});

describe('countDue', () => {
  it('counts only cards that are due now', () => {
    const cards = cardsOf([
      { ...createCard('a', 'deck', NOW), due: NOW - 1 },
      { ...createCard('b', 'deck', NOW), due: NOW + DAY_MS },
    ]);

    expect(countDue(cards, NOW)).toBe(1);
  });

  it('skips cards whose exercise is no longer loaded', () => {
    const cards = cardsOf([
      { ...createCard('kept', 'deck', NOW), due: NOW - 1 },
      { ...createCard('removed', 'deck', NOW), due: NOW - 1 },
    ]);

    expect(countDue(cards, NOW, new Set(['kept']))).toBe(1);
  });
});

describe('shuffleOptions', () => {
  it('keeps every option exactly once', () => {
    const options = ['i', 'på', 'til', 'av'];

    const shuffled = shuffleOptions(options, sequence([0.9, 0.1, 0.5, 0.3]));

    expect([...shuffled].sort()).toEqual([...options].sort());
  });

  it('does not mutate the input', () => {
    const options = ['i', 'på', 'til', 'av'];

    shuffleOptions(options, sequence([0.9, 0.1, 0.5]));

    expect(options).toEqual(['i', 'på', 'til', 'av']);
  });
});

describe('sessionPreview', () => {
  it('matches what buildSession picks', () => {
    const pool = Array.from({ length: 30 }, (_unused, index) => exercise(`e${index}`));
    const due = { ...createCard('e0', 'deck', NOW), due: NOW - DAY_MS };
    const cards = cardsOf([due]);

    const preview = sessionPreview(pool, cards, { newLeft: 5, reviewsLeft: 1000 }, NOW);
    const queue = buildSession(pool, cards, { newLeft: 5, reviewsLeft: 1000, random: () => 0 }, NOW);

    expect(preview).toEqual({ due: 1, fresh: 5, unseen: 29, totalDue: 1, heldBack: 0, newLeft: 5 });
    expect(queue).toHaveLength(preview.due + preview.fresh);
  });

  it('reports the due cards the review limit holds back', () => {
    const pool = Array.from({ length: 10 }, (_unused, index) => exercise(`e${index}`));
    const cards = cardsOf(
      pool.map((item) => ({ ...createCard(item.id, 'deck', NOW), phase: CardPhase.Review, due: NOW - DAY_MS })),
    );

    const preview = sessionPreview(pool, cards, { newLeft: 0, reviewsLeft: 4 }, NOW);

    expect(preview).toMatchObject({ due: 4, totalDue: 4, heldBack: 6 });
  });
});
