/** Read-only aggregates for the dashboard and statistics views. */
import { isDue, type CardState } from './srs.ts';
import type { ItemMeta } from './types.ts';

export interface TagMastery {
  readonly deckId: string;
  readonly tag: string;
  /** Cards that graduated to interval-based review. */
  readonly review: number;
  readonly learning: number;
  readonly unseen: number;
  readonly total: number;
  /** Share of answers that were right, or null before the first answer. */
  readonly accuracy: number | null;
}

interface MutableTally {
  review: number;
  learning: number;
  unseen: number;
  total: number;
  reps: number;
  failures: number;
}

/**
 * Groups by an exercise's first tag, which every deck uses as its primary
 * dimension (the preposition for the preposition deck). Weakest tags come
 * first so the list doubles as "what to practise next".
 */
export function tagMastery(
  exercises: readonly ItemMeta[],
  cards: Readonly<Record<string, CardState>>,
): TagMastery[] {
  const tallies = new Map<string, MutableTally & { deckId: string; tag: string }>();

  for (const exercise of exercises) {
    const tag = exercise.tags[0];

    if (tag === undefined) {
      continue;
    }

    const key = `${exercise.deckId}\u0000${tag}`;
    let tally = tallies.get(key);

    if (tally === undefined) {
      tally = { deckId: exercise.deckId, tag, review: 0, learning: 0, unseen: 0, total: 0, reps: 0, failures: 0 };
      tallies.set(key, tally);
    }

    tally.total += 1;
    const card = cards[exercise.id];

    if (card === undefined || card.reps === 0) {
      tally.unseen += 1;
      continue;
    }

    if (card.phase === 'review') {
      tally.review += 1;
    } else {
      tally.learning += 1;
    }

    tally.reps += card.reps;
    tally.failures += card.failures;
  }

  const result: TagMastery[] = [];

  for (const tally of tallies.values()) {
    result.push({
      deckId: tally.deckId,
      tag: tally.tag,
      review: tally.review,
      learning: tally.learning,
      unseen: tally.unseen,
      total: tally.total,
      accuracy: tally.reps === 0 ? null : (tally.reps - tally.failures) / tally.reps,
    });
  }

  return result.sort(compareWeakestFirst);
}

/** Practised-but-weak before unpractised, unpractised before strong. */
function compareWeakestFirst(left: TagMastery, right: TagMastery): number {
  const leftScore = left.accuracy ?? 0.75;
  const rightScore = right.accuracy ?? 0.75;

  if (leftScore !== rightScore) {
    return leftScore - rightScore;
  }

  return left.tag.localeCompare(right.tag, 'nb');
}

export interface DeckCounts {
  readonly due: number;
  readonly unseen: number;
  readonly total: number;
}

export function deckCounts(
  exercises: readonly ItemMeta[],
  cards: Readonly<Record<string, CardState>>,
  now: number,
): Map<string, DeckCounts> {
  const counts = new Map<string, { due: number; unseen: number; total: number }>();

  for (const exercise of exercises) {
    let entry = counts.get(exercise.deckId);

    if (entry === undefined) {
      entry = { due: 0, unseen: 0, total: 0 };
      counts.set(exercise.deckId, entry);
    }

    entry.total += 1;
    const card = cards[exercise.id];

    if (card === undefined) {
      entry.unseen += 1;
    } else if (isDue(card, now)) {
      entry.due += 1;
    }
  }

  return counts;
}
