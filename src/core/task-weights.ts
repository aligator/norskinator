/**
 * How often each task type is used, as whole percentages that always add up
 * to 100. Moving one share moves the others the opposite way.
 */
import { EXERCISE_KINDS, type ExerciseKind } from './types.ts';

export type TaskWeights = Readonly<Record<ExerciseKind, number>>;

export const WEIGHT_TOTAL = 100;

export const DEFAULT_TASK_WEIGHTS: TaskWeights = { 'multiple-choice': 70, 'type-in': 30 };

/**
 * Splits `total` into whole numbers proportional to `shares` (largest
 * remainder method), so rounding never breaks the sum. Equal parts when every
 * share is zero.
 */
export function apportion(total: number, shares: readonly number[]): number[] {
  const shareSum = shares.reduce((sum, share) => sum + share, 0);
  const exact = shares.map((share) => (shareSum === 0 ? total / shares.length : (share * total) / shareSum));
  const result = exact.map((value) => Math.floor(value));
  let leftover = total - result.reduce((sum, value) => sum + value, 0);

  const byFraction = exact
    .map((value, position) => ({ position, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction);

  for (const { position } of byFraction) {
    if (leftover <= 0) {
      break;
    }

    result[position] = (result[position] ?? 0) + 1;
    leftover -= 1;
  }

  return result;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function fromList(values: readonly number[]): TaskWeights {
  const weights: Record<ExerciseKind, number> = { ...DEFAULT_TASK_WEIGHTS };

  for (const [position, kind] of EXERCISE_KINDS.entries()) {
    weights[kind] = values[position] ?? 0;
  }

  return weights;
}

/** Sets one share and spreads the rest over the others in their current proportion. */
export function rebalance(weights: TaskWeights, changed: ExerciseKind, requested: number): TaskWeights {
  const value = Math.min(WEIGHT_TOTAL, Math.max(0, Math.round(requested)));
  const others = EXERCISE_KINDS.filter((kind) => kind !== changed);
  const spread = apportion(
    WEIGHT_TOTAL - value,
    others.map((kind) => weights[kind]),
  );

  const result: Record<ExerciseKind, number> = { ...weights, [changed]: value };

  for (const [position, kind] of others.entries()) {
    result[kind] = spread[position] ?? 0;
  }

  return result;
}

/** Reads stored weights; anything unusable falls back to the defaults, anything off-total is rescaled. */
export function parseTaskWeights(value: unknown): TaskWeights {
  if (!isRecord(value)) {
    return DEFAULT_TASK_WEIGHTS;
  }

  const raw = EXERCISE_KINDS.map((kind) => {
    const entry = value[kind];

    return typeof entry === 'number' && Number.isFinite(entry) && entry > 0 ? entry : 0;
  });

  if (raw.every((entry) => entry === 0)) {
    return DEFAULT_TASK_WEIGHTS;
  }

  return fromList(apportion(WEIGHT_TOTAL, raw));
}
