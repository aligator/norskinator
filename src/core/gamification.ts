/**
 * XP, daily streak and goal. XP only ever grows: it rewards practice, while
 * what the learner knows shows in the garden (`garden.ts`). Badges are ruled
 * in `badges.ts`.
 *
 * Pure functions over a {@link Progress} snapshot so the rules can be tested
 * and tuned without touching storage or UI.
 */

import { unlockBadges, type BadgeWorld } from './badges.ts';
import type { SessionMode } from './session.ts';
import { INITIAL_GARDEN } from './species.ts';

/** For callers that only track progress, e.g. tests: no plants, no purchases. */
const NO_WORLD: BadgeWorld = { cards: {}, garden: INITIAL_GARDEN };

export interface Progress {
  readonly xp: number;
  /** Consecutive correct answers in the current run. */
  readonly combo: number;
  readonly bestCombo: number;
  readonly totalAnswers: number;
  readonly correctAnswers: number;
  /** Local date `YYYY-MM-DD` of the last answered exercise. */
  readonly lastActiveDay: string | null;
  /**
   * Local date of the last *completed* session. The streak hangs on this, not
   * on single answers: one tap a day must not keep a streak alive.
   */
  readonly lastSessionDay: string | null;
  readonly streakDays: number;
  readonly bestStreakDays: number;
  /**
   * Correct answers given on `lastActiveDay`; they alone count towards the
   * daily goal. The name predates that rule and is kept for stored data.
   */
  readonly answersToday: number;
  readonly dailyGoal: number;
  readonly goalDaysReached: number;
  /**
   * Local date the goal bonus was last paid, so raising the goal after
   * reaching it cannot pay the bonus a second time that day.
   */
  readonly goalReachedDay: string | null;
  readonly unlockedBadges: readonly string[];
  /** Local date `newToday` and `reviewsToday` count; older days start from zero. */
  readonly limitsDay: string | null;
  /** New items introduced on `limitsDay`; see `daily.ts`. */
  readonly newToday: number;
  /** Graduated cards reviewed on `limitsDay`. */
  readonly reviewsToday: number;
}

export const DEFAULT_DAILY_GOAL = 20;

/** Bounds for the learner-configurable daily goal, shared by storage and store. */
export const DAILY_GOAL_BOUNDS = { min: 5, max: 200 } as const;

export function clampDailyGoal(goal: number): number {
  if (!Number.isFinite(goal)) {
    return DEFAULT_DAILY_GOAL;
  }

  return Math.min(DAILY_GOAL_BOUNDS.max, Math.max(DAILY_GOAL_BOUNDS.min, Math.round(goal)));
}

export const INITIAL_PROGRESS: Progress = {
  xp: 0,
  combo: 0,
  bestCombo: 0,
  totalAnswers: 0,
  correctAnswers: 0,
  lastActiveDay: null,
  lastSessionDay: null,
  streakDays: 0,
  bestStreakDays: 0,
  answersToday: 0,
  dailyGoal: DEFAULT_DAILY_GOAL,
  goalDaysReached: 0,
  goalReachedDay: null,
  unlockedBadges: [],
  limitsDay: null,
  newToday: 0,
  reviewsToday: 0,
};

export const BASE_XP_CORRECT = 10;

/** A streak of right answers adds a little, but never outweighs answering at all. */
const XP_PER_COMBO_STEP = 1;
const MAX_COMBO_BONUS = 5;
export const XP_GOAL_BONUS = 50;

/** A practice session repeats known items at will, so an answer pays a token amount and no combo bonus. */
export const PRACTICE_XP_CORRECT = 1;

/** Local calendar day, not UTC: the streak follows the learner's own clock. */
export function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

