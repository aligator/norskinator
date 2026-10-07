import { describe, expect, it } from 'vitest';

import {
  INITIAL_PROGRESS,
  currentStreak,
  dayKey,
  levelInfo,
  recordAnswer,
  recordSessionCompleted,
  sessionCompletedToday,
  xpForLevel,
  type Progress,
} from './gamification.ts';

/** Local noon, so a timezone shift cannot move these timestamps to another day. */
function localNoon(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 12, 0, 0).getTime();
}

const DAY_ONE = localNoon(2026, 1, 15);
const DAY_TWO = localNoon(2026, 1, 16);
const DAY_FOUR = localNoon(2026, 1, 18);

function withProgress(patch: Partial<Progress>): Progress {
  return { ...INITIAL_PROGRESS, ...patch };
}

describe('recordAnswer', () => {
  it('awards base XP for a correct answer and nothing for a wrong one', () => {
    expect(recordAnswer(INITIAL_PROGRESS, true, DAY_ONE).xpGained).toBe(10);
    expect(recordAnswer(INITIAL_PROGRESS, false, DAY_ONE).xpGained).toBe(0);
  });

  it('pays a growing combo bonus that stops at the cap', () => {
    const atCombo = (combo: number): number =>
      recordAnswer(withProgress({ combo }), true, DAY_ONE).xpGained;

    expect(atCombo(0)).toBe(10);
    expect(atCombo(1)).toBe(11);
    expect(atCombo(5)).toBe(15);
    expect(atCombo(100)).toBe(15);
  });

  it('resets the combo on a wrong answer but keeps the best', () => {
    const outcome = recordAnswer(withProgress({ combo: 7, bestCombo: 7 }), false, DAY_ONE);

    expect(outcome.progress.combo).toBe(0);
    expect(outcome.progress.bestCombo).toBe(7);
  });

  it('never moves the streak on its own — only a completed session does', () => {
    const answered = recordAnswer(INITIAL_PROGRESS, true, DAY_ONE).progress;

    expect(answered.streakDays).toBe(0);
    expect(answered.lastSessionDay).toBeNull();
    expect(answered.answersToday).toBe(1);
  });

  it('pays the goal bonus exactly once, on the answer that reaches it', () => {
    const almost = withProgress({ dailyGoal: 3, answersToday: 2, lastActiveDay: dayKey(DAY_ONE) });

    const reaching = recordAnswer(almost, true, DAY_ONE);
    const beyond = recordAnswer(reaching.progress, true, DAY_ONE);

    expect(reaching.goalJustReached).toBe(true);
    expect(reaching.xpGained).toBe(10 + 50);
    expect(beyond.goalJustReached).toBe(false);
    expect(beyond.progress.goalDaysReached).toBe(1);
  });

  it('does not pay the goal bonus again after the goal is raised the same day', () => {
    const almost = withProgress({ dailyGoal: 3, answersToday: 2, lastActiveDay: dayKey(DAY_ONE) });
    const reached = recordAnswer(almost, true, DAY_ONE).progress;

    const raised = { ...reached, dailyGoal: 4 };
    const afterRaise = recordAnswer(raised, true, DAY_ONE);

    expect(afterRaise.goalJustReached).toBe(false);
    expect(afterRaise.progress.goalDaysReached).toBe(1);
  });

  it('pays the goal bonus again on the next day', () => {
    const reachedYesterday = withProgress({
      dailyGoal: 1,
      answersToday: 1,
      lastActiveDay: dayKey(DAY_ONE),
      goalReachedDay: dayKey(DAY_ONE),
      goalDaysReached: 1,
    });

    const today = recordAnswer(reachedYesterday, true, DAY_TWO);

    expect(today.goalJustReached).toBe(true);
    expect(today.progress.goalDaysReached).toBe(2);
  });

  it('resets the daily counter on a new day', () => {
    const yesterday = withProgress({ answersToday: 12, lastActiveDay: dayKey(DAY_ONE) });

    expect(recordAnswer(yesterday, true, DAY_TWO).progress.answersToday).toBe(1);
  });

  it('reports a badge only the first time it is earned', () => {
    const first = recordAnswer(INITIAL_PROGRESS, true, DAY_ONE);
    const second = recordAnswer(first.progress, true, DAY_ONE);

    expect(first.newBadges).toContain('first-steps');
    expect(second.newBadges).not.toContain('first-steps');
    expect(second.progress.unlockedBadges).toContain('first-steps');
  });

  it('awards the first-steps badge for the first correct answer, not the first answer', () => {
    const wrong = recordAnswer(INITIAL_PROGRESS, false, DAY_ONE);
    const right = recordAnswer(wrong.progress, true, DAY_ONE);

    expect(wrong.newBadges).not.toContain('first-steps');
    expect(right.newBadges).toContain('first-steps');
  });
});

