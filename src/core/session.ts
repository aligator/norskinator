/**
 * Builds and advances a practice session.
 *
 * Pure helpers: the store owns the mutable queue, these functions only decide
 * what to study and in which order.
 */
import { dueCards, isDue, type CardState } from './srs.ts';
import type { ItemMeta } from './types.ts';

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

/** Groups items by deck, in the order the decks first appear. */
function groupByDeck<Item extends ItemMeta>(items: readonly Item[]): Item[][] {
  const groups = new Map<string, Item[]>();

  for (const item of items) {
    const group = groups.get(item.deckId);

    if (group === undefined) {
      groups.set(item.deckId, [item]);
    } else {
      group.push(item);
    }
  }

  return [...groups.values()];
}

/**
 * Deals `slots` round-robin, beginning at `start`, so every deck gets an equal
 * share. A deck that runs out passes its turn on, which keeps the total at
 * `slots` as long as there is material left anywhere.
 */
function allocateSlots(capacities: readonly number[], slots: number, start: number): number[] {
  const quotas = capacities.map(() => 0);
  const total = capacities.reduce((sum, capacity) => sum + capacity, 0);
  let remaining = Math.min(slots, total);
  let deck = start;

  while (remaining > 0) {
    if (quotas[deck]! < capacities[deck]!) {
      quotas[deck]! += 1;
      remaining -= 1;
    }

    deck = (deck + 1) % capacities.length;
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

/**
 * Splits the new slots evenly across decks and ranks difficulty within each
 * deck. Levels of different decks are not comparable: a global level sort let
 * the first deck's level-1 items fill every slot until they were used up.
 * The random start rotates which deck gets the remainder of an uneven split.
 */
function pickFresh<Item extends ItemMeta>(fresh: readonly Item[], slots: number, random: () => number): Item[] {
  const decks = groupByDeck(fresh);
  const start = Math.min(Math.floor(random() * decks.length), Math.max(decks.length - 1, 0));
  const quotas = allocateSlots(
    decks.map((items) => items.length),
    slots,
    start,
  );

  return decks.flatMap((items, index) => pickEasiest(items, quotas[index]!, random));
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

/** Picks the items of a session; the caller decides how each one is presented. */
export function buildSession<Item extends ItemMeta>(
  items: readonly Item[],
  cards: Readonly<Record<string, CardState>>,
  options: SessionOptions,
  now: number,
): Item[] {
  const random = options.random ?? Math.random;
  const size = options.sessionSize ?? SESSION_SIZE;

  const { due, fresh } = splitPools(items, cards, now);
  const reviewPart = due.slice(0, size);

  const freshSlots = Math.max(0, Math.min(size - reviewPart.length, options.newPerSession));
  const freshPart = pickFresh(fresh, freshSlots, random);

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
}

/** What `buildSession` would pick right now, without building the queue. */
export function sessionPreview(
  items: readonly ItemMeta[],
  cards: Readonly<Record<string, CardState>>,
  newPerSession: number,
  now: number,
): SessionPreview {
  const { due, fresh } = splitPools(items, cards, now);
  const sessionDue = Math.min(due.length, SESSION_SIZE);
  const sessionFresh = Math.max(0, Math.min(fresh.length, newPerSession, SESSION_SIZE - sessionDue));

  return { due: sessionDue, fresh: sessionFresh, unseen: fresh.length, totalDue: due.length };
}
