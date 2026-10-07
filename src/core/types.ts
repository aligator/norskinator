/**
 * Generic domain types.
 *
 * Content and presentation are separate. A {@link Deck} holds pools of
 * {@link DataItem}s; task types (`tasks.ts`) turn an item into an
 * {@link Exercise}. Each task type declares the {@link DataKind} it can show,
 * and one item can be shown as any task type its pool allows. SRS history
 * belongs to the item, so it is shared across task types.
 *
 * Nothing here knows about prepositions. A new topic is a deck module; a new
 * shape of content is a {@link DataKind}; a new way to ask is an
 * {@link ExerciseKind}.
 */

/** Shapes of content. Extend here, then add the item type and task types that can show it. */
export type DataKind = 'cloze';

/**
 * Ways to present an item. Extend here, then in `tasks.ts`, `checker.ts` and
 * `ui/modules/practice/exercise-card.ts`.
 */
export type ExerciseKind = 'multiple-choice' | 'type-in';

export const EXERCISE_KINDS: readonly ExerciseKind[] = ['multiple-choice', 'type-in'];

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

/** A translation written by AI because the corpus had none. */
export interface MachineTranslation {
  readonly machine: true;
}

export type TranslationCredit = SourceCredit | MachineTranslation;

export interface ExerciseSource extends SourceCredit {
  /** Human readable corpus or project name, e.g. "Tatoeba". */
  readonly name: string;
  /** The sentences in `translations` have their own authors. */
  readonly translations?: Readonly<Partial<Record<LanguageCode, TranslationCredit>>>;
}

/** What scheduling and statistics need to know about an item or exercise. */
export interface ItemMeta {
  /** Stable key for SRS history. Never change or reuse it once shipped. */
  readonly id: string;
  readonly deckId: string;
  readonly level: Level;
  /** Free-form labels used for filtering and stats, e.g. `["sted", "i"]`. */
  readonly tags: readonly string[];
}

interface Content extends ItemMeta {
  /**
   * Question text. A `___` marks the gap when the item is a cloze; without it
   * the prompt is shown as a plain question.
   */
  readonly prompt: string;
  /** Complete, correct sentence shown in the feedback step. */
  readonly solution?: string;
  /** Didactic note shown after answering. */
  readonly explanation?: string;
  readonly translations?: Translations;
  readonly source?: ExerciseSource;
}

/** A sentence with one gap, the word that fills it and wrong choices for it. */
export interface ClozeItem extends Content {
  readonly dataKind: 'cloze';
  readonly answer: string;
  /** Other words that also fit the gap: accepted when typed, never offered as wrong choices. */
  readonly alternatives?: readonly string[];
  readonly distractors: readonly string[];
}

export type DataItem = ClozeItem;

/** An item together with the task types its deck practises it with. */
export type PlayableItem = DataItem & { readonly tasks: readonly ExerciseKind[] };

/** One presentation of an item. Its `id` is the item's id. */
interface ExerciseBase extends Content {
  readonly kind: ExerciseKind;
}

export interface MultipleChoiceExercise extends ExerciseBase {
  readonly kind: 'multiple-choice';
  readonly options: readonly string[];
  readonly answer: string;
}

export interface TypeInExercise extends ExerciseBase {
  readonly kind: 'type-in';
  readonly answer: string;
  /** Other words accepted as correct. */
  readonly alternatives?: readonly string[];
}

export type Exercise = MultipleChoiceExercise | TypeInExercise;

/** One pool of items and the task types it is practised with. */
export interface DeckSource {
  readonly dataKind: DataKind;
  /** Every task type listed here must accept `dataKind`; `loadDeck` checks it. */
  readonly tasks: readonly ExerciseKind[];
  /** Loaded lazily so a large pool never blocks first paint. */
  load(): Promise<readonly DataItem[]>;
}

/** A topic the learner can practise: one or more pools, each with its task types. */
export interface Deck {
  readonly id: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
  /** Emoji shown in the deck list. */
  readonly icon: string;
  /** Label for the tag dimension this deck groups by, e.g. "Preposisjon". */
  readonly tagLabel: string;
  readonly sources: readonly DeckSource[];
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
