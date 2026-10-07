/**
 * Step 2 of the corpus review: validates the reviewers' `out-<n>.jsonl` and
 * merges them into the deck's `overrides.json`. Every reviewed item gets an
 * entry, an empty one when nothing needed changing, so the next export
 * knows it was reviewed.
 *
 *   pnpm run review:merge <deck>
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LANGUAGE_CODES, type GeneratedItem, type LanguageCode } from '../../src/core/types.ts';
import { deckFromArgs, overridesPath, readBundle, readOverrideEntries, reviewDir, type ReviewDeck } from './decks.ts';

interface OverrideEntry {
  alternatives?: string[];
  exclude?: true;
  translations?: Partial<Record<LanguageCode, string>>;
  tags?: string[];
  explanation?: string;
  note?: string;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function readAlternatives(deck: ReviewDeck, value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => (deck.dataKind === 'cloze' ? entry.trim().toLowerCase() : entry.trim()))
    .filter((entry) => entry !== '');
}

/** Turns one reviewer line into an override entry, or a problem description. */
function toEntry(deck: ReviewDeck, item: GeneratedItem, review: Readonly<Record<string, unknown>>): OverrideEntry | string {
  const note = typeof review['note'] === 'string' ? review['note'] : undefined;

  if (review['exclude'] === true) {
    return { exclude: true, ...(note === undefined ? {} : { note }) };
  }

  const entry: OverrideEntry = {};
  const known = new Set([item.answer, ...(item.alternatives ?? [])]);
  const alternatives = readAlternatives(deck, review['alternatives']).filter((word) => !known.has(word));

  if (alternatives.length > 0) {
    entry.alternatives = alternatives;
  }

  const translations: Partial<Record<LanguageCode, string>> = {};
  const given = isRecord(review['translations']) ? review['translations'] : {};

  for (const lang of LANGUAGE_CODES) {
    const text = given[lang];

    if (item.translations?.[lang] === undefined && typeof text === 'string' && text.trim() !== '') {
      translations[lang] = text.trim();
    }
  }

  if (Object.keys(translations).length > 0) {
    entry.translations = translations;
  }

  const category = review['category'];

  if (deck.categories.length > 0) {
    if (typeof category !== 'string' || !deck.categories.includes(category)) {
      return `invalid category ${String(category)}`;
    }

    entry.tags = [category, ...item.tags.slice(1)];
  }

  const explanation = review['explanation'];

  if (typeof explanation === 'string' && explanation.trim() !== '') {
    entry.explanation = explanation.trim();
  }

  if (note !== undefined && entry.alternatives !== undefined) {
    entry.note = note;
  }

  return entry;
}

async function main(): Promise<void> {
  const deck = deckFromArgs();
  const dir = reviewDir(deck);
  const bundle = await readBundle(deck);
  const existing = await readOverrideEntries(deck);

  const byId = new Map(bundle.items.map((item) => [`${deck.idPrefix}${item.id}`, item]));
  const outputs = (await readdir(dir)).filter((name) => /^out-\d+\.jsonl$/.test(name));
  const merged = new Map<string, OverrideEntry>();
  const problems: string[] = [];

  for (const name of outputs) {
    const lines = (await readFile(join(dir, name), 'utf8')).split('\n').filter((line) => line.trim() !== '');

    for (const line of lines) {
      const review: unknown = JSON.parse(line);
      const id = isRecord(review) ? review['id'] : undefined;
      const item = typeof id === 'string' ? byId.get(id) : undefined;

      if (!isRecord(review) || typeof id !== 'string' || item === undefined) {
        problems.push(`${name}: unknown id ${String(id)}`);
        continue;
      }

      if (merged.has(id)) {
        problems.push(`${name}: ${id} reviewed twice`);
        continue;
      }

      const entry = toEntry(deck, item, review);

      if (typeof entry === 'string') {
        problems.push(`${name}: ${id}: ${entry}`);
        continue;
      }

      merged.set(id, entry);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Nothing merged; fix the reviewer output first:\n${problems.join('\n')}`);
  }

  const items: Readonly<Record<string, unknown>> = { ...existing, ...Object.fromEntries(merged) };
  const sorted = Object.fromEntries(Object.keys(items).sort().map((id) => [id, items[id]]));

  await writeFile(overridesPath(deck), `${JSON.stringify({ version: 1, items: sorted }, null, 2)}\n`, 'utf8');

  const excluded = [...merged.values()].filter((entry) => entry.exclude === true).length;

  console.log(`merged ${merged.size} reviews (${excluded} excluded) into ${overridesPath(deck)}`);
  console.log('Next: pnpm run verify — the deck tests check that every item is reviewed, credited and translated.');
}

await main();
