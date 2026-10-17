import { describe, expect, it } from 'vitest';

import { INITIAL_GARDEN, SPECIES, SpeciesId, buySpecies, canBuy, sow, speciesOf, spendableXp } from './species.ts';
import { parseState } from './storage.ts';

describe('shop', () => {
  it('spends XP without lowering the total', () => {
    const bought = buySpecies(1000, INITIAL_GARDEN, SpeciesId.Sunflower);

    expect(bought?.unlocked).toEqual([SpeciesId.Apple, SpeciesId.Sunflower]);
    expect(bought?.spentXp).toBe(300);
    expect(spendableXp(1000, bought!)).toBe(700);
  });

  it('refuses a species that is too expensive or already owned', () => {
    expect(buySpecies(100, INITIAL_GARDEN, SpeciesId.Sunflower)).toBeNull();
    expect(buySpecies(10_000, INITIAL_GARDEN, SpeciesId.Apple)).toBeNull();
    expect(canBuy(800, { ...INITIAL_GARDEN, spentXp: 500 }, SpeciesId.Sunflower)).toBe(true);
    expect(canBuy(799, { ...INITIAL_GARDEN, spentXp: 500 }, SpeciesId.Sunflower)).toBe(false);
  });
});

describe('species', () => {
  it('sells every species exactly once', () => {
    const sold = SPECIES.map((species) => species.id);

    expect([...sold].sort()).toEqual(Object.values(SpeciesId).sort());
  });
});

describe('sow', () => {
  it('picks a random owned species once and keeps it', () => {
    const garden = { ...INITIAL_GARDEN, unlocked: [SpeciesId.Apple, SpeciesId.Cactus] };

    const sown = sow(garden, 'item', () => 0.99);
    const again = sow(sown, 'item', () => 0);

    expect(speciesOf(sown, 'item')).toBe(SpeciesId.Cactus);
    expect(speciesOf(again, 'item')).toBe(SpeciesId.Cactus);
  });

  it('shows plants sown before species existed as apple trees', () => {
    expect(speciesOf(INITIAL_GARDEN, 'old')).toBe(SpeciesId.Apple);
  });
});

describe('parseState garden', () => {
  it('starts state saved before the shop with the free species', () => {
    const state = parseState(JSON.stringify({ version: 1, progress: {}, cards: {}, settings: {} }));

    expect(state.garden).toEqual(INITIAL_GARDEN);
  });

  it('drops unknown species and always keeps the free one', () => {
    const state = parseState(
      JSON.stringify({ version: 1, garden: { unlocked: ['cactus', 'baobab'], spentXp: 1500, species: { a: 'cactus', b: 'baobab' } } }),
    );

    expect(state.garden).toEqual({
      unlocked: [SpeciesId.Apple, SpeciesId.Cactus],
      spentXp: 1500,
      species: { a: SpeciesId.Cactus },
    });
  });
});
