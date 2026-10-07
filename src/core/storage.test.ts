import { describe, expect, it } from 'vitest';

import { DAILY_GOAL_BOUNDS, INITIAL_PROGRESS } from './gamification.ts';
import { DEFAULT_TASK_WEIGHTS } from './task-weights.ts';
import {
  DEFAULT_SETTINGS,
  INITIAL_STATE,
  parseSession,
  parseState,
  runMigrations,
  type PersistedSession,
} from './storage.ts';

describe('parseState', () => {
  it('falls back to defaults for missing, unparsable or non-object data', () => {
    expect(parseState(null)).toEqual(INITIAL_STATE);
    expect(parseState('{not json')).toEqual(INITIAL_STATE);
    expect(parseState('"a string"')).toEqual(INITIAL_STATE);
  });

  it('keeps valid values and repairs invalid ones', () => {
    const raw = JSON.stringify({
      progress: { ...INITIAL_PROGRESS, xp: 420, streakDays: -3, dailyGoal: 0, unlockedBadges: ['x', 7] },
      settings: { translationLanguage: 'klingon', theme: 'dark', newPerSession: 999 },
      cards: {},
    });

    const state = parseState(raw);

    expect(state.progress.xp).toBe(420);
    expect(state.progress.streakDays).toBe(0);
    expect(state.progress.dailyGoal).toBe(DAILY_GOAL_BOUNDS.min);
    expect(state.progress.unlockedBadges).toEqual(['x']);
    expect(state.settings.translationLanguage).toBe(DEFAULT_SETTINGS.translationLanguage);
    expect(state.settings.theme).toBe('dark');
    expect(state.settings.newPerSession).toBe(50);
  });

  it('drops cards that are not usable and keeps the rest', () => {
    const raw = JSON.stringify({
      cards: {
        good: { deckId: 'deck', phase: 'review', ease: 2.1, intervalDays: 4, due: 123, reps: 3 },
        broken: { phase: 'review' },
        alsoBroken: 42,
      },
    });

    const state = parseState(raw);

    expect(Object.keys(state.cards)).toEqual(['good']);
    expect(state.cards['good']?.exerciseId).toBe('good');
    expect(state.cards['good']?.intervalDays).toBe(4);
  });

  it('floors counters and never reports more correct than total answers', () => {
    const raw = JSON.stringify({
      progress: { ...INITIAL_PROGRESS, totalAnswers: 10.7, correctAnswers: 99, combo: 2.5 },
    });

    const progress = parseState(raw).progress;

    expect(progress.totalAnswers).toBe(10);
    expect(progress.correctAnswers).toBe(10);
    expect(progress.combo).toBe(2);
  });

  it('treats a day already at its goal in old data as paid', () => {
    const raw = JSON.stringify({
      progress: { ...INITIAL_PROGRESS, goalReachedDay: undefined, lastActiveDay: '2026-01-15', answersToday: 30 },
    });

    expect(parseState(raw).progress.goalReachedDay).toBe('2026-01-15');
  });

  it('clamps the ease factor into the SM-2 range', () => {
    const raw = JSON.stringify({
      cards: { low: { deckId: 'deck', ease: 0.2 }, high: { deckId: 'deck', ease: 9 } },
    });

    const cards = parseState(raw).cards;

    expect(cards['low']?.ease).toBe(1.3);
    expect(cards['high']?.ease).toBe(2.8);
  });

  it('ignores card ids that would reach the prototype chain', () => {
    const raw = '{"cards":{"__proto__":{"deckId":"deck","polluted":true},"constructor":{"deckId":"deck"}}}';

    const cards = parseState(raw).cards;

    expect(Object.keys(cards)).toEqual([]);
    expect(Object.getPrototypeOf(cards)).toBe(Object.prototype);
  });

  it('loads settings stored before the sound options existed with sound off', () => {
    const raw = JSON.stringify({ settings: { translationLanguage: 'en', theme: 'light', newPerSession: 5 } });

    const settings = parseState(raw).settings;

    expect(settings.soundEffects).toBe(false);
    expect(settings.speakSolution).toBe(false);
    expect(settings.translationLanguage).toBe('en');
  });

  it('turns non-boolean sound options off instead of coercing them', () => {
    const raw = JSON.stringify({ settings: { soundEffects: 'yes', speakSolution: 1 } });

    const settings = parseState(raw).settings;

    expect(settings.soundEffects).toBe(false);
    expect(settings.speakSolution).toBe(false);
  });

  it('keeps sound options that were switched on', () => {
    const raw = JSON.stringify({ settings: { soundEffects: true, speakSolution: true } });

    const settings = parseState(raw).settings;

    expect(settings.soundEffects).toBe(true);
    expect(settings.speakSolution).toBe(true);
  });

  it('rejects an unknown phase instead of trusting it', () => {
    const raw = JSON.stringify({ cards: { a: { deckId: 'deck', phase: 'nonsense' } } });

    expect(parseState(raw).cards['a']?.phase).toBe('new');
  });

  it('keeps a stored null session day instead of treating it as legacy data', () => {
    const progress = { ...INITIAL_PROGRESS, lastActiveDay: '2026-01-15', lastSessionDay: null };

    const restored = parseState(JSON.stringify({ ...INITIAL_STATE, progress })).progress;

    expect(restored.lastSessionDay).toBeNull();
  });

  it('loads settings stored before task types existed with the default mix', () => {
    const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    delete settings['taskWeights'];

    expect(parseState(JSON.stringify({ settings })).settings.taskWeights).toEqual(DEFAULT_TASK_WEIGHTS);
  });

  it('rescales stored task weights that do not add up to 100', () => {
    const settings = { ...DEFAULT_SETTINGS, taskWeights: { 'multiple-choice': 1, 'type-in': 3, unknown: 9 } };

    expect(parseState(JSON.stringify({ settings })).settings.taskWeights).toEqual({
      'multiple-choice': 25,
      'type-in': 75,
    });
  });

  it('derives the session day from the active day when the key is missing', () => {
    const progress: Record<string, unknown> = { ...INITIAL_PROGRESS, lastActiveDay: '2026-01-15' };
    delete progress['lastSessionDay'];

    expect(parseState(JSON.stringify({ progress })).progress.lastSessionDay).toBe('2026-01-15');
  });
});

