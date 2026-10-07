/**
 * Tatoeba licenses each sentence on its own, so every mined exercise must
 * carry a credit for its Norwegian sentence and for each translation it shows.
 */
import { describe, expect, it } from 'vitest';

import { LANGUAGE_CODES } from '../../core/types.ts';
import { prepositionDeck } from './index.ts';

describe('preposition deck attribution', () => {
  it('credits the sentence and every translation of each Tatoeba exercise', async () => {
    const mined = (await prepositionDeck.load()).filter((exercise) => exercise.source?.name === 'Tatoeba');
    const problems: string[] = [];

    expect(mined.length).toBeGreaterThan(0);

    for (const exercise of mined) {
      const source = exercise.source;

      if (source?.license === undefined || source.url === undefined) {
        problems.push(`${exercise.id}: sentence without licence or link`);
      }

      for (const lang of LANGUAGE_CODES) {
        const shown = exercise.translations?.[lang] !== undefined;
        const credit = source?.translations?.[lang];

        if (shown && credit?.license === undefined) {
          problems.push(`${exercise.id}: ${lang} translation without credit`);
        }
      }
    }

    expect(problems).toEqual([]);
  });
});
