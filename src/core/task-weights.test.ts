import { describe, expect, it } from 'vitest';

import { DEFAULT_TASK_WEIGHTS, WEIGHT_TOTAL, apportion, parseTaskWeights, rebalance } from './task-weights.ts';

function sum(values: Readonly<Record<string, number>>): number {
  return Object.values(values).reduce((total, value) => total + value, 0);
}

describe('apportion', () => {
  it('keeps the total exact despite rounding', () => {
    expect(apportion(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(apportion(1, [50, 50, 0])).toEqual([1, 0, 0]);
  });

  it('splits evenly when every share is zero', () => {
    expect(apportion(10, [0, 0])).toEqual([5, 5]);
  });
});

describe('rebalance', () => {
  it('moves the other share the opposite way', () => {
    expect(rebalance(DEFAULT_TASK_WEIGHTS, 'type-in', 45)).toEqual({ 'multiple-choice': 55, 'type-in': 45 });
  });

  it('clamps to 0–100 and always adds up to the total', () => {
    const high = rebalance(DEFAULT_TASK_WEIGHTS, 'multiple-choice', 140);
    const low = rebalance(DEFAULT_TASK_WEIGHTS, 'multiple-choice', -5);

    expect(high).toEqual({ 'multiple-choice': 100, 'type-in': 0 });
    expect(low).toEqual({ 'multiple-choice': 0, 'type-in': 100 });
    expect(sum(rebalance(high, 'type-in', 33.4))).toBe(WEIGHT_TOTAL);
  });
});

describe('parseTaskWeights', () => {
  it('falls back to the defaults for missing or all-zero data', () => {
    expect(parseTaskWeights(undefined)).toEqual(DEFAULT_TASK_WEIGHTS);
    expect(parseTaskWeights({ 'multiple-choice': 0, 'type-in': -3 })).toEqual(DEFAULT_TASK_WEIGHTS);
  });
});
