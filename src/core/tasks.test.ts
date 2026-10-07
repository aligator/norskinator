import { describe, expect, it } from 'vitest';

import { loadDeck, presentAs, presentItem } from './tasks.ts';
import type { ClozeItem, Deck, PlayableItem } from './types.ts';

const ITEM: PlayableItem = {
  dataKind: 'cloze',
  id: 'a',
  deckId: 'deck',
  prompt: 'Jeg bor ___ Norge.',
  answer: 'i',
  alternatives: ['på'],
  distractors: ['på', 'til', 'hos'],
  level: 1,
  tags: ['i'],
  tasks: ['multiple-choice', 'type-in'],
};

function deck(item: ClozeItem): Deck {
  return {
    id: 'deck',
    title: 'Deck',
    shortTitle: 'Deck',
    description: '',
    icon: '🧪',
    tagLabel: 'Tag',
    sources: [{ dataKind: 'cloze', tasks: ['type-in'], load: async () => [item] }],
  };
}

describe('presentAs', () => {
  it('never offers an accepted alternative as a wrong choice', () => {
    const exercise = presentAs(ITEM, 'multiple-choice');

    expect(exercise?.kind === 'multiple-choice' ? exercise.options : []).toEqual(['i', 'til', 'hos']);
  });

  it('drops multiple choice when too few wrong choices are left', () => {
    expect(presentAs({ ...ITEM, distractors: ['på', 'til'] }, 'multiple-choice')).toBeNull();
  });

  it('accepts alternatives when typing', () => {
    const exercise = presentAs(ITEM, 'type-in');

    expect(exercise?.kind === 'type-in' ? exercise.alternatives : []).toEqual(['på']);
  });

  it('refuses task types the pool does not allow', () => {
    expect(presentAs({ ...ITEM, tasks: ['type-in'] }, 'multiple-choice')).toBeNull();
  });
});

describe('presentItem', () => {
  it('follows the weights', () => {
    const typed = { 'multiple-choice': 0, 'type-in': 100, 'word-order': 100 } as const;
    const chosen = { 'multiple-choice': 100, 'type-in': 0, 'word-order': 100 } as const;

    expect(presentItem(ITEM, typed, () => 0.99)?.kind).toBe('type-in');
    expect(presentItem(ITEM, chosen, () => 0.99)?.kind).toBe('multiple-choice');
    expect(presentItem(ITEM, { 'multiple-choice': 50, 'type-in': 50, 'word-order': 100 }, () => 0.75)?.kind).toBe('type-in');
  });

  it('still shows an item whose only task type is set to 0 %', () => {
    const onlyTyped: PlayableItem = { ...ITEM, tasks: ['type-in'] };

    expect(presentItem(onlyTyped, { 'multiple-choice': 100, 'type-in': 0, 'word-order': 100 }, () => 0)?.kind).toBe('type-in');
  });
});

describe('loadDeck', () => {
  it('tags every item with the task types of its pool', async () => {
    const { tasks: _tasks, ...item } = ITEM;
    const items = await loadDeck(deck(item));

    expect(items.map((entry) => entry.tasks)).toEqual([['type-in']]);
  });
});
