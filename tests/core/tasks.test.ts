import { describe, expect, it } from 'vitest';

import { Grade } from '../../src/core/srs.ts';
import { gradeFromAnswer, loadDeck, presentAs, presentItem } from '../../src/core/tasks.ts';
import { DataKind, ExerciseKind, type ClozeItem, type Deck, type PlayableItem } from '../../src/core/types.ts';

const ITEM: PlayableItem = {
  dataKind: DataKind.Cloze,
  id: 'a',
  deckId: 'deck',
  prompt: 'Jeg bor ___ Norge.',
  answer: 'i',
  alternatives: ['på'],
  distractors: ['på', 'til', 'hos'],
  level: 1,
  tags: ['i'],
  tasks: [ExerciseKind.MultipleChoice, ExerciseKind.TypeIn],
};

function deck(item: ClozeItem): Deck {
  return {
    id: 'deck',
    title: 'Deck',
    shortTitle: 'Deck',
    description: '',
    icon: '🧪',
    tagLabel: 'Tag',
    sources: [{ dataKind: DataKind.Cloze, tasks: [ExerciseKind.TypeIn], load: async () => [item] }],
  };
}

describe('presentAs', () => {
  it('never offers an accepted alternative as a wrong choice', () => {
    const exercise = presentAs(ITEM, ExerciseKind.MultipleChoice);

    expect(exercise?.kind === ExerciseKind.MultipleChoice ? exercise.options : []).toEqual(['i', 'til', 'hos']);
  });

  it('drops multiple choice when too few wrong choices are left', () => {
    expect(presentAs({ ...ITEM, distractors: ['på', 'til'] }, ExerciseKind.MultipleChoice)).toBeNull();
  });

  it('accepts alternatives when typing', () => {
    const exercise = presentAs(ITEM, ExerciseKind.TypeIn);

    expect(exercise?.kind === ExerciseKind.TypeIn ? exercise.alternatives : []).toEqual(['på']);
  });

  it('refuses task types the pool does not allow', () => {
    expect(presentAs({ ...ITEM, tasks: [ExerciseKind.TypeIn] }, ExerciseKind.MultipleChoice)).toBeNull();
  });
});

describe('presentItem', () => {
  it('follows the weights', () => {
    const typed = { [ExerciseKind.MultipleChoice]: 0, [ExerciseKind.TypeIn]: 100, [ExerciseKind.WordOrder]: 100 } as const;
    const chosen = { [ExerciseKind.MultipleChoice]: 100, [ExerciseKind.TypeIn]: 0, [ExerciseKind.WordOrder]: 100 } as const;
    const even = { [ExerciseKind.MultipleChoice]: 50, [ExerciseKind.TypeIn]: 50, [ExerciseKind.WordOrder]: 100 } as const;

    expect(presentItem(ITEM, typed, () => 0.99)?.kind).toBe(ExerciseKind.TypeIn);
    expect(presentItem(ITEM, chosen, () => 0.99)?.kind).toBe(ExerciseKind.MultipleChoice);
    expect(presentItem(ITEM, even, () => 0.75)?.kind).toBe(ExerciseKind.TypeIn);
  });

  it('still shows an item whose only task type is set to 0 %', () => {
    const onlyTyped: PlayableItem = { ...ITEM, tasks: [ExerciseKind.TypeIn] };
    const chosen = { [ExerciseKind.MultipleChoice]: 100, [ExerciseKind.TypeIn]: 0, [ExerciseKind.WordOrder]: 100 } as const;

    expect(presentItem(onlyTyped, chosen, () => 0)?.kind).toBe(ExerciseKind.TypeIn);
  });
});

describe('loadDeck', () => {
  it('tags every item with the task types of its pool', async () => {
    const { tasks: _tasks, ...item } = ITEM;
    const items = await loadDeck(deck(item));

    expect(items.map((entry) => entry.tasks)).toEqual([[ExerciseKind.TypeIn]]);
  });
});

describe('gradeFromAnswer', () => {
  it('treats a wrong answer as a lapse regardless of speed', () => {
    expect(gradeFromAnswer(ExerciseKind.MultipleChoice, false, 500)).toBe(Grade.Again);
  });

  it('rewards a fast correct answer and penalises a slow one', () => {
    expect(gradeFromAnswer(ExerciseKind.MultipleChoice, true, 2000)).toBe(Grade.Easy);
    expect(gradeFromAnswer(ExerciseKind.MultipleChoice, true, 8000)).toBe(Grade.Good);
    expect(gradeFromAnswer(ExerciseKind.MultipleChoice, true, 20_000)).toBe(Grade.Hard);
  });

  it('allows more time for the task types that take more work', () => {
    expect(gradeFromAnswer(ExerciseKind.MultipleChoice, true, 10_000)).toBe(Grade.Good);
    expect(gradeFromAnswer(ExerciseKind.TypeIn, true, 6000)).toBe(Grade.Easy);
    expect(gradeFromAnswer(ExerciseKind.TypeIn, true, 20_000)).toBe(Grade.Good);
    expect(gradeFromAnswer(ExerciseKind.WordOrder, true, 10_000)).toBe(Grade.Easy);
    expect(gradeFromAnswer(ExerciseKind.WordOrder, true, 30_000)).toBe(Grade.Good);
    expect(gradeFromAnswer(ExerciseKind.WordOrder, true, 40_000)).toBe(Grade.Hard);
  });

  it('does not read a backgrounded tab or a clock change as difficulty', () => {
    expect(gradeFromAnswer(ExerciseKind.TypeIn, true, 10 * 60_000)).toBe(Grade.Good);
    expect(gradeFromAnswer(ExerciseKind.TypeIn, true, -5000)).toBe(Grade.Good);
  });
});
