/**
 * Spaced repetition — FSRS through `ts-fsrs`.
 *
 * Deliberately pure and deck-agnostic: every function takes the current card
 * state plus a timestamp and returns a new state. No storage, no globals, no
 * fuzz, so the scheduling rules stay unit-testable. The memory model itself
 * lives in the library; this file only maps our card to its card and back.
 */
import { Rating, State, fsrs, generatorParameters, type Card } from 'ts-fsrs';

export const DAY_MS = 86_400_000;

export type Grade = 'again' | 'hard' | 'good' | 'easy';

/** `learning` and `relearning` are the phases of a card that was just failed or is still being learned. */
export type CardPhase = 'new' | 'learning' | 'review' | 'relearning';

export const CARD_PHASES: readonly CardPhase[] = ['new', 'learning', 'review', 'relearning'];

export interface CardState {
  readonly exerciseId: string;
  readonly deckId: string;
  readonly phase: CardPhase;
  /** Days until the chance of remembering drops to 90 %; 0 for a card never answered. */
  readonly stability: number;
  /** 1 (easy) to 10 (hard); 0 for a card never answered. */
  readonly difficulty: number;
  /** Position in the (re)learning steps while the card is not in review. */
  readonly learningStep: number;
  /** Epoch ms when the card becomes due. */
  readonly due: number;
  readonly reps: number;
  /** Times a graduated card was forgotten. */
  readonly lapses: number;
  /** Every wrong answer, including those before graduation; drives accuracy stats. */
  readonly failures: number;
  readonly lastReviewed: number | null;
}

export const MAX_INTERVAL_DAYS = 365;

/** A failed card is re-asked after a minute — short enough to stay in the session. */
const RELEARN_STEP = '1m';

const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: MAX_INTERVAL_DAYS,
    enable_fuzz: false,
    enable_short_term: true,
    learning_steps: [RELEARN_STEP],
    relearning_steps: [RELEARN_STEP],
  }),
);

const RATINGS = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const;

const PHASE_OF_STATE: Readonly<Record<State, CardPhase>> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const STATE_OF_PHASE: Readonly<Record<CardPhase, State>> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

export function createCard(exerciseId: string, deckId: string, now: number): CardState {
  return {
    exerciseId,
    deckId,
    phase: 'new',
    stability: 0,
    difficulty: 0,
    learningStep: 0,
    due: now,
    reps: 0,
    lapses: 0,
    failures: 0,
    lastReviewed: null,
  };
}

function toFsrsCard(card: CardState): Card {
  const scheduledDays =
    card.lastReviewed === null ? 0 : Math.max(0, Math.round((card.due - card.lastReviewed) / DAY_MS));

  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: 0,
    scheduled_days: scheduledDays,
    learning_steps: card.learningStep,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_OF_PHASE[card.phase],
    ...(card.lastReviewed === null ? {} : { last_review: new Date(card.lastReviewed) }),
  };
}

/**
 * A card that is still being learned only graduates on a right answer, so
 * `hard` is read as `good` there: a hard first answer must not keep the
 * plant wilted.
 */
function effectiveGrade(card: CardState, requested: Grade): Grade {
  return requested === 'hard' && card.phase !== 'review' ? 'good' : requested;
}

export function review(card: CardState, requested: Grade, now: number): CardState {
  const grade = effectiveGrade(card, requested);
  const next = scheduler.next(toFsrsCard(card), new Date(now), RATINGS[grade]).card;

  return {
    ...card,
    phase: PHASE_OF_STATE[next.state],
    stability: next.stability,
    difficulty: next.difficulty,
    learningStep: next.learning_steps,
    due: next.due.getTime(),
    reps: next.reps,
    lapses: next.lapses,
    failures: card.failures + (grade === 'again' ? 1 : 0),
    lastReviewed: now,
  };
}

/** A right answer the learner can choose, and how long until the card comes back. */
export interface RatingOption {
  readonly grade: Exclude<Grade, 'again'>;
  readonly delayMs: number;
}

/**
 * The ratings offered for a right answer, each with the delay it would give.
 * A card still being learned has no `hard`; see `effectiveGrade`.
 */
export function ratingOptions(card: CardState, now: number): RatingOption[] {
  const grades = card.phase === 'review' ? (['hard', 'good', 'easy'] as const) : (['good', 'easy'] as const);

  return grades.map((grade) => ({ grade, delayMs: review(card, grade, now).due - now }));
}

export function isDue(card: CardState, now: number): boolean {
  return card.due <= now;
}

export function dueCards(cards: readonly CardState[], now: number): CardState[] {
  return cards.filter((card) => isDue(card, now)).sort((left, right) => left.due - right.due);
}
