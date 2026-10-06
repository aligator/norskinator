/**
 * Builds and advances a practice session.
 *
 * Pure helpers: the store owns the mutable queue, these functions only decide
 * what to study and in which order.
 */
import { dueCards, isDue, type CardState } from './srs.ts';
import type { Exercise } from './types.ts';

export const SESSION_SIZE = 20;

/** New exercises offered by "Øv ekstra" once the daily work is done. */
export const EXTRA_SESSION_NEW = 10;

/** How many other items a failed exercise is pushed back by. */
const REQUEUE_GAP = 3;

/** New material is sampled from a window this many times the slot count. */
const FRESH_WINDOW_FACTOR = 6;

export interface SessionOptions {
  readonly newPerSession: number;
  readonly sessionSize?: number;
  /** Injectable for deterministic tests. */
  readonly random?: () => number;
}

interface Pools {
  readonly due: Exercise[];
  readonly fresh: Exercise[];
}

function splitPools(
  exercises: readonly Exercise[],
  cards: Readonly<Record<string, CardState>>,
  now: number,
): Pools {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const due: Exercise[] = [];

  for (const card of dueCards(Object.values(cards), now)) {
    const exercise = byId.get(card.exerciseId);

    // The exercise can be gone after a deck was disabled or data regenerated.
    if (exercise !== undefined) {
      due.push(exercise);
    }
  }

  const fresh = exercises.filter((exercise) => cards[exercise.id] === undefined);

  return { due, fresh };
}

/**
 * Picks `count` items spread across the pool instead of taking the first ones,
 * so a session is not dominated by one preposition or one stretch of corpus.
 * Partial Fisher-Yates: terminates for any `random`, even a constant one.
 */
function sample<T>(items: readonly T[], count: number, random: () => number): T[] {
  const pool = [...items];
  const take = Math.min(count, pool.length);

  for (let index = 0; index < take; index += 1) {
    const offset = Math.floor(random() * (pool.length - index));
    const swapWith = Math.min(index + offset, pool.length - 1);
    const current = pool[index]!;

    pool[index] = pool[swapWith]!;
    pool[swapWith] = current;
  }

  return pool.slice(0, take);
}

/** Mixes new items into the review stream rather than appending them. */
function interleave(
  reviews: readonly Exercise[],
  fresh: readonly Exercise[],
  random: () => number,
): Exercise[] {
  const result = [...reviews];

  for (const exercise of fresh) {
    const position = result.length === 0 ? 0 : Math.floor(random() * (result.length + 1));

    result.splice(position, 0, exercise);
  }

  return result;
}

export function buildSession(
  exercises: readonly Exercise[],
  cards: Readonly<Record<string, CardState>>,
  options: SessionOptions,
  now: number,
): Exercise[] {
  const random = options.random ?? Math.random;
  const size = options.sessionSize ?? SESSION_SIZE;

  const { due, fresh } = splitPools(exercises, cards, now);
  const reviewPart = due.slice(0, size);

  const freshSlots = Math.max(0, Math.min(size - reviewPart.length, options.newPerSession));

  // Easiest material first, but sampled from a window so sessions still vary.
  const byLevel = [...fresh].sort((left, right) => left.level - right.level);
  const window = byLevel.slice(0, Math.max(freshSlots * FRESH_WINDOW_FACTOR, freshSlots));
  const freshPart = sample(window, freshSlots, random);

  return interleave(reviewPart, freshPart, random);
}

/** Re-inserts a failed exercise a few steps later in the same session. */
export function requeue(queue: readonly Exercise[], index: number, exercise: Exercise): Exercise[] {
  const next = [...queue];
  const position = Math.min(index + 1 + REQUEUE_GAP, next.length);

  next.splice(position, 0, exercise);

  return next;
}

/** A failed exercise comes back this many times per session at most, so misses cannot grow the queue forever. */
export const MAX_REQUEUES_PER_EXERCISE = 1;

/** `requeuedIds` lists one entry per re-queue that already happened in the session. */
export function canRequeue(requeuedIds: readonly string[], exerciseId: string): boolean {
  const count = requeuedIds.filter((id) => id === exerciseId).length;

  return count < MAX_REQUEUES_PER_EXERCISE;
}

/**
 * Pass `exerciseIds` to skip cards whose exercise is gone (deck disabled or
 * data regenerated); `buildSession` never schedules those either.
 */
export function countDue(
  cards: Readonly<Record<string, CardState>>,
  now: number,
  exerciseIds?: ReadonlySet<string>,
): number {
  return Object.values(cards).filter(
    (card) => isDue(card, now) && (exerciseIds === undefined || exerciseIds.has(card.exerciseId)),
  ).length;
}

/** Shuffles options so the correct answer is not always in the same slot. */
export function shuffleOptions(
  options: readonly string[],
  random: () => number = Math.random,
): string[] {
  const result = [...options];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    const current = result[index]!;

    result[index] = result[swapWith]!;
    result[swapWith] = current;
  }

  return result;
}

export interface SessionPreview {
  /** Review cards the next session will contain. */
  readonly due: number;
  /** Unseen exercises the next session will introduce. */
  readonly fresh: number;
  /** Unseen exercises left in total, for offering an extra session. */
  readonly unseen: number;
  /** Due cards in total, which can exceed one session. */
  readonly totalDue: number;
}

/** What `buildSession` would pick right now, without building the queue. */
export function sessionPreview(
  exercises: readonly Exercise[],
  cards: Readonly<Record<string, CardState>>,
  newPerSession: number,
  now: number,
): SessionPreview {
  const { due, fresh } = splitPools(exercises, cards, now);
  const sessionDue = Math.min(due.length, SESSION_SIZE);
  const sessionFresh = Math.max(0, Math.min(fresh.length, newPerSession, SESSION_SIZE - sessionDue));

  return { due: sessionDue, fresh: sessionFresh, unseen: fresh.length, totalDue: due.length };
}
