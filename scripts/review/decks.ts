/**
 * Decks whose Tatoeba sentences go through the agent review, and where their
 * files live. The id prefix must match the deck's `reviewedTatoebaLoader`.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { FORM_CATEGORIES } from '../../src/decks/adjectives/categories.ts';
import { readTatoebaBundle, type TatoebaBundle } from '../../src/decks/tatoeba-source.ts';
import { ROOT } from '../tatoeba.ts';

export interface ReviewDeck {
  readonly id: string;
  readonly idPrefix: string;
  /** Allowed values of a reviewer's `category`, which replaces the item's first tag. Empty: no categories. */
  readonly categories: readonly string[];
}

export const REVIEW_DECKS: readonly ReviewDeck[] = [
  { id: 'prepositions', idPrefix: 'p-', categories: [] },
  { id: 'adjectives', idPrefix: 'a-', categories: FORM_CATEGORIES },
];

export function deckFromArgs(): ReviewDeck {
  const name = process.argv[2];
  const deck = REVIEW_DECKS.find((candidate) => candidate.id === name);

  if (deck === undefined) {
    throw new Error(`Usage: <script> <${REVIEW_DECKS.map((candidate) => candidate.id).join('|')}>`);
  }

  return deck;
}

export function deckDir(deck: ReviewDeck): string {
  return join(ROOT, 'src', 'decks', deck.id);
}

/** Batches, prompts and reviewer output; git-ignored like the rest of .cache/. */
export function reviewDir(deck: ReviewDeck): string {
  return join(ROOT, '.cache', 'review', deck.id);
}

/** The deck's generated bundle, validated like the app reads it. */
export async function readBundle(deck: ReviewDeck): Promise<TatoebaBundle> {
  return readTatoebaBundle(JSON.parse(await readFile(join(deckDir(deck), 'tatoeba.json'), 'utf8')));
}

export function overridesPath(deck: ReviewDeck): string {
  return join(deckDir(deck), 'overrides.json');
}

/** The raw `items` record of the deck's `overrides.json`, keyed by item id. */
export async function readOverrideEntries(deck: ReviewDeck): Promise<Readonly<Record<string, unknown>>> {
  const raw: unknown = JSON.parse(await readFile(overridesPath(deck), 'utf8'));
  const items: unknown = typeof raw === 'object' && raw !== null ? Reflect.get(raw, 'items') : undefined;

  if (typeof items !== 'object' || items === null) {
    throw new Error(`${overridesPath(deck)}: missing items`);
  }

  return Object.fromEntries(Object.entries(items));
}

export function promptTemplate(deck: ReviewDeck): string {
  return join(ROOT, 'scripts', 'review', 'prompts', `${deck.id}.md`);
}
