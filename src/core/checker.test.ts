import { describe, expect, it } from 'vitest';

import { gapParts, isCorrect, solutionText } from './checker.ts';
import type { Exercise } from './types.ts';

const choice: Exercise = {
  kind: 'multiple-choice',
  id: 'a',
  deckId: 'test',
  prompt: 'Jeg bor ___ Norge.',
  solution: 'Jeg bor i Norge.',
  answer: 'i',
  options: ['i', 'på', 'til', 'av'],
  level: 1,
  tags: ['i'],
};

const typeIn: Exercise = {
  kind: 'type-in',
  id: 'b',
  deckId: 'test',
  prompt: 'Hun er glad ___ deg.',
  answer: 'i',
  alternatives: ['glad i'],
  level: 2,
  tags: ['i'],
};

describe('isCorrect', () => {
  it('accepts the answer regardless of case and padding', () => {
    expect(isCorrect(choice, 'i')).toBe(true);
    expect(isCorrect(choice, '  I ')).toBe(true);
    expect(isCorrect(choice, 'på')).toBe(false);
  });

  it('accepts listed alternatives for typed answers', () => {
    expect(isCorrect(typeIn, 'Glad i')).toBe(true);
    expect(isCorrect(typeIn, 'glad  i')).toBe(true);
    expect(isCorrect(typeIn, 'glad for')).toBe(false);
  });

  it('does not let trailing punctuation fail an otherwise right answer', () => {
    expect(isCorrect(typeIn, 'i.')).toBe(true);
    expect(isCorrect(typeIn, 'i .')).toBe(true);
  });
});

describe('solutionText', () => {
  it('uses the stored solution when there is one', () => {
    expect(solutionText(choice)).toBe('Jeg bor i Norge.');
  });

  it('fills the gap when no solution was stored', () => {
    expect(solutionText(typeIn)).toBe('Hun er glad i deg.');
  });
});

describe('gapParts', () => {
  it('splits the prompt and takes the filled word from the solution', () => {
    expect(gapParts(choice)).toEqual({ before: 'Jeg bor ', after: ' Norge.', filled: 'i' });
  });

  it('keeps the capital letter of a sentence-initial answer', () => {
    const initial: Exercise = { ...choice, prompt: '___ dag er det fint.', solution: 'I dag er det fint.' };

    expect(gapParts(initial)?.filled).toBe('I');
  });

  it('returns null for a prompt without a gap', () => {
    expect(gapParts({ ...choice, prompt: 'Hva betyr «på»?' })).toBeNull();
  });
});
