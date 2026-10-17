import { describe, expect, it } from 'vitest';

import { PlantChange, PlantStage, gardenBeds, plantChange, plantOf, stageRank, totalCounts } from '../../src/core/garden.ts';
import { CardPhase, DAY_MS, Grade, createCard, review, type CardState } from '../../src/core/srs.ts';
import type { ItemMeta } from '../../src/core/types.ts';

const NOW = Date.parse('2026-01-15T10:00:00Z');

function item(id: string, deckId = 'deck'): ItemMeta {
  return { id, deckId, level: 1, tags: [] };
}

function reviewed(id: string, stability: number, overrides: Partial<CardState> = {}): CardState {
  return { ...createCard(id, 'deck', NOW), phase: CardPhase.Review, reps: 3, stability, difficulty: 5, due: NOW + DAY_MS, ...overrides };
}

describe('plantOf', () => {
  it('shows an item never answered as a seed', () => {
    expect(plantOf(undefined)).toEqual({ stage: PlantStage.Seed, wilted: false, growth: 0 });
  });

  it('grows with the interval', () => {
    expect(plantOf(reviewed('a', 1)).stage).toBe(PlantStage.Sprout);
    expect(plantOf(reviewed('a', 3)).stage).toBe(PlantStage.Plant);
    expect(plantOf(reviewed('a', 7)).stage).toBe(PlantStage.Bush);
    expect(plantOf(reviewed('a', 21)).stage).toBe(PlantStage.Tree);
    expect(plantOf(reviewed('a', 60)).stage).toBe(PlantStage.Blossom);
  });

  it('grows within a stage until it reaches the next one', () => {
    expect(plantOf(reviewed('a', 7)).growth).toBe(0);
    expect(plantOf(reviewed('a', 14)).growth).toBe(0.5);
    expect(plantOf(reviewed('a', 400)).growth).toBe(1);
  });

  it('wilts on a wrong answer and grows back smaller once it is remembered', () => {
    const tree = reviewed('a', 30);
    const failed = review(tree, Grade.Again, NOW);
    const recovered = review(failed, Grade.Good, failed.due);

    expect(plantOf(failed)).toEqual({ stage: PlantStage.Sprout, wilted: true, growth: 0 });
    expect(plantOf(recovered).wilted).toBe(false);
    expect(stageRank(plantOf(recovered).stage)).toBeLessThan(stageRank(PlantStage.Tree));
    expect(stageRank(plantOf(recovered).stage)).toBeGreaterThan(stageRank(PlantStage.Sprout));
  });

  it('wilts after a wrong answer whatever phase the card is in', () => {
    expect(plantOf(reviewed('a', 5, { phase: CardPhase.Relearning, lastGrade: Grade.Again }))).toEqual({
      stage: PlantStage.Sprout,
      wilted: true,
      growth: 0,
    });
    expect(plantOf(reviewed('a', 0.2, { phase: CardPhase.Learning, reps: 1, lastGrade: Grade.Again })).wilted).toBe(true);
  });

  it('does not wilt a card that is still being learned after a right answer', () => {
    const learning = reviewed('a', 2.3, { phase: CardPhase.Learning, learningStep: 1, reps: 1, lastGrade: Grade.Good });

    expect(plantOf(learning)).toMatchObject({ stage: PlantStage.Sprout, wilted: false });
  });
});

describe('plantChange', () => {
  it('names what an answer did to the plant', () => {
    const seed = plantOf(undefined);
    const sprout = { stage: PlantStage.Sprout, wilted: false, growth: 0.5 } as const;
    const bush = { stage: PlantStage.Bush, wilted: false, growth: 0.5 } as const;
    const wilted = { stage: PlantStage.Sprout, wilted: true, growth: 0 } as const;

    expect(plantChange(seed, sprout)).toBe(PlantChange.Sown);
    expect(plantChange(sprout, bush)).toBe(PlantChange.Grown);
    expect(plantChange(bush, bush)).toBe(PlantChange.Unchanged);
    expect(plantChange(bush, wilted)).toBe(PlantChange.Wilted);
    expect(plantChange(wilted, sprout)).toBe(PlantChange.Recovered);
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
    expect(first.counts[PlantStage.Seed]).toBe(1);
    expect(totalCounts(beds)[PlantStage.Seed]).toBe(2);
  });
});
