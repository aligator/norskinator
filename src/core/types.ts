/**
 * Generic domain types.
 *
 * Nothing here knows about prepositions — a topic is just a {@link Deck} that
 * produces {@link Exercise}es. Adding a new topic means adding a deck module
 * and registering it; adding a new question format means adding an
 * {@link ExerciseKind}, a checker and a renderer.
 */

/** Supported question formats. Extend here, then in `checker.ts` and `ui/modules/practice/exercise-card.ts`. */
export type ExerciseKind = 'multiple-choice' | 'type-in';

export type Level = 1 | 2 | 3;

export type LanguageCode = 'de' | 'en';

export const LANGUAGE_CODES: readonly LanguageCode[] = ['de', 'en'];

export type Translations = Readonly<Partial<Record<LanguageCode, string>>>;

/** One corpus sentence: where it lives, who wrote it and how it may be reused. */
export interface SourceCredit {
  /** Id within the corpus, for attribution and bug reports. */
  readonly id: string;
  readonly url?: string;
  /** Contributor's username; absent when the corpus no longer knows it. */
  readonly author?: string;
  /** Licence name, e.g. "CC BY 2.0 FR". */
  readonly license?: string;
}

export interface ExerciseSource extends SourceCredit {
  /** Human readable corpus name, e.g. "Tatoeba". */
  readonly name: string;
  /** The sentences in `Exercise.translations` have their own authors. */
  readonly translations?: Readonly<Partial<Record<LanguageCode, SourceCredit>>>;
}

interface ExerciseBase {
  readonly id: string;
  readonly deckId: string;
  readonly kind: ExerciseKind;
  /**
   * Question text. A `___` marks the gap when the exercise is a cloze;
   * without it the prompt is shown as a plain question.
   */
  readonly prompt: string;
  /** Complete, correct sentence shown in the feedback step. */
  readonly solution?: string;
  /** Didactic note shown after answering. */
  readonly explanation?: string;
  readonly level: Level;
  /** Free-form labels used for filtering and stats, e.g. `["sted", "i"]`. */
  readonly tags: readonly string[];
  readonly translations?: Translations;
  readonly source?: ExerciseSource;
}

export interface MultipleChoiceExercise extends ExerciseBase {
  readonly kind: 'multiple-choice';
  readonly options: readonly string[];
  readonly answer: string;
}

export interface TypeInExercise extends ExerciseBase {
  readonly kind: 'type-in';
  readonly answer: string;
  /** Extra spellings accepted as correct. */
  readonly alternatives?: readonly string[];
}

export type Exercise = MultipleChoiceExercise | TypeInExercise;

/** A topic the learner can practise. */
export interface Deck {
  readonly id: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
  /** Emoji shown in the deck list. */
  readonly icon: string;
  /** Label for the tag dimension this deck groups by, e.g. "Preposisjon". */
  readonly tagLabel: string;
  /** Loaded lazily so a large deck never blocks first paint. */
  load(): Promise<readonly Exercise[]>;
}

/** Shape of a generated data file on disk. */
export interface GeneratedBundle {
  readonly version: number;
  readonly generatedAt: string;
  readonly license: string;
  readonly source: string;
  readonly items: readonly GeneratedItem[];
}

/** Deck-agnostic item as stored in JSON; the deck adds `deckId` and `kind`. */
export interface GeneratedItem {
  readonly id: string;
  readonly prompt: string;
  readonly solution: string;
  readonly answer: string;
  readonly options: readonly string[];
  readonly level: Level;
  readonly tags: readonly string[];
  readonly translations?: Translations;
  readonly sourceId: number;
  /** Username of the source sentence's contributor; absent for orphaned sentences. */
  readonly author?: string;
  /** Only set when it differs from the bundle's licence. */
  readonly license?: string;
  readonly translationCredits?: Readonly<Partial<Record<LanguageCode, GeneratedCredit>>>;
}

/** Attribution of one corpus sentence in a generated bundle. */
export interface GeneratedCredit {
  readonly id: number;
  readonly author?: string;
  /** Only set when it differs from the bundle's licence. */
  readonly license?: string;
}
