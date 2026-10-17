import { describe, expect, it } from 'vitest';

import { BADGES, unlockBadges, type BadgeState } from '../../src/core/badges.ts';
import { INITIAL_PROGRESS } from '../../src/core/gamification.ts';
import { INITIAL_GARDEN, SpeciesId } from '../../src/core/species.ts';
import { CardPhase, DAY_MS, Grade, createCard, type CardState } from '../../src/core/srs.ts';

const NOW = Date.parse('2026-01-15T10:00:00Z');

function grown(id: string, stability: number, overrides: Partial<CardState> = {}): CardState {
  return { ...createCard(id, 'deck', NOW), phase: CardPhase.Review, reps: 4, stability, difficulty: 5, due: NOW + DAY_MS, ...overrides };
}

function state(overrides: Partial<BadgeState> = {}): BadgeState {
  return { progress: INITIAL_PROGRESS, cards: {}, garden: INITIAL_GARDEN, ...overrides };
}

describe('badges', () => {
  it('have unique ids', () => {
    const ids = BADGES.map((badge) => badge.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('unlock garden badges from how far the plants grew', () => {
    const cards = { a: grown('a', 25), b: grown('b', 2) };

    const { newBadges } = unlockBadges(state({ cards }));

    expect(newBadges).toEqual(expect.arrayContaining(['first-sprout', 'first-bush', 'first-tree']));
    expect(newBadges).not.toContain('first-blossom');
  });

  it('do not count a wilted plant as grown, but reward it once it recovers', () => {
    const wilted = { a: grown('a', 0.2, { phase: CardPhase.Relearning, lapses: 1, lastGrade: Grade.Again }) };
    const recovered = { a: grown('a', 1, { lapses: 1 }) };

    expect(unlockBadges(state({ cards: wilted })).newBadges).not.toContain('first-sprout');
    expect(unlockBadges(state({ cards: recovered })).newBadges).toContain('plant-doctor');
  });

  it('unlock shop badges from the species owned', () => {
    const garden = { ...INITIAL_GARDEN, unlocked: [...INITIAL_GARDEN.unlocked, SpeciesId.Dandelion] };

    expect(unlockBadges(state({ garden })).newBadges).toContain('first-purchase');
  });

  it('report a badge only once', () => {
    const first = unlockBadges(state({ cards: { a: grown('a', 2) } }));
    const again = unlockBadges(state({ progress: first.progress, cards: { a: grown('a', 2) } }));

    expect(first.newBadges).toContain('first-sprout');
    expect(again.newBadges).toEqual([]);
  });
});
