/**
 * How often each task type is used, as whole percentages. The shares of the
 * task types of one data kind always add up to 100 (multiple choice and
 * type-in for cloze items); moving one moves the others the opposite way.
 */
import { DATA_KINDS, EXERCISE_KINDS, TASK_DATA_KIND, type DataKind, type ExerciseKind } from './types.ts';

export type TaskWeights = Readonly<Record<ExerciseKind, number>>;

export const WEIGHT_TOTAL = 100;

export const DEFAULT_TASK_WEIGHTS: TaskWeights = { 'multiple-choice': 70, 'type-in': 30, 'word-order': 100 };

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

/** The task types that share one 100 % budget. */
export function kindsOf(dataKind: DataKind): ExerciseKind[] {
  return EXERCISE_KINDS.filter((kind) => TASK_DATA_KIND[kind] === dataKind);
}

/** Sets one share and spreads the rest over the other task types of its data kind, in their current proportion. */
export function rebalance(weights: TaskWeights, changed: ExerciseKind, requested: number): TaskWeights {
  const value = Math.min(WEIGHT_TOTAL, Math.max(0, Math.round(requested)));
  const others = kindsOf(TASK_DATA_KIND[changed]).filter((kind) => kind !== changed);

  if (others.length === 0) {
    return weights;
  }

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

function readShare(value: Readonly<Record<string, unknown>>, kind: ExerciseKind): number {
  const entry = value[kind];

  return typeof entry === 'number' && Number.isFinite(entry) && entry > 0 ? entry : 0;
}

/**
 * Reads stored weights per data kind: a group that is missing or all zero
 * (e.g. a task type added since) gets its defaults, anything off-total is
 * rescaled.
 */
export function parseTaskWeights(value: unknown): TaskWeights {
  const result: Record<ExerciseKind, number> = { ...DEFAULT_TASK_WEIGHTS };

  if (!isRecord(value)) {
    return result;
  }

  for (const dataKind of DATA_KINDS) {
    const kinds = kindsOf(dataKind);
    const raw = kinds.map((kind) => readShare(value, kind));

    if (raw.every((entry) => entry === 0)) {
      continue;
    }

    const shares = apportion(WEIGHT_TOTAL, raw);

    for (const [position, kind] of kinds.entries()) {
      result[kind] = shares[position] ?? 0;
    }
  }

  return result;
}
