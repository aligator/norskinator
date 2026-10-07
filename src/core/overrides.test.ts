import { describe, expect, it } from 'vitest';

import { applyOverrides, parseOverrides } from './overrides.ts';
import type { ClozeItem } from './types.ts';

const ITEM: ClozeItem = {
  dataKind: 'cloze',
  id: 'a-t1',
  deckId: 'deck',
  prompt: 'Vi bor i et ___ hus.',
  hint: 'stor',
  answer: 'stort',
  alternatives: ['svært'],
  distractors: ['stor', 'store'],
  level: 1,
  tags: ['en/ei-ord', 'type:regelmessig'],
  explanation: 'Old note.',
  translations: { en: 'We live in a big house.' },
  source: {
    name: 'Tatoeba',
    id: '1',
    url: 'https://tatoeba.org/en/sentences/show/1',
    license: 'CC BY 2.0 FR',
    translations: { en: { id: '2', license: 'CC BY 2.0 FR' } },
  },
};

function applyOne(override: unknown, item: ClozeItem = ITEM): ClozeItem[] {
  return applyOverrides([item], parseOverrides({ version: 1, items: { [item.id]: override } }));
}

describe('applyOverrides', () => {
  it('leaves items without an override untouched', () => {
    expect(applyOverrides([ITEM], parseOverrides({ version: 1, items: {} }))).toEqual([ITEM]);
  });

  it('merges alternatives without duplicates and never accepts the answer as one', () => {
    const [item] = applyOne({ alternatives: ['svært', 'diger', 'stort'] });

    expect(item?.alternatives).toEqual(['svært', 'diger']);
  });

  it('drops excluded items', () => {
    expect(applyOne({ exclude: true })).toEqual([]);
  });

  it('only fills missing translations and credits them as machine translations', () => {
    const [item] = applyOne({ translations: { de: 'Wir wohnen in einem großen Haus.', en: 'Overwritten?' } });

    expect(item?.translations).toEqual({ en: 'We live in a big house.', de: 'Wir wohnen in einem großen Haus.' });
    expect(item?.source?.translations).toEqual({
      en: { id: '2', license: 'CC BY 2.0 FR' },
      de: { machine: true },
    });
  });

  it('replaces tags and explanation', () => {
    const [item] = applyOne({ tags: ['et-ord', 'type:regelmessig'], explanation: 'Et-ord take -t.' });

    expect(item?.tags).toEqual(['et-ord', 'type:regelmessig']);
    expect(item?.explanation).toBe('Et-ord take -t.');
  });

  it('keeps the item tags when the override lists none', () => {
    const [item] = applyOne({ tags: [], alternatives: ['diger'] });

    expect(item?.tags).toEqual(ITEM.tags);
    expect(item?.explanation).toBe(ITEM.explanation);
  });
});

describe('parseOverrides', () => {
  it('skips malformed entries and fields', () => {
    const overrides = parseOverrides({
      items: { broken: 'yes', 'a-t1': { tags: ['et-ord', 3, ' '], explanation: 7, translations: { fr: 'x' } } },
    });

    expect(overrides.has('broken')).toBe(false);
    expect(overrides.get('a-t1')).toEqual({ alternatives: [], exclude: false, translations: {}, tags: ['et-ord'] });
  });
});
