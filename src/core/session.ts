/**
 * Builds and advances a practice session.
 *
 * Pure helpers: the store owns the mutable queue, these functions only decide
 * what to study and in which order.
 */
import { seedAllowance, type SeedLimits } from './garden.ts';
import { dueCards, isDue, type CardState } from './srs.ts';
import type { ItemMeta } from './types.ts';

export const SESSION_SIZE = 20;

/** How many other items a failed exercise is pushed back by. */
const REQUEUE_GAP = 3;

/** New material is sampled from a window this many times the slot count. */
const FRESH_WINDOW_FACTOR = 6;

export interface SessionOptions {
  /** Upper bound for new items; the garden's room for young plants can lower it. */
  readonly newPerSession: number;
  readonly sessionSize?: number;
  readonly seedLimits?: SeedLimits;
  /** Injectable for deterministic tests. */
  readonly random?: () => number;
}

interface Pools<Item> {
  readonly due: Item[];
  readonly fresh: Item[];
}

function splitPools<Item extends ItemMeta>(
  items: readonly Item[],
  cards: Readonly<Record<string, CardState>>,
  now: number,
): Pools<Item> {
  const byId = new Map(items.map((item) => [item.id, item]));
  const due: Item[] = [];

  for (const card of dueCards(Object.values(cards), now)) {
    const item = byId.get(card.exerciseId);

    // The item can be gone after a deck was disabled or data regenerated.
    if (item !== undefined) {
      due.push(item);
    }
  }

  const fresh = items.filter((item) => cards[item.id] === undefined);

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

interface DeckPool<Item> {
  readonly due: Item[];
  readonly fresh: Item[];
}

/** Splits both pools by deck, in the order the decks first appear among `items`. */
function poolsByDeck<Item extends ItemMeta>(items: readonly Item[], { due, fresh }: Pools<Item>): DeckPool<Item>[] {
  const pools = new Map<string, DeckPool<Item>>();

  for (const item of items) {
    if (!pools.has(item.deckId)) {
      pools.set(item.deckId, { due: [], fresh: [] });
    }
  }

  for (const item of due) {
    pools.get(item.deckId)?.due.push(item);
  }

  for (const item of fresh) {
    pools.get(item.deckId)?.fresh.push(item);
  }

  return [...pools.values()];
}

interface Quota {
  due: number;
  fresh: number;
}

/**
 * Deals `slots` round-robin across decks, beginning at `start`, so a deck with
 * a large backlog cannot crowd the others out of a session. On its turn a deck
 * takes one of its reviews, or, with none left, a new item while `newBudget`
 * lasts; a deck with neither passes its turn on.
 */
function allocateSlots(pools: readonly DeckPool<unknown>[], slots: number, newBudget: number, start: number): Quota[] {
  const quotas = pools.map((): Quota => ({ due: 0, fresh: 0 }));
  let remaining = slots;
  let budget = Math.max(0, newBudget);
  let deck = start;
  let idleTurns = 0;

  while (remaining > 0 && idleTurns < pools.length) {
    const pool = pools[deck]!;
    const quota = quotas[deck]!;

    if (quota.due < pool.due.length) {
      quota.due += 1;
      remaining -= 1;
      idleTurns = 0;
    } else if (budget > 0 && quota.fresh < pool.fresh.length) {
      quota.fresh += 1;
      budget -= 1;
      remaining -= 1;
      idleTurns = 0;
    } else {
      idleTurns += 1;
    }

    deck = (deck + 1) % pools.length;
  }

  return quotas;
}

/**
 * Easiest material first, but sampled from a window so sessions still vary.
 * Shuffling before the (stable) level sort mixes a deck's pools within a
 * level; otherwise the pool loaded first would fill every window.
 */
function pickEasiest<Item extends ItemMeta>(items: readonly Item[], count: number, random: () => number): Item[] {
  const byLevel = sample(items, items.length, random).sort((left, right) => left.level - right.level);
  const window = byLevel.slice(0, count * FRESH_WINDOW_FACTOR);

  return sample(window, count, random);
}

/** Mixes new items into the review stream rather than appending them. */
function interleave<Item>(reviews: readonly Item[], fresh: readonly Item[], random: () => number): Item[] {
  const result = [...reviews];

  for (const item of fresh) {
    const position = result.length === 0 ? 0 : Math.floor(random() * (result.length + 1));

    result.splice(position, 0, item);
  }

  return result;
}

/** The learner's pace settings, as `Settings` stores them. */
export interface PaceSettings {
  readonly newPerSession: number;
  readonly sessionSize: number;
  readonly maxYoungPlants: number;
  readonly youngIntervalDays: number;
}

export function sessionOptions(pace: PaceSettings): Omit<SessionOptions, 'random'> {
  return {
    newPerSession: pace.newPerSession,
    sessionSize: pace.sessionSize,
    seedLimits: { maxYoung: pace.maxYoungPlants, youngDays: pace.youngIntervalDays },
  };
}

/** Picks the items of a session; the caller decides how each one is presented. */
export function buildSession<Item extends ItemMeta>(
  items: readonly Item[],
  cards: Readonly<Record<string, CardState>>,
  options: SessionOptions,
  now: number,
): Item[] {
  const random = options.random ?? Math.random;
  const size = options.sessionSize ?? SESSION_SIZE;

  const split = splitPools(items, cards, now);
  const pools = poolsByDeck(items, split);

  // A random first deck rotates which deck gets the remainder of an uneven split.
  const start = Math.min(Math.floor(random() * pools.length), Math.max(pools.length - 1, 0));
  const newBudget = Math.min(options.newPerSession, seedAllowance(items, cards, options.seedLimits));
  const quotas = allocateSlots(pools, size, newBudget, start);

  // Levels of different decks are not comparable, so difficulty is ranked within each deck.
  const chosenReviews = new Set(pools.flatMap((pool, index) => pool.due.slice(0, quotas[index]!.due)));
  const reviewPart = split.due.filter((item) => chosenReviews.has(item));
  const freshPart = pools.flatMap((pool, index) => pickEasiest(pool.fresh, quotas[index]!.fresh, random));

  return interleave(reviewPart, freshPart, random);
}

/** Re-inserts a failed exercise a few steps later in the same session. */
export function requeue<Item>(queue: readonly Item[], index: number, item: Item): Item[] {
  const next = [...queue];
  const position = Math.min(index + 1 + REQUEUE_GAP, next.length);

  next.splice(position, 0, item);

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

/**
 * Shuffles word-order tiles; reshuffles a few times when the result happens to
 * be the right order, which with short sentences is not rare.
 */
export function shuffleTiles(tiles: readonly string[], random: () => number = Math.random): string[] {
  const attempts = 5;
  let shuffled = shuffleOptions(tiles, random);

  for (let attempt = 1; attempt < attempts && shuffled.join(' ') === tiles.join(' '); attempt += 1) {
    shuffled = shuffleOptions(tiles, random);
  }

  return shuffled;
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
  /** New items the garden has room for; 0 means the young plants need care first. */
  readonly seedRoom: number;
}

/**
 * What `buildSession` would pick right now, without building the queue. With
 * several decks the session starts at a random deck, so its split between
 * reviews and new items can differ from this one by one per deck.
 */
export function sessionPreview(
  items: readonly ItemMeta[],
  cards: Readonly<Record<string, CardState>>,
  options: Omit<SessionOptions, 'random'>,
  now: number,
): SessionPreview {
  const split = splitPools(items, cards, now);
  const seedRoom = seedAllowance(items, cards, options.seedLimits);
  const budget = Math.min(options.newPerSession, seedRoom);
  const quotas = allocateSlots(poolsByDeck(items, split), options.sessionSize ?? SESSION_SIZE, budget, 0);

  const sessionDue = quotas.reduce((sum, quota) => sum + quota.due, 0);
  const sessionFresh = quotas.reduce((sum, quota) => sum + quota.fresh, 0);

  return {
    due: sessionDue,
    fresh: sessionFresh,
    unseen: split.fresh.length,
    totalDue: split.due.length,
    seedRoom,
  };
}
