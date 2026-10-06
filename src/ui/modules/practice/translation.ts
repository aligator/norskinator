/** Picks the translation to show, falling back to the other language when one is missing. */
import type { TranslationLanguage } from '../../../core/storage.ts';
import type { Exercise, LanguageCode } from '../../../core/types.ts';

export interface ShownTranslation {
  readonly lang: LanguageCode;
  readonly text: string;
}

const FALLBACK: Readonly<Record<LanguageCode, LanguageCode>> = { de: 'en', en: 'de' };

export function pickTranslation(exercise: Exercise, preference: TranslationLanguage): ShownTranslation | null {
  if (preference === 'none' || exercise.translations === undefined) {
    return null;
  }

  const preferred = exercise.translations[preference];

  if (preferred !== undefined) {
    return { lang: preference, text: preferred };
  }

  const other = FALLBACK[preference];
  const fallback = exercise.translations[other];

  if (fallback === undefined) {
    return null;
  }

  return { lang: other, text: fallback };
}
