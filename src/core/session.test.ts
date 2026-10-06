import { describe, expect, it } from 'vitest';

import { buildSession, canRequeue, countDue, requeue, sessionPreview, shuffleOptions } from './session.ts';
import { DAY_MS, createCard, type CardState } from './srs.ts';
import type { Exercise } from './types.ts';

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
    kind: 'multiple-choice',
    id,
    deckId,
    prompt: `${id} ___`,
    answer: 'i',
    options: ['i', 'på', 'til', 'av'],
    level,
    tags: ['i'],
  };
}

function cardsOf(entries: readonly CardState[]): Record<string, CardState> {
  return Object.fromEntries(entries.map((card) => [card.exerciseId, card]));
}

describe('buildSession', () => {
  it('introduces at most the configured number of new exercises', () => {
    const pool = Array.from({ length: 50 }, (_unused, index) => exercise(`e${index}`));

    const queue = buildSession(pool, {}, { newPerSession: 5, random: () => 0 }, NOW);

    expect(queue).toHaveLength(5);
  });

  it('prefers due cards and fills the rest with new material', () => {
    const pool = [exercise('seen'), exercise('fresh-a'), exercise('fresh-b')];
    const due = { ...createCard('seen', 'deck', NOW), due: NOW - DAY_MS };

    const queue = buildSession(pool, cardsOf([due]), { newPerSession: 1, random: () => 0 }, NOW);

    expect(queue.map((item) => item.id)).toContain('seen');
    expect(queue).toHaveLength(2);
  });

  it('leaves out cards that are not due yet', () => {
    const pool = [exercise('later')];
    const future = { ...createCard('later', 'deck', NOW), due: NOW + DAY_MS };

    const queue = buildSession(pool, cardsOf([future]), { newPerSession: 0, random: () => 0 }, NOW);

    expect(queue).toHaveLength(0);
  });

  it('ignores stored cards whose exercise no longer exists', () => {
    const orphan = { ...createCard('removed', 'deck', NOW), due: NOW - DAY_MS };

    const queue = buildSession([], cardsOf([orphan]), { newPerSession: 5, random: () => 0 }, NOW);

    expect(queue).toHaveLength(0);
  });

  it('never exceeds the session size even with many due cards', () => {
    const pool = Array.from({ length: 80 }, (_unused, index) => exercise(`e${index}`));
    const cards = pool.map((item) => ({ ...createCard(item.id, 'deck', NOW), due: NOW - DAY_MS }));

    const queue = buildSession(
      pool,
      cardsOf(cards),
      { newPerSession: 10, sessionSize: 20, random: () => 0 },
      NOW,
    );

    expect(queue).toHaveLength(20);
  });

  it('draws new material from the easiest levels first', () => {
    const pool = [exercise('hard', 3), exercise('easy', 1), exercise('medium', 2)];

    const queue = buildSession(pool, {}, { newPerSession: 1, random: () => 0 }, NOW);

    expect(queue[0]?.id).toBe('easy');
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

    const preview = sessionPreview(pool, cards, 5, NOW);
    const queue = buildSession(pool, cards, { newPerSession: 5, random: () => 0 }, NOW);

    expect(preview).toEqual({ due: 1, fresh: 5, unseen: 29, totalDue: 1 });
    expect(queue).toHaveLength(preview.due + preview.fresh);
  });
});
