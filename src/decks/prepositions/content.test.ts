/**
 * Content-quality gate for hand-written and template exercises.
 *
 * The mined corpus is checked by the generator; these two sources are typed
 * by hand, so slips (a stray `___`, an answer missing from the options, an
 * antonym as distractor) are caught here before a learner sees them.
 */
import { describe, expect, it } from 'vitest';

import type { Exercise, MultipleChoiceExercise } from '../../core/types.ts';
import { CURATED_ALLOWED_CONTRASTS, CURATED_EXERCISES } from './curated.ts';
import { isExcludedDistractor, isPreposition, PREPOSITIONS } from './prepositions.ts';
import { TEMPLATE_EXERCISES } from './templates.ts';

const MIN_ANSWERS_PER_PREPOSITION = 4;
const KEBAB_CASE = '[a-z0-9]+(?:-[a-z0-9]+)*';
const CURATED_ID = new RegExp(`^p-curated-${KEBAB_CASE}$`);
const TEMPLATE_ID = new RegExp(`^p-tpl-${KEBAB_CASE}$`);

function multipleChoice(exercises: readonly Exercise[]): MultipleChoiceExercise[] {
  return exercises.filter(
    (exercise): exercise is MultipleChoiceExercise => exercise.kind === 'multiple-choice',
  );
}

const CURATED = multipleChoice(CURATED_EXERCISES);
const TEMPLATES = multipleChoice(TEMPLATE_EXERCISES);
const ALL = [...CURATED, ...TEMPLATES];

/** Runs `check` on every exercise and returns `"<id>: <problem>"` lines, so one failure lists them all. */
function collectProblems(
  exercises: readonly MultipleChoiceExercise[],
  check: (exercise: MultipleChoiceExercise) => readonly string[],
): string[] {
  return exercises.flatMap((exercise) => check(exercise).map((problem) => `${exercise.id}: ${problem}`));
}

function distractorsOf(exercise: MultipleChoiceExercise): string[] {
  return exercise.options.filter((option) => option !== exercise.answer);
}

function excludedDistractorsOf(exercise: MultipleChoiceExercise): string[] {
  const answer = exercise.answer;

  if (!isPreposition(answer)) {
    return [];
  }

  return distractorsOf(exercise).filter(
    (distractor) => isPreposition(distractor) && isExcludedDistractor(answer, distractor),
  );
}

function countAnswers(exercises: readonly MultipleChoiceExercise[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const exercise of exercises) {
    counts.set(exercise.answer, (counts.get(exercise.answer) ?? 0) + 1);
  }

  return counts;
}

function underrepresented(exercises: readonly MultipleChoiceExercise[]): string[] {
  const counts = countAnswers(exercises);

  return PREPOSITIONS.filter(
    (preposition) => (counts.get(preposition) ?? 0) < MIN_ANSWERS_PER_PREPOSITION,
  ).map((preposition) => `${preposition}: ${counts.get(preposition) ?? 0}`);
}