describe('recordSessionCompleted', () => {
  it('extends the streak on consecutive days and restarts after a gap', () => {
    const first = recordSessionCompleted(INITIAL_PROGRESS, DAY_ONE).progress;
    const second = recordSessionCompleted(first, DAY_TWO).progress;
    const afterGap = recordSessionCompleted(second, DAY_FOUR).progress;

    expect(first.streakDays).toBe(1);
    expect(second.streakDays).toBe(2);
    expect(afterGap.streakDays).toBe(1);
    expect(afterGap.bestStreakDays).toBe(2);
  });

  it('counts a second session on the same day as the same streak day', () => {
    const first = recordSessionCompleted(INITIAL_PROGRESS, DAY_ONE);
    const second = recordSessionCompleted(first.progress, DAY_ONE + 3_600_000);

    expect(first.streakExtended).toBe(true);
    expect(second.streakExtended).toBe(false);
    expect(second.progress.streakDays).toBe(1);
    expect(sessionCompletedToday(second.progress, DAY_ONE)).toBe(true);
  });

  it('keeps the streak when the clock is set back a day', () => {
    const progress = withProgress({ lastSessionDay: dayKey(DAY_TWO), streakDays: 5 });

    expect(recordSessionCompleted(progress, DAY_ONE).progress.streakDays).toBe(5);
  });

  it('unlocks streak badges when the session reaches them', () => {
    const progress = withProgress({ lastSessionDay: dayKey(DAY_ONE), streakDays: 2, bestStreakDays: 2 });

    expect(recordSessionCompleted(progress, DAY_TWO).newBadges).toContain('streak-3');
  });
});

describe('levelInfo', () => {
  it('takes two good sessions to reach level 2, and many more for level 3', () => {
    let progress = withProgress({ dailyGoal: 1000 });

    // 20 answers, 17 right: two short slips break the combo.
    const playSession = (): void => {
      for (let answer = 0; answer < 20; answer += 1) {
        const correct = answer !== 6 && answer !== 13 && answer !== 19;

        progress = recordAnswer(progress, correct, DAY_ONE).progress;
      }
    };

    playSession();

    expect(levelInfo(progress.xp).level).toBe(1);

    playSession();

    expect(levelInfo(progress.xp).level).toBe(2);
    expect(progress.xp).toBeLessThan(xpForLevel(3));
  });

  it('starts at level 1 and matches the level thresholds', () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(xpForLevel(5)).level).toBe(5);
    expect(levelInfo(xpForLevel(5) - 1).level).toBe(4);
  });

  it('reports progress within the current level as a 0..1 ratio', () => {
    const halfway = (xpForLevel(3) + xpForLevel(4)) / 2;
    const info = levelInfo(halfway);

    expect(info.level).toBe(3);
    expect(info.ratio).toBeGreaterThan(0.4);
    expect(info.ratio).toBeLessThan(0.6);
  });
});

describe('currentStreak', () => {
  it('keeps the streak alive today and the day after, then shows it as broken', () => {
    const progress = withProgress({ lastSessionDay: dayKey(DAY_ONE), streakDays: 4 });

    expect(currentStreak(progress, DAY_ONE)).toBe(4);
    expect(currentStreak(progress, DAY_TWO)).toBe(4);
    expect(currentStreak(progress, DAY_FOUR)).toBe(0);
  });
});
