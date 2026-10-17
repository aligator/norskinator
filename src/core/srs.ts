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
  /** How the last answer was rated; `again` is what wilts the plant. */
  readonly lastGrade: Grade | null;
}

/**
 * The library's defaults as FSRS intends them: 90 % retention, learning steps
 * of 1 and 10 minutes, relearning after a lapse in 10, short-term memory
 * modelled. Only fuzz is off, so scheduling stays deterministic.
 */
const scheduler = fsrs(generatorParameters({ enable_fuzz: false }));

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
    lastGrade: null,
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

export function review(card: CardState, grade: Grade, now: number): CardState {
  // A clock set back must not put the review before the last one: the scheduler rejects a negative span.
  const reviewedAt = Math.max(now, card.lastReviewed ?? now);
  const next = scheduler.next(toFsrsCard(card), new Date(reviewedAt), RATINGS[grade]).card;

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
    lastReviewed: reviewedAt,
    lastGrade: grade,
  };
}

/** A right answer the learner can choose, and how long until the card comes back. */
export interface RatingOption {
  readonly grade: Exclude<Grade, 'again'>;
  readonly delayMs: number;
}

/** The ratings offered for a right answer, each with the delay it would give. */
export function ratingOptions(card: CardState, now: number): RatingOption[] {
  const grades = ['hard', 'good', 'easy'] as const;

  return grades.map((grade) => ({ grade, delayMs: review(card, grade, now).due - now }));
}

export function isDue(card: CardState, now: number): boolean {
  return card.due <= now;
}

export function dueCards(cards: readonly CardState[], now: number): CardState[] {
  return cards.filter((card) => isDue(card, now)).sort((left, right) => left.due - right.due);
}
