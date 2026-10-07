/**
 * Checks the assembled adjective deck: every item has its hint and form tags,
 * overrides still point at real Tatoeba items, and every sentence is credited.
 */
import { describe, expect, it } from 'vitest';

import { loadDeck, presentAs } from '../../core/tasks.ts';
import { LANGUAGE_CODES } from '../../core/types.ts';
import { isFormCategory } from './categories.ts';
import { adjectiveDeck } from './index.ts';
import overridesFile from './overrides.json';
import corpus from './tatoeba.json';

const ITEMS = await loadDeck(adjectiveDeck);

describe('adjective deck', () => {
  it('loads with both task types', () => {
    expect(ITEMS.length).toBeGreaterThan(0);
    expect(ITEMS.every((item) => item.tasks.includes('multiple-choice') && item.tasks.includes('type-in'))).toBe(true);
  });

  it('shows the dictionary form as a hint for every item', () => {
    const missing = ITEMS.filter((item) => item.hint === undefined || item.hint.trim() === '');

    expect(missing.map((item) => item.id)).toEqual([]);
  });

  it('tags every item with its form category and adjective type', () => {
    const problems = ITEMS.filter((item) => {
      const [form, type] = item.tags;

      return form === undefined || !isFormCategory(form) || type === undefined || !type.startsWith('type:');
    });

    expect(problems.map((item) => `${item.id}: ${item.tags.join(', ')}`)).toEqual([]);
  });

  it('never offers the answer as a wrong choice', () => {
    const problems = ITEMS.filter((item) => item.dataKind === 'cloze' && item.distractors.includes(item.answer));

    expect(problems.map((item) => item.id)).toEqual([]);
  });

  it('offers multiple choice for nearly every item', () => {
    // An item with too few wrong choices is still practised by typing it in.
    const typeInOnly = ITEMS.filter((item) => presentAs(item, 'multiple-choice') === null);

    expect(typeInOnly.length).toBeLessThan(ITEMS.length / 10);
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

  it('explains and translates every item', () => {
    const problems = ITEMS.flatMap((item) => [
      ...(item.explanation === undefined || item.explanation.trim() === '' ? [`${item.id}: no explanation`] : []),
      ...LANGUAGE_CODES.filter((lang) => item.translations?.[lang] === undefined).map(
        (lang) => `${item.id}: no ${lang} translation`,
      ),
    ]);

    expect(problems).toEqual([]);
  });

  it('reviewed every generated sentence', () => {
    const unreviewed = corpus.items.map((item) => `a-${item.id}`).filter((id) => !(id in overridesFile.items));

    expect(unreviewed).toEqual([]);
  });

  it('only overrides Tatoeba items that exist', () => {
    // Raw ids, before overrides drop the excluded ones.
    const known = new Set(corpus.items.map((item) => `a-${item.id}`));
    const stale = Object.keys(overridesFile.items).filter((id) => !known.has(id));

    expect(stale).toEqual([]);
  });
});
