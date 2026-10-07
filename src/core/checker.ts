/** Answer checking per exercise kind. Add a case here when adding a kind. */
import type { Exercise } from './types.ts';

/** Case- and whitespace-insensitive, and trailing punctuation never fails an answer. */
export function normalizeAnswer(value: string): string {
  return value
    .replace(/[\s.!?]+$/u, '')
    .trim()
    .toLocaleLowerCase('nb-NO')
    .replace(/\s+/gu, ' ');
}

export function isCorrect(exercise: Exercise, given: string): boolean {
  const candidate = normalizeAnswer(given);

  switch (exercise.kind) {
    case 'multiple-choice': {
      return candidate === normalizeAnswer(exercise.answer);
    }

    case 'type-in': {
      if (candidate === normalizeAnswer(exercise.answer)) {
        return true;
      }

      const alternatives = exercise.alternatives ?? [];

      return alternatives.some((alternative) => normalizeAnswer(alternative) === candidate);
    }
  }
}

/** Sentence shown in feedback, with the gap filled in. */
export function solutionText(exercise: Exercise): string {
  if (exercise.solution !== undefined) {
    return exercise.solution;
  }

  if (exercise.prompt.includes('___')) {
    return exercise.prompt.replace('___', exercise.answer);
  }

  return exercise.answer;
}

export interface GapParts {
  readonly before: string;
  readonly after: string;
  /** The answer as it appears in the solution, keeping its original casing. */
  readonly filled: string;
}

/**
 * Splits a cloze prompt around its gap. Returns null for plain questions.
 * The filled word is cut out of the solution so a sentence-initial answer
 * keeps its capital letter ("I dag …"), which the lower-case options lose.
 */
export function gapParts(exercise: Exercise): GapParts | null {
  const gapIndex = exercise.prompt.indexOf('___');

  if (gapIndex < 0) {
    return null;
  }

  const before = exercise.prompt.slice(0, gapIndex);
  const after = exercise.prompt.slice(gapIndex + 3);
  const solution = solutionText(exercise);

  const fitsSolution =
    solution.startsWith(before) &&
    solution.endsWith(after) &&
    solution.length > before.length + after.length;

  if (!fitsSolution) {
    return { before, after, filled: exercise.answer };
  }

  return { before, after, filled: solution.slice(before.length, solution.length - after.length) };
}
