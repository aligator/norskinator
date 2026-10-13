import { describe, expect, it } from 'vitest';

import { INITIAL_GARDEN, buySpecies, canBuy, sow, speciesOf, spendableXp } from './species.ts';
import { parseState } from './storage.ts';

describe('shop', () => {
  it('spends XP without lowering the total', () => {
    const bought = buySpecies(1000, INITIAL_GARDEN, 'sunflower');

    expect(bought?.unlocked).toEqual(['apple', 'sunflower']);
    expect(bought?.spentXp).toBe(300);
    expect(spendableXp(1000, bought!)).toBe(700);
  });

  it('refuses a species that is too expensive or already owned', () => {
    expect(buySpecies(100, INITIAL_GARDEN, 'sunflower')).toBeNull();
    expect(buySpecies(10_000, INITIAL_GARDEN, 'apple')).toBeNull();
    expect(canBuy(800, { ...INITIAL_GARDEN, spentXp: 500 }, 'sunflower')).toBe(true);
    expect(canBuy(799, { ...INITIAL_GARDEN, spentXp: 500 }, 'sunflower')).toBe(false);
  });
});

describe('sow', () => {
  it('picks a random owned species once and keeps it', () => {
    const garden = { ...INITIAL_GARDEN, unlocked: ['apple', 'cactus'] as const };

    const sown = sow(garden, 'item', () => 0.99);
    const again = sow(sown, 'item', () => 0);

    expect(speciesOf(sown, 'item')).toBe('cactus');
    expect(speciesOf(again, 'item')).toBe('cactus');
  });

  it('shows plants sown before species existed as apple trees', () => {
    expect(speciesOf(INITIAL_GARDEN, 'old')).toBe('apple');
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

    expect(state.garden).toEqual({ unlocked: ['apple', 'cactus'], spentXp: 1500, species: { a: 'cactus' } });
  });
});
