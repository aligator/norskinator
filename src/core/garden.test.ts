import { describe, expect, it } from 'vitest';

import { gardenBeds, plantChange, plantOf, stageRank, totalCounts } from './garden.ts';
import { DAY_MS, createCard, review, type CardState } from './srs.ts';
import type { ItemMeta } from './types.ts';

const NOW = Date.parse('2026-01-15T10:00:00Z');

function item(id: string, deckId = 'deck'): ItemMeta {
  return { id, deckId, level: 1, tags: [] };
}

function reviewed(id: string, stability: number, overrides: Partial<CardState> = {}): CardState {
  return { ...createCard(id, 'deck', NOW), phase: 'review', reps: 3, stability, difficulty: 5, due: NOW + DAY_MS, ...overrides };
}

describe('plantOf', () => {
  it('shows an item never answered as a seed', () => {
    expect(plantOf(undefined)).toEqual({ stage: 'seed', wilted: false, growth: 0 });
  });

  it('grows with the interval', () => {
    expect(plantOf(reviewed('a', 1)).stage).toBe('sprout');
    expect(plantOf(reviewed('a', 3)).stage).toBe('plant');
    expect(plantOf(reviewed('a', 7)).stage).toBe('bush');
    expect(plantOf(reviewed('a', 21)).stage).toBe('tree');
    expect(plantOf(reviewed('a', 60)).stage).toBe('blossom');
  });

  it('grows within a stage until it reaches the next one', () => {
    expect(plantOf(reviewed('a', 7)).growth).toBe(0);
    expect(plantOf(reviewed('a', 14)).growth).toBe(0.5);
    expect(plantOf(reviewed('a', 400)).growth).toBe(1);
  });

  it('wilts on a wrong answer and grows back smaller once it is remembered', () => {
    const tree = reviewed('a', 30);
    const failed = review(tree, 'again', NOW);
    const recovered = review(failed, 'good', failed.due);

    expect(plantOf(failed)).toEqual({ stage: 'sprout', wilted: true, growth: 0 });
    expect(plantOf(recovered).wilted).toBe(false);
    expect(stageRank(plantOf(recovered).stage)).toBeLessThan(stageRank('tree'));
    expect(stageRank(plantOf(recovered).stage)).toBeGreaterThan(stageRank('sprout'));
  });

  it('wilts after a wrong answer whatever phase the card is in', () => {
    expect(plantOf(reviewed('a', 5, { phase: 'relearning', lastGrade: 'again' }))).toEqual({
      stage: 'sprout',
      wilted: true,
      growth: 0,
    });
    expect(plantOf(reviewed('a', 0.2, { phase: 'learning', reps: 1, lastGrade: 'again' })).wilted).toBe(true);
  });

  it('does not wilt a card that is still being learned after a right answer', () => {
    const learning = reviewed('a', 2.3, { phase: 'learning', learningStep: 1, reps: 1, lastGrade: 'good' });

    expect(plantOf(learning)).toMatchObject({ stage: 'sprout', wilted: false });
  });
});

describe('plantChange', () => {
  it('names what an answer did to the plant', () => {
    const seed = plantOf(undefined);
    const sprout = { stage: 'sprout', wilted: false, growth: 0.5 } as const;
    const bush = { stage: 'bush', wilted: false, growth: 0.5 } as const;
    const wilted = { stage: 'sprout', wilted: true, growth: 0 } as const;

    expect(plantChange(seed, sprout)).toBe('sown');
    expect(plantChange(sprout, bush)).toBe('grown');
    expect(plantChange(bush, bush)).toBe('unchanged');
    expect(plantChange(bush, wilted)).toBe('wilted');
    expect(plantChange(wilted, sprout)).toBe('recovered');
  });
});

describe('gardenBeds', () => {
  it('groups plants by deck and puts the ones needing care first', () => {
    const items = [item('tree'), item('thirsty'), item('seed'), item('other', 'second')];
    const cards = {
      tree: reviewed('tree', 30),
      thirsty: reviewed('thirsty', 3, { due: NOW - DAY_MS }),
    };

    const beds = gardenBeds(items, cards, NOW);
    const first = beds[0]!;

    expect(beds.map((bed) => bed.deckId)).toEqual(['deck', 'second']);
    expect(first.plants.map((entry) => entry.item.id)).toEqual(['thirsty', 'tree']);
    expect(first.thirsty).toBe(1);
    expect(first.counts.seed).toBe(1);
    expect(totalCounts(beds).seed).toBe(2);
  });
});