describe('preposition content', () => {
  it('has curated and template exercises, all multiple choice', () => {
    expect(CURATED.length).toBeGreaterThan(0);
    expect(TEMPLATES.length).toBeGreaterThan(0);
    expect(ALL).toHaveLength(CURATED_EXERCISES.length + TEMPLATE_EXERCISES.length);
  });

  it('uses unique, well-formed ids across both sources', () => {
    const ids = ALL.map((exercise) => exercise.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

    expect(duplicates).toEqual([]);
    expect(CURATED.filter((exercise) => !CURATED_ID.test(exercise.id)).map((exercise) => exercise.id)).toEqual([]);
    expect(TEMPLATES.filter((exercise) => !TEMPLATE_ID.test(exercise.id)).map((exercise) => exercise.id)).toEqual(
      [],
    );
  });

  it('never repeats the same sentence', () => {
    const prompts = ALL.map((exercise) => exercise.prompt);
    const duplicates = prompts.filter((prompt, index) => prompts.indexOf(prompt) !== index);

    expect(duplicates).toEqual([]);
  });

  it('has exactly one gap, no leftover template slot and a matching solution', () => {
    const problems = collectProblems(ALL, (exercise) => {
      const found: string[] = [];

      if (exercise.prompt.split('___').length !== 2) {
        found.push('prompt needs exactly one ___');
      }

      if (/[{}]/.test(exercise.prompt)) {
        found.push('unfilled template slot');
      }

      if (exercise.solution !== exercise.prompt.replace('___', exercise.answer)) {
        found.push('solution does not match prompt + answer');
      }

      return found;
    });

    expect(problems).toEqual([]);
  });

  it('offers 3–4 unique prepositions including the answer', () => {
    const problems = collectProblems(ALL, (exercise) => {
      const found: string[] = [];

      if (exercise.options.length < 3 || exercise.options.length > 4) {
        found.push(`${exercise.options.length} options`);
      }

      if (!exercise.options.includes(exercise.answer)) {
        found.push('answer missing from options');
      }

      if (new Set(exercise.options).size !== exercise.options.length) {
        found.push('duplicate option');
      }

      const outsiders = exercise.options.filter((option) => !isPreposition(option));

      if (outsiders.length > 0) {
        found.push(`options outside PREPOSITIONS: ${outsiders.join(', ')}`);
      }

      return found;
    });

    expect(problems).toEqual([]);
  });

  it('never pairs the answer with an excluded distractor unless the item opts out', () => {
    const problems = collectProblems(ALL, (exercise) => {
      const allowed = CURATED_ALLOWED_CONTRASTS.get(exercise.id) ?? [];

      return excludedDistractorsOf(exercise)
        .filter((distractor) => !allowed.some((contrast) => contrast === distractor))
        .map((distractor) => `«${distractor}» is an excluded distractor for «${exercise.answer}»`);
    });

    expect(problems).toEqual([]);
  });

  it('keeps every contrast opt-out in use', () => {
    const byId = new Map(CURATED.map((exercise) => [exercise.id, exercise]));
    const stale: string[] = [];

    for (const [id, contrasts] of CURATED_ALLOWED_CONTRASTS) {
      const exercise = byId.get(id);
      const excluded = exercise === undefined ? [] : excludedDistractorsOf(exercise);

      for (const contrast of contrasts) {
        if (!excluded.includes(contrast)) {
          stale.push(`${id}: «${contrast}» is not an excluded distractor here`);
        }
      }
    }

    expect(stale).toEqual([]);
  });

  it('explains every item and uses a valid level and tags', () => {
    const problems = collectProblems(ALL, (exercise) => {
      const found: string[] = [];

      if (exercise.explanation === undefined || exercise.explanation.trim() === '') {
        found.push('missing explanation');
      }

      if (![1, 2, 3].includes(exercise.level)) {
        found.push(`level ${exercise.level}`);
      }

      if (exercise.tags[0] !== exercise.answer) {
        found.push('first tag must be the answer');
      }

      if (!exercise.tags.some((tag) => tag.startsWith('tema:'))) {
        found.push('missing tema: tag');
      }

      return found;
    });

    expect(problems).toEqual([]);
  });

  it('marks template items with kilde:mal', () => {
    const unmarked = TEMPLATES.filter((exercise) => !exercise.tags.includes('kilde:mal'));

    expect(unmarked.map((exercise) => exercise.id)).toEqual([]);
  });

  it(`uses every preposition as answer at least ${MIN_ANSWERS_PER_PREPOSITION} times`, () => {
    expect(underrepresented(ALL)).toEqual([]);
  });

  it(`gives every preposition at least ${MIN_ANSWERS_PER_PREPOSITION} hand-written items`, () => {
    expect(underrepresented(CURATED)).toEqual([]);
  });
});
