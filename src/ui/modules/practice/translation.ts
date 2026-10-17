/** Picks the translation to show, falling back to the other language when one is missing. */
import { TranslationLanguage } from '../../../core/storage.ts';
import { LanguageCode, type DataItem, type Exercise } from '../../../core/types.ts';

export interface ShownTranslation {
  readonly lang: LanguageCode;
  readonly text: string;
}

type ShownLanguage = Exclude<TranslationLanguage, TranslationLanguage.None>;

const LANGUAGE_OF: Readonly<Record<ShownLanguage, LanguageCode>> = {
  [TranslationLanguage.German]: LanguageCode.German,
  [TranslationLanguage.English]: LanguageCode.English,
};

const FALLBACK: Readonly<Record<LanguageCode, LanguageCode>> = {
  [LanguageCode.German]: LanguageCode.English,
  [LanguageCode.English]: LanguageCode.German,
};

export function pickTranslation(
  exercise: Pick<Exercise | DataItem, 'translations'>,
  preference: TranslationLanguage,
): ShownTranslation | null {
  if (preference === TranslationLanguage.None || exercise.translations === undefined) {
    return null;
  }

  const lang = LANGUAGE_OF[preference];
  const preferred = exercise.translations[lang];

  if (preferred !== undefined) {
    return { lang, text: preferred };
  }

  const other = FALLBACK[lang];
  const fallback = exercise.translations[other];

  if (fallback === undefined) {
    return null;
  }

  return { lang: other, text: fallback };
}

/** Word order is prompted by the translation, so it shows one even when the learner turned hints off. */
export function promptTranslation(exercise: Exercise, preference: TranslationLanguage): ShownTranslation | null {
  return pickTranslation(exercise, preference === TranslationLanguage.None ? TranslationLanguage.German : preference);
}
