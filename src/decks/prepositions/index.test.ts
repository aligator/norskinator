/**
 * Checks the assembled deck: every pool loads, overrides still point at real
 * Tatoeba items, and every sentence is credited and translated.
 */
import { describe, expect, it } from 'vitest';

import { loadDeck } from '../../core/tasks.ts';
import { LANGUAGE_CODES } from '../../core/types.ts';
import { prepositionDeck } from './index.ts';
import overridesFile from './overrides.json';
import corpus from './tatoeba.json';

const ITEMS = await loadDeck(prepositionDeck);

describe('preposition deck', () => {
  it('loads every pool with both task types', () => {
    expect(ITEMS.length).toBeGreaterThan(1000);
    expect(ITEMS.every((item) => item.tasks.includes('multiple-choice') && item.tasks.includes('type-in'))).toBe(true);
  });

  it('credits the sentence and every translation of each item', () => {
    const problems: string[] = [];

    for (const item of ITEMS) {
      const source = item.source;

      if (source === undefined) {
        problems.push(`${item.id}: sentence without source`);
      }

      if (source?.url !== undefined && source.license === undefined) {
        problems.push(`${item.id}: corpus sentence without licence`);
      }

      for (const lang of LANGUAGE_CODES) {
        const shown = item.translations?.[lang] !== undefined;
        const fromCorpus = source?.url !== undefined;

        if (shown && fromCorpus && source.translations?.[lang] === undefined) {
          problems.push(`${item.id}: ${lang} translation without credit`);
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it('has a German and an English translation for every item', () => {
    const missing = ITEMS.filter((item) => LANGUAGE_CODES.some((lang) => item.translations?.[lang] === undefined));

    expect(missing.map((item) => item.id)).toEqual([]);
  });

  it('only overrides Tatoeba items that exist', () => {
    // Raw ids, before overrides drop the excluded ones.
    const known = new Set(corpus.items.map((item) => `p-${item.id}`));
    const stale = Object.keys(overridesFile.items).filter((id) => !known.has(id));

    expect(stale).toEqual([]);
  });
});
