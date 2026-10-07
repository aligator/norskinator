/**
 * Checks the word-order deck: every sentence is reviewed, explained,
 * translated and credited, and every accepted order uses exactly its tiles.
 */
import { describe, expect, it } from 'vitest';

import { normalizeAnswer } from '../../core/checker.ts';
import { loadDeck, presentAs } from '../../core/tasks.ts';
import { LANGUAGE_CODES } from '../../core/types.ts';
import { WORD_ORDER_RULES } from './categories.ts';
import { wordOrderDeck } from './index.ts';
import overridesFile from './overrides.json';
import corpus from './tatoeba.json';

const ITEMS = await loadDeck(wordOrderDeck);

/** The words of a sentence, case- and punctuation-insensitive, in sorted order. */
function wordBag(sentence: string): string {
  return normalizeAnswer(sentence)
    .replace(/[,.!?;:]/gu, ' ')
    .split(/\s+/u)
    .filter((word) => word !== '')
    .sort()
    .join(' ');
}

describe('word-order deck', () => {
  it('turns every item into a word-order exercise', () => {
    expect(ITEMS.length).toBeGreaterThan(300);
    expect(ITEMS.filter((item) => presentAs(item, 'word-order') === null).map((item) => item.id)).toEqual([]);
  });

  it('tags every item with a known rule', () => {
    const unknown = ITEMS.filter((item) => !WORD_ORDER_RULES.some((rule) => rule === item.tags[0]));

    expect(unknown.map((item) => `${item.id}: ${item.tags.join(', ')}`)).toEqual([]);
  });

  it('builds the answer and every alternative from exactly the tiles', () => {
    const problems = ITEMS.flatMap((item) => {
      if (item.dataKind !== 'sentence') {
        return [`${item.id}: not a sentence item`];
      }

      const tiles = wordBag(item.tiles.join(' '));

      return [item.answer, ...(item.alternatives ?? [])]
        .filter((sentence) => wordBag(sentence) !== tiles)
        .map((sentence) => `${item.id}: «${sentence}» does not match its tiles`);
    });

    expect(problems).toEqual([]);
  });

  it('explains and translates every item', () => {
    const problems = ITEMS.flatMap((item) => [
      ...(item.explanation === undefined || item.explanation.trim() === '' ? [`${item.id}: no explanation`] : []),
      ...LANGUAGE_CODES.filter((lang) => item.translations?.[lang] === undefined).map(
        (lang) => `${item.id}: no ${lang} translation`,
      ),
    ]);

    expect(problems).toEqual([]);
  });

  it('credits every sentence', () => {
    const uncredited = ITEMS.filter((item) => item.source?.url === undefined || item.source.license === undefined);

    expect(uncredited.map((item) => item.id)).toEqual([]);
  });

  it('reviewed every generated sentence', () => {
    const unreviewed = corpus.items.map((item) => `w-${item.id}`).filter((id) => !(id in overridesFile.items));

    expect(unreviewed).toEqual([]);
  });

  it('only overrides Tatoeba items that exist', () => {
    const known = new Set(corpus.items.map((item) => `w-${item.id}`));

    expect(Object.keys(overridesFile.items).filter((id) => !known.has(id))).toEqual([]);
  });
});
