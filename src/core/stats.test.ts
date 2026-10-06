import { describe, expect, it } from 'vitest';

import { createCard, review, DAY_MS, type CardState } from './srs.ts';
import { deckCounts, tagMastery } from './stats.ts';
import type { Exercise } from './types.ts';

const NOW = Date.parse('2026-01-15T10:00:00Z');

function exercise(id: string, tag: string, deckId = 'deck'): Exercise {
  return {
    kind: 'multiple-choice',
    id,
    deckId,
    prompt: '___',
    answer: tag,
    options: [tag, 'x', 'y', 'z'],
    level: 1,
    tags: [tag, 'topic'],
  };
}

describe('tagMastery', () => {
  it('splits each tag into review, learning and unseen cards', () => {
    const exercises = [exercise('a', 'i'), exercise('b', 'i'), exercise('c', 'i')];
    const learned = review(createCard('a', 'deck', NOW), 'good', NOW);
    const failed = review(createCard('b', 'deck', NOW), 'again', NOW);

    const [mastery] = tagMastery(exercises, { a: learned, b: failed });

    expect(mastery).toMatchObject({ tag: 'i', review: 1, learning: 1, unseen: 1, total: 3 });
    expect(mastery?.accuracy).toBe(0.5);
  });

  it('lists the weakest practised tag before untouched and strong ones', () => {
    const exercises = [exercise('a', 'på'), exercise('b', 'i'), exercise('c', 'til')];
    const strong = review(createCard('a', 'deck', NOW), 'good', NOW);
    const weak = review(createCard('b', 'deck', NOW), 'again', NOW);

    const order = tagMastery(exercises, { a: strong, b: weak }).map((entry) => entry.tag);

    expect(order).toEqual(['i', 'til', 'på']);
  });
});

describe('deckCounts', () => {
  it('counts due and unseen exercises per deck', () => {
    const exercises = [exercise('a', 'i'), exercise('b', 'i'), exercise('c', 'i', 'other')];
    const due: CardState = { ...createCard('a', 'deck', NOW), due: NOW - DAY_MS };

    const counts = deckCounts(exercises, { a: due }, NOW);

    expect(counts.get('deck')).toEqual({ due: 1, unseen: 1, total: 2 });
    expect(counts.get('other')).toEqual({ due: 0, unseen: 1, total: 1 });
  });
});
