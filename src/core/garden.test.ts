import { describe, expect, it } from 'vitest';

import { DEFAULT_SEED_LIMITS, gardenBeds, plantChange, plantOf, seedAllowance, totalCounts } from './garden.ts';
import { DAY_MS, createCard, review, type CardState } from './srs.ts';
import type { ItemMeta } from './types.ts';

const NOW = Date.parse('2026-01-15T10:00:00Z');

function item(id: string, deckId = 'deck'): ItemMeta {
  return { id, deckId, level: 1, tags: [] };
}

function reviewed(id: string, intervalDays: number, overrides: Partial<CardState> = {}): CardState {
  return { ...createCard(id, 'deck', NOW), phase: 'review', reps: 3, intervalDays, due: NOW + DAY_MS, ...overrides };
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

  it('wilts on a wrong answer and recovers as a sprout', () => {
    const tree = reviewed('a', 30);
    const failed = review(tree, 'again', NOW);
    const recovered = review(failed, 'good', NOW + 120_000);

    expect(plantOf(failed)).toEqual({ stage: 'sprout', wilted: true, growth: 0 });
    expect(plantOf(recovered)).toEqual({ stage: 'sprout', wilted: false, growth: 0 });
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

describe('seedAllowance', () => {
  it('leaves room for new items until the young plants reach the limit', () => {
    const items = Array.from({ length: 20 }, (_unused, index) => item(`e${index}`));
    const youngCards = items.slice(0, 10).map((entry) => reviewed(entry.id, 2));
    const cards = Object.fromEntries(youngCards.map((card) => [card.exerciseId, card]));

    expect(seedAllowance(items, cards)).toBe(DEFAULT_SEED_LIMITS.maxYoung - 10);
  });

  it('does not count grown plants or the plants of other decks', () => {
    const items = [item('grown'), item('young')];
    const cards = {
      grown: reviewed('grown', 10),
      young: reviewed('young', 1),
      elsewhere: reviewed('elsewhere', 1),
    };

    expect(seedAllowance(items, cards)).toBe(DEFAULT_SEED_LIMITS.maxYoung - 1);
  });
});

describe('seedAllowance with custom limits', () => {
  it('follows the limit and age the learner chose', () => {
    const items = Array.from({ length: 10 }, (_unused, index) => item(`e${index}`));
    const cards = Object.fromEntries(items.map((entry) => [entry.id, reviewed(entry.id, 5)]));

    expect(seedAllowance(items, cards, { maxYoung: 30, youngDays: 7 })).toBe(20);
    expect(seedAllowance(items, cards, { maxYoung: 30, youngDays: 3 })).toBe(30);
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
