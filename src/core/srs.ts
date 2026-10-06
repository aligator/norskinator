/**
 * Spaced repetition — a trimmed SM-2.
 *
 * Deliberately pure and deck-agnostic: every function takes the current card
 * state plus a timestamp and returns a new state. No storage, no globals, so
 * the scheduling rules stay unit-testable.
 */

export const DAY_MS = 86_400_000;

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export type CardPhase = 'new' | 'learning' | 'review';

export interface CardState {
  readonly exerciseId: string;
  readonly deckId: string;
  readonly phase: CardPhase;
  readonly ease: number;
  /** Current interval in days; 0 while the card is still being learned. */
  readonly intervalDays: number;
  /** Epoch ms when the card becomes due. */
  readonly due: number;
  readonly reps: number;
  /** Times a graduated card was forgotten (Anki semantics). */
  readonly lapses: number;
  /** Every wrong answer, including those before graduation; drives accuracy stats. */
  readonly failures: number;
  readonly lastReviewed: number | null;
}

export const MIN_EASE = 1.3;
export const MAX_EASE = 2.8;
export const START_EASE = 2.5;
const MAX_INTERVAL_DAYS = 365;

/** Re-ask a failed card after this long — short enough to stay in the session. */
const RELEARN_DELAY_MS = 60_000;

const EASE_DELTA: Readonly<Record<Grade, number>> = {
  again: -0.2,
  hard: -0.15,
  good: 0,
  easy: 0.15,
};

const INTERVAL_FACTOR: Readonly<Record<'good' | 'easy', number>> = {
  good: 1,
  easy: 1.3,
};

/** Anki's hard multiplier: grows the interval a little instead of shrinking it. */
const HARD_INTERVAL_FACTOR = 1.2;

/** First interval in days for a card graduating out of the learning phase. */
const FIRST_INTERVAL_DAYS: Readonly<Record<Exclude<Grade, 'again'>, number>> = {
  hard: 1,
  good: 1,
  easy: 3,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createCard(exerciseId: string, deckId: string, now: number): CardState {
  return {
    exerciseId,
    deckId,
    phase: 'new',
    ease: START_EASE,
    intervalDays: 0,
    due: now,
    reps: 0,
    lapses: 0,
    failures: 0,
    lastReviewed: null,
  };
}

function nextInterval(card: CardState, grade: Exclude<Grade, 'again'>, ease: number): number {
  const graduated = card.phase === 'review' && card.intervalDays > 0;

  if (!graduated) {
    return FIRST_INTERVAL_DAYS[grade];
  }

  const grown =
    grade === 'hard'
      ? Math.max(card.intervalDays + 1, Math.round(card.intervalDays * HARD_INTERVAL_FACTOR))
      : Math.round(card.intervalDays * ease * INTERVAL_FACTOR[grade]);

  return clamp(grown, 1, MAX_INTERVAL_DAYS);
}

export function review(card: CardState, requested: Grade, now: number): CardState {
  // A card failed moments ago is answered from short-term memory, so a quick
  // right answer must not earn the long `easy` head start.
  const grade = card.phase === 'learning' && requested === 'easy' ? 'good' : requested;
  const ease = clamp(card.ease + EASE_DELTA[grade], MIN_EASE, MAX_EASE);

  if (grade === 'again') {
    return {
      ...card,
      phase: 'learning',
      ease,
      intervalDays: 0,
      due: now + RELEARN_DELAY_MS,
      reps: card.reps + 1,
      lapses: card.lapses + (card.phase === 'review' ? 1 : 0),
      failures: card.failures + 1,
      lastReviewed: now,
    };
  }

  const intervalDays = nextInterval(card, grade, ease);

  return {
    ...card,
    phase: 'review',
    ease,
    intervalDays,
    due: now + intervalDays * DAY_MS,
    reps: card.reps + 1,
    lastReviewed: now,
  };
}

export function isDue(card: CardState, now: number): boolean {
  return card.due <= now;
}

/**
 * Beyond this the learner most likely switched tabs or walked away, so the
 * time says nothing about difficulty and must not force `hard`. A negative
 * span (clock moved backwards) is just as meaningless; both grade as `good`.
 */
const UNMEASURED_AFTER_MS = 60_000;

/**
 * Multiple choice gives no self-assessment, so response time stands in for it:
 * fast and right means easy, slow and right keeps the interval short.
 */
export function gradeFromAnswer(correct: boolean, elapsedMs: number): Grade {
  if (!correct) {
    return 'again';
  }

  if (elapsedMs < 0 || elapsedMs > UNMEASURED_AFTER_MS) {
    return 'good';
  }

  if (elapsedMs <= 4000) {
    return 'easy';
  }

  if (elapsedMs >= 15_000) {
    return 'hard';
  }

  return 'good';
}

export function dueCards(cards: readonly CardState[], now: number): CardState[] {
  return cards.filter((card) => isDue(card, now)).sort((left, right) => left.due - right.due);
}
