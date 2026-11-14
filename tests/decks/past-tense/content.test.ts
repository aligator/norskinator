import { describe, expect, it } from 'vitest';

import { isCorrect, solutionText } from '../../../src/core/checker.ts';
import { parseTaskWeights } from '../../../src/core/task-weights.ts';
import { loadDeck, presentItem } from '../../../src/core/tasks.ts';
import { ExerciseKind } from '../../../src/core/types.ts';
import authoredFile from '../../../src/decks/past-tense/authored.json';
import { pastTenseDeck } from '../../../src/decks/past-tense/index.ts';
import { DECKS } from '../../../src/decks/registry.ts';

const ITEMS = await loadDeck(pastTenseDeck);

// Independently list the two valid forms of each verb so a malformed distractor fails.
const VERB_FORMS: Readonly<Record<string, readonly string[]>> = {
  bo: ['bodde', 'har bodd'],
  jobbe: ['jobbet', 'har jobbet'],
  være: ['var', 'har vært'],
  ha: ['hadde', 'har hatt'],
  kjenne: ['kjente', 'har kjent'],
  eie: ['eide', 'har eid'],
  spise: ['spiste', 'har spist'],
  drikke: ['drakk', 'har drukket'],
  lese: ['leste', 'har lest'],
  skrive: ['skrev', 'har skrevet'],
  se: ['så', 'har sett'],
  ta: ['tok', 'har tatt'],
};

const TYPING_PREFERENCE = parseTaskWeights({ 'multiple-choice': 0, 'type-in': 100, 'word-order': 100 });

describe('past-tense content', () => {
  it('is discoverable, reads every sentence and balances both tenses across twelve verbs', () => {
    expect(DECKS).toContain(pastTenseDeck);
    expect(ITEMS).toHaveLength(authoredFile.entries.length);
    expect(ITEMS).toHaveLength(24);
    expect(new Set(ITEMS.map((item) => item.id)).size).toBe(ITEMS.length);
    expect(new Set(ITEMS.map((item) => item.prompt)).size).toBe(ITEMS.length);

    for (const verb of Object.keys(VERB_FORMS)) {
      expect(ITEMS.filter((item) => item.id === `pt-${verb}-preteritum`)).toHaveLength(1);
      expect(ITEMS.filter((item) => item.id === `pt-${verb}-presens-perfektum`)).toHaveLength(1);
    }
  });

  it('offers two meaningful forms of the same verb even when the learner prefers typing', () => {
    for (const item of ITEMS) {
      const exercise = presentItem(item, TYPING_PREFERENCE, () => 0);
      const verb = item.id.split('-')[1] ?? '';

      expect(exercise?.kind).toBe(ExerciseKind.MultipleChoice);

      if (exercise?.kind !== ExerciseKind.MultipleChoice) {
        throw new Error(`Missing choices for ${item.id}`);
      }

      expect([...exercise.options].sort()).toEqual([...(VERB_FORMS[verb] ?? [])].sort());
      expect(exercise.options.filter((option) => isCorrect(exercise, option))).toEqual([exercise.answer]);
      expect(exercise.answer.startsWith('har ')).toBe(item.tags[0] === 'presens-perfektum');
    }
  });

  it('provides complete feedback, translations and AI attribution for every context', () => {
    for (const item of ITEMS) {
      const exercise = presentItem(item, TYPING_PREFERENCE, () => 0);

      if (exercise === null) {
        throw new Error(`Missing exercise for ${item.id}`);
      }

      expect(item.prompt.split('___')).toHaveLength(2);
      expect(solutionText(exercise)).toBe(item.prompt.replace('___', item.answer));
      expect(exercise.explanation).toContain('«');
      expect(exercise.explanation).toMatch(/preteritum/i);
      expect(exercise.explanation).toMatch(/perfektum/i);
      expect(exercise.translations?.de).toBeTruthy();
      expect(exercise.translations?.en).toBeTruthy();
      expect(exercise.source?.name).toBe('KI-generert for Norskinator');
      expect(exercise.source?.translations).toEqual({ de: { machine: true }, en: { machine: true } });
    }
  });
});
