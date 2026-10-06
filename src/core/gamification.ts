/**
 * XP, levels, daily streak and badges.
 *
 * Pure functions over a {@link Progress} snapshot so the rules can be tested
 * and tuned without touching storage or UI.
 */

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
  /** Answers given on `lastActiveDay`. */
  readonly answersToday: number;
  readonly dailyGoal: number;
  readonly goalDaysReached: number;
  /**
   * Local date the goal bonus was last paid, so raising the goal after
   * reaching it cannot pay the bonus a second time that day.
   */
  readonly goalReachedDay: string | null;
  readonly unlockedBadges: readonly string[];
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
};

const BASE_XP_CORRECT = 10;

/** A streak of right answers adds a little, but never outweighs answering at all. */
const XP_PER_COMBO_STEP = 1;
const MAX_COMBO_BONUS = 5;
export const XP_GOAL_BONUS = 50;

/**
 * XP needed to reach level n is LEVEL_SPAN * (n - 1)^2. A typical session
 * (20 answers, ~85 % right) earns ~270 XP, so with one session a day:
 * level 2 after the first session, 4 after a week, 5 after two weeks,
 * 10 after about two months.
 */
const LEVEL_SPAN = 200;

export interface LevelInfo {
  readonly level: number;
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number;
  /** 0..1 progress towards the next level. */
  readonly ratio: number;
}

export function xpForLevel(level: number): number {
  return LEVEL_SPAN * (level - 1) ** 2;
}

export function levelInfo(xp: number): LevelInfo {
  const safeXp = Math.max(xp, 0);
  const level = Math.floor(Math.sqrt(safeXp / LEVEL_SPAN)) + 1;

  const start = xpForLevel(level);
  const span = xpForLevel(level + 1) - start;

  return {
    level,
    xpIntoLevel: safeXp - start,
    xpForNextLevel: span,
    ratio: span === 0 ? 0 : (safeXp - start) / span,
  };
}

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

export function recordAnswer(progress: Progress, correct: boolean, now: number): AnswerOutcome {
  const today = dayKey(now);
  const sameDay = progress.lastActiveDay === today;

  const answersToday = (sameDay ? progress.answersToday : 0) + 1;
  const combo = correct ? progress.combo + 1 : 0;

  const comboBonus = correct ? Math.min((combo - 1) * XP_PER_COMBO_STEP, MAX_COMBO_BONUS) : 0;
  const goalJustReached = answersToday >= progress.dailyGoal && progress.goalReachedDay !== today;

  const xpGained =
    (correct ? BASE_XP_CORRECT + comboBonus : 0) + (goalJustReached ? XP_GOAL_BONUS : 0);

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

  const { progress: withBadges, newBadges } = unlockBadges(progress, updated);

  return { progress: withBadges, xpGained, newBadges, goalJustReached };
}

export interface SessionOutcome {
  readonly progress: Progress;
  readonly newBadges: readonly string[];
  /** True when this session added a day to the streak (first completed session today). */
  readonly streakExtended: boolean;
}

/** Counts a finished session towards the daily streak. Quitting early never calls this. */
export function recordSessionCompleted(progress: Progress, now: number): SessionOutcome {
  const today = dayKey(now);
  const streakDays = nextStreak(progress, today);
  const streakExtended = progress.lastSessionDay !== today;

  const updated: Progress = {
    ...progress,
    lastSessionDay: today,
    streakDays,
    bestStreakDays: Math.max(progress.bestStreakDays, streakDays),
  };

  const { progress: withBadges, newBadges } = unlockBadges(progress, updated);

  return { progress: withBadges, newBadges, streakExtended };
}

function unlockBadges(before: Progress, after: Progress): { progress: Progress; newBadges: string[] } {
  const newBadges = badgesFor(after).filter((badge) => !before.unlockedBadges.includes(badge));

  if (newBadges.length === 0) {
    return { progress: after, newBadges };
  }

  return { progress: { ...after, unlockedBadges: [...before.unlockedBadges, ...newBadges] }, newBadges };
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

export interface Badge {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly earned: (progress: Progress) => boolean;
}

export const BADGES: readonly Badge[] = [
  {
    id: 'first-steps',
    title: 'Første steg',
    description: 'Svar riktig på din første oppgave.',
    icon: '🌱',
    earned: (progress) => progress.correctAnswers >= 1,
  },
  {
    id: 'fifty-answers',
    title: 'Femti svar',
    description: 'Svar på 50 oppgaver.',
    icon: '📚',
    earned: (progress) => progress.totalAnswers >= 50,
  },
  {
    id: 'five-hundred',
    title: 'Fem hundre svar',
    description: 'Svar på 500 oppgaver.',
    icon: '🏔️',
    earned: (progress) => progress.totalAnswers >= 500,
  },
  {
    id: 'combo-10',
    title: 'Ti på rad',
    description: 'Ti riktige svar etter hverandre.',
    icon: '🔥',
    earned: (progress) => progress.bestCombo >= 10,
  },
  {
    id: 'combo-25',
    title: 'Tjuefem på rad',
    description: 'Tjuefem riktige svar etter hverandre.',
    icon: '⚡',
    earned: (progress) => progress.bestCombo >= 25,
  },
  {
    id: 'streak-3',
    title: 'Tre dager',
    description: 'Øv tre dager på rad.',
    icon: '🌿',
    earned: (progress) => progress.bestStreakDays >= 3,
  },
  {
    id: 'streak-7',
    title: 'En uke',
    description: 'Øv sju dager på rad.',
    icon: '🗓️',
    earned: (progress) => progress.bestStreakDays >= 7,
  },
  {
    id: 'streak-30',
    title: 'En måned',
    description: 'Øv tretti dager på rad.',
    icon: '🏆',
    earned: (progress) => progress.bestStreakDays >= 30,
  },
  {
    id: 'goal-5',
    title: 'Fem dagsmål',
    description: 'Nå dagsmålet fem ganger.',
    icon: '🎯',
    earned: (progress) => progress.goalDaysReached >= 5,
  },
  {
    id: 'level-5',
    title: 'Nivå 5',
    description: 'Nå nivå 5.',
    icon: '⭐',
    earned: (progress) => levelInfo(progress.xp).level >= 5,
  },
  {
    id: 'level-10',
    title: 'Nivå 10',
    description: 'Nå nivå 10.',
    icon: '🌟',
    earned: (progress) => levelInfo(progress.xp).level >= 10,
  },
  {
    id: 'sharpshooter',
    title: 'Skarpskytter',
    description: '90 % riktige av minst 100 svar.',
    icon: '🎖️',
    earned: (progress) => progress.totalAnswers >= 100 && accuracy(progress) >= 0.9,
  },
];

export function badgesFor(progress: Progress): string[] {
  return BADGES.filter((badge) => badge.earned(progress)).map((badge) => badge.id);
}

export function badgeById(id: string): Badge | undefined {
  return BADGES.find((badge) => badge.id === id);
}
