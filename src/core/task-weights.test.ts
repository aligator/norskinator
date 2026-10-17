import { describe, expect, it } from 'vitest';

import { DEFAULT_TASK_WEIGHTS, WEIGHT_TOTAL, apportion, parseTaskWeights, rebalance } from './task-weights.ts';
import { ExerciseKind } from './types.ts';

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
    expect(rebalance(DEFAULT_TASK_WEIGHTS, ExerciseKind.TypeIn, 45)).toEqual({
      [ExerciseKind.MultipleChoice]: 55,
      [ExerciseKind.TypeIn]: 45,
      [ExerciseKind.WordOrder]: 100,
    });
  });

  it('clamps to 0–100 and always adds up to the total', () => {
    const high = rebalance(DEFAULT_TASK_WEIGHTS, ExerciseKind.MultipleChoice, 140);
    const low = rebalance(DEFAULT_TASK_WEIGHTS, ExerciseKind.MultipleChoice, -5);

    expect(high).toEqual({ [ExerciseKind.MultipleChoice]: 100, [ExerciseKind.TypeIn]: 0, [ExerciseKind.WordOrder]: 100 });
    expect(low).toEqual({ [ExerciseKind.MultipleChoice]: 0, [ExerciseKind.TypeIn]: 100, [ExerciseKind.WordOrder]: 100 });
    const moved = rebalance(high, ExerciseKind.TypeIn, 33.4);

    expect(moved[ExerciseKind.MultipleChoice] + moved[ExerciseKind.TypeIn]).toBe(WEIGHT_TOTAL);
  });

  it('leaves a task type that is alone in its data kind at 100 %', () => {
    expect(rebalance(DEFAULT_TASK_WEIGHTS, ExerciseKind.WordOrder, 20)).toEqual(DEFAULT_TASK_WEIGHTS);
  });
});

describe('parseTaskWeights', () => {
  it('gives a task type added since the weights were stored its default', () => {
    expect(parseTaskWeights({ 'multiple-choice': 40, 'type-in': 60 })).toEqual({
      [ExerciseKind.MultipleChoice]: 40,
      [ExerciseKind.TypeIn]: 60,
      [ExerciseKind.WordOrder]: 100,
    });
  });

  it('falls back to the defaults for missing or all-zero data', () => {
    expect(parseTaskWeights(undefined)).toEqual(DEFAULT_TASK_WEIGHTS);
    expect(parseTaskWeights({ 'multiple-choice': 0, 'type-in': -3 })).toEqual(DEFAULT_TASK_WEIGHTS);
  });
});