const SESSION: PersistedSession = {
  queue: ['a', 'b', 'a'],
  kinds: ['multiple-choice', 'type-in', 'type-in'],
  index: 1,
  options: ['i', 'på'],
  answered: 2,
  correct: 1,
  xpEarned: 15,
  bestCombo: 1,
  badgesEarned: ['first-steps'],
  requeuedIds: ['a'],
  completed: false,
  streakExtended: false,
  startedAt: 1_000,
  deckIds: ['deck'],
  feedback: {
    exerciseId: 'b',
    given: 'på',
    correct: false,
    grade: 'again',
    xpGained: 0,
    newBadges: [],
    goalJustReached: false,
    levelBefore: 1,
    levelAfter: 1,
  },
};

describe('parseSession', () => {
  it('round-trips a stored session', () => {
    expect(parseSession(JSON.stringify(SESSION))).toEqual(SESSION);
  });

  it('reads a session saved before task types existed as multiple choice', () => {
    const legacy: Record<string, unknown> = { ...SESSION };
    delete legacy['kinds'];

    expect(parseSession(JSON.stringify(legacy))?.kinds).toEqual(['multiple-choice', 'multiple-choice', 'multiple-choice']);
  });

  it('returns null for missing, unparsable or non-object data', () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession('{not json')).toBeNull();
    expect(parseSession('42')).toBeNull();
  });

  it('rejects a damaged queue, an index outside it or a missing start time', () => {
    expect(parseSession(JSON.stringify({ ...SESSION, queue: ['a', 7] }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...SESSION, index: 4 }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...SESSION, index: 0.5 }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...SESSION, startedAt: 'yesterday' }))).toBeNull();
  });

  it('drops feedback with an unknown grade but keeps the session', () => {
    const raw = JSON.stringify({ ...SESSION, feedback: { ...SESSION.feedback, grade: 'perfect' } });

    const session = parseSession(raw);

    expect(session?.feedback).toBeNull();
    expect(session?.queue).toEqual(SESSION.queue);
  });

  it('repairs counters instead of trusting them', () => {
    const raw = JSON.stringify({ ...SESSION, answered: -2, correct: 9, requeuedIds: 'a' });

    const session = parseSession(raw);

    expect(session?.answered).toBe(0);
    expect(session?.correct).toBe(0);
    expect(session?.requeuedIds).toEqual([]);
  });
});

describe('runMigrations', () => {
  const steps = {
    1: (raw: Record<string, unknown>) => ({ ...raw, renamed: raw['old'], old: undefined }),
    2: (raw: Record<string, unknown>) => ({ ...raw, added: 'v3' }),
  };

  it('applies every step from the stored version up to the target, in order', () => {
    expect(runMigrations({ old: 'x' }, 1, 3, steps)).toEqual({ renamed: 'x', old: undefined, added: 'v3' });
  });

  it('skips steps the data has already passed', () => {
    expect(runMigrations({ renamed: 'x' }, 2, 3, steps)).toEqual({ renamed: 'x', added: 'v3' });
  });

  it('leaves data from a newer version untouched', () => {
    const newer = { future: true };

    expect(runMigrations(newer, 5, 3, steps)).toBe(newer);
  });
});
