/**
 * Hand-authored cloze content in template form.
 *
 * An entry is either one sentence, or a pattern with one `{slot}` plus a list
 * of fillers that each make a sentence. Every sentence names its permanent
 * item id in the data, so expanding never invents an id.
 */
import { LANGUAGE_CODES, type ClozeItem, type LanguageCode, type Level, type Translations } from './types.ts';

/** What every sentence carries besides its text. */
export interface AuthoredSentence {
  /** Stable key for SRS history. Never change or reuse it once shipped. */
  readonly id: string;
  /** More words that fill the gap correctly. */
  readonly alternatives?: readonly string[];
  readonly translations?: Translations;
}

export interface AuthoredFiller extends AuthoredSentence {
  /** Replaces the `{slot}` in the pattern. */
  readonly text: string;
  /** Replaces the entry's answer when the rule depends on the filler. */
  readonly answer?: string;
  readonly level?: Level;
}

interface EntryBase {
  /** Sentence with exactly one `___` gap; a template also has one `{slot}`. */
  readonly pattern: string;
  readonly answer: string;
  /** The answer plus wrong choices; a template lists every answer its fillers take. */
  readonly options: readonly string[];
  readonly explanation: string;
  /** Replaces `explanation` for fillers whose answer differs from the entry's. */
  readonly explanationByAnswer?: Readonly<Record<string, string>>;
  readonly level: Level;
  /** Tags after the answer, which is always the first tag. */
  readonly tags: readonly string[];
}

export interface SingleEntry extends EntryBase, AuthoredSentence {}

export interface TemplateEntry extends EntryBase {
  readonly fillers: readonly AuthoredFiller[];
}

export type AuthoredEntry = SingleEntry | TemplateEntry;

const SLOT = /\{[^{}]+\}/u;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function isLevel(value: unknown): value is Level {
  return value === 1 || value === 2 || value === 3;
}

function readStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readTranslations(value: unknown): Translations | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const translations: Partial<Record<LanguageCode, string>> = {};

  for (const lang of LANGUAGE_CODES) {
    const text = value[lang];

    if (typeof text === 'string' && text !== '') {
      translations[lang] = text;
    }
  }

  return translations;
}

function readSentence(value: Readonly<Record<string, unknown>>): AuthoredSentence | null {
  const id = value['id'];
  const alternatives = readStrings(value['alternatives']);
  const translations = readTranslations(value['translations']);

  if (typeof id !== 'string') {
    return null;
  }

  return {
    id,
    ...(alternatives.length > 0 ? { alternatives } : {}),
    ...(translations === undefined ? {} : { translations }),
  };
}

function readFiller(value: unknown): AuthoredFiller | null {
  if (!isRecord(value)) {
    return null;
  }

  const sentence = readSentence(value);
  const text = value['text'];
  const answer = value['answer'];
  const level = value['level'];

  if (sentence === null || typeof text !== 'string') {
    return null;
  }

  return {
    ...sentence,
    text,
    ...(typeof answer === 'string' ? { answer } : {}),
    ...(isLevel(level) ? { level } : {}),
  };
}

function readExplanations(value: unknown): Readonly<Record<string, string>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function readEntry(value: unknown): AuthoredEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const pattern = value['pattern'];
  const answer = value['answer'];
  const explanation = value['explanation'];
  const level = value['level'];

  if (typeof pattern !== 'string' || typeof answer !== 'string' || typeof explanation !== 'string' || !isLevel(level)) {
    return null;
  }

  const explanationByAnswer = readExplanations(value['explanationByAnswer']);
  const base: EntryBase = {
    pattern,
    answer,
    options: readStrings(value['options']),
    explanation,
    level,
    tags: readStrings(value['tags']),
    ...(explanationByAnswer === undefined ? {} : { explanationByAnswer }),
  };

  if (!Array.isArray(value['fillers'])) {
    const sentence = readSentence(value);

    return sentence === null ? null : { ...base, ...sentence };
  }

  const fillers = value['fillers'].map(readFiller).filter((filler) => filler !== null);

  return { ...base, fillers };
}

/** Reads `{ entries: [...] }`; malformed entries are skipped, the content test reports them. */
export function parseAuthored(raw: unknown): AuthoredEntry[] {
  const entries = isRecord(raw) ? raw['entries'] : undefined;

  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map(readEntry).filter((entry) => entry !== null);
}

export function isTemplate(entry: AuthoredEntry): entry is TemplateEntry {
  return 'fillers' in entry;
}

function toItem(
  deckId: string,
  entry: AuthoredEntry,
  sentence: AuthoredSentence,
  prompt: string,
  answer: string,
  level: Level,
): ClozeItem {
  const explanation =
    answer === entry.answer ? entry.explanation : (entry.explanationByAnswer?.[answer] ?? entry.explanation);

  return {
    dataKind: 'cloze',
    id: sentence.id,
    deckId,
    prompt,
    solution: prompt.replace('___', answer),
    explanation,
    answer,
    distractors: entry.options.filter((option) => option !== answer),
    level,
    tags: [answer, ...entry.tags],
    ...(sentence.alternatives === undefined ? {} : { alternatives: sentence.alternatives }),
    ...(sentence.translations === undefined ? {} : { translations: sentence.translations }),
  };
}

/** One item per sentence: a single entry gives one, a template one per filler. */
export function expandAuthored(deckId: string, entries: readonly AuthoredEntry[]): ClozeItem[] {
  return entries.flatMap((entry) => {
    if (!isTemplate(entry)) {
      return [toItem(deckId, entry, entry, entry.pattern, entry.answer, entry.level)];
    }

    return entry.fillers.map((filler) =>
      toItem(
        deckId,
        entry,
        filler,
        entry.pattern.replace(SLOT, () => filler.text),
        filler.answer ?? entry.answer,
        filler.level ?? entry.level,
      ),
    );
  });
}