function dayDistance(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00`);
  const end = Date.parse(`${to}T00:00:00`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.round((end - start) / 86_400_000);
}

export interface AnswerOutcome {
  readonly progress: Progress;
  readonly xpGained: number;
  readonly newBadges: readonly string[];
  readonly goalJustReached: boolean;
}

function nextStreak(progress: Progress, today: string): number {
  if (progress.lastSessionDay === null) {
    return 1;
  }

  if (progress.lastSessionDay === today) {
    return progress.streakDays;
  }

  const distance = dayDistance(progress.lastSessionDay, today);

  // A clock set back (travel, manual change) must not cost the streak.
  if (distance <= 0) {
    return Math.max(progress.streakDays, 1);
  }

  if (distance === 1) {
    return progress.streakDays + 1;
  }

  return 1;
}

/**
 * `world` is the state after this answer, for badges about the garden and the
 * shop. A practice answer counts towards the daily goal like any other, but
 * pays only {@link PRACTICE_XP_CORRECT} itself.
 */
export function recordAnswer(
  progress: Progress,
  correct: boolean,
  now: number,
  world: BadgeWorld = NO_WORLD,
  mode: SessionMode = 'review',
): AnswerOutcome {
  const today = dayKey(now);
  const sameDay = progress.lastActiveDay === today;

  const answersToday = (sameDay ? progress.answersToday : 0) + (correct ? 1 : 0);
  const combo = correct ? progress.combo + 1 : 0;

  const comboBonus = correct ? Math.min((combo - 1) * XP_PER_COMBO_STEP, MAX_COMBO_BONUS) : 0;
  const answerXp = mode === 'practice' ? PRACTICE_XP_CORRECT : BASE_XP_CORRECT + comboBonus;
  const goalJustReached = correct && answersToday >= progress.dailyGoal && progress.goalReachedDay !== today;

  const xpGained = (correct ? answerXp : 0) + (goalJustReached ? XP_GOAL_BONUS : 0);

  const updated: Progress = {
    ...progress,
    xp: progress.xp + xpGained,
    combo,
    bestCombo: Math.max(progress.bestCombo, combo),
    totalAnswers: progress.totalAnswers + 1,
    correctAnswers: progress.correctAnswers + (correct ? 1 : 0),
    lastActiveDay: today,
    answersToday,
    goalDaysReached: progress.goalDaysReached + (goalJustReached ? 1 : 0),
    goalReachedDay: goalJustReached ? today : progress.goalReachedDay,
  };

  const { progress: withBadges, newBadges } = unlockBadges({ ...world, progress: updated });

  return { progress: withBadges, xpGained, newBadges, goalJustReached };
}

export interface SessionOutcome {
  readonly progress: Progress;
  readonly newBadges: readonly string[];
  /** True when this session added a day to the streak (first completed session today). */
  readonly streakExtended: boolean;
}

/** Counts a finished session towards the daily streak. Quitting early never calls this. */
export function recordSessionCompleted(progress: Progress, now: number, world: BadgeWorld = NO_WORLD): SessionOutcome {
  const today = dayKey(now);
  const streakDays = nextStreak(progress, today);
  const streakExtended = progress.lastSessionDay !== today;

  const updated: Progress = {
    ...progress,
    lastSessionDay: today,
    streakDays,
    bestStreakDays: Math.max(progress.bestStreakDays, streakDays),
  };

  const { progress: withBadges, newBadges } = unlockBadges({ ...world, progress: updated });

  return { progress: withBadges, newBadges, streakExtended };
}

/**
 * A streak survives one idle day (today counts as unbroken until midnight) but
 * reads as zero once a whole day was skipped, so the UI can show the loss
 * before the next completed session silently resets it.
 */
export function currentStreak(progress: Progress, now: number): number {
  if (progress.lastSessionDay === null) {
    return 0;
  }

  const distance = dayDistance(progress.lastSessionDay, dayKey(now));

  return distance <= 1 ? progress.streakDays : 0;
}

export function sessionCompletedToday(progress: Progress, now: number): boolean {
  return progress.lastSessionDay === dayKey(now);
}

/** A streak existed but a whole day was missed; shown muted rather than hidden. */
export function streakBroken(progress: Progress, now: number): boolean {
  return currentStreak(progress, now) === 0 && progress.bestStreakDays > 0;
}

export function answersToday(progress: Progress, now: number): number {
  if (progress.lastActiveDay !== dayKey(now)) {
    return 0;
  }

  return progress.answersToday;
}

export function accuracy(progress: Progress): number {
  if (progress.totalAnswers === 0) {
    return 0;
  }

  return progress.correctAnswers / progress.totalAnswers;
}
