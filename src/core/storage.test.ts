import { describe, expect, it } from 'vitest';

import { DAILY_GOAL_BOUNDS, INITIAL_PROGRESS } from './gamification.ts';
import { DEFAULT_TASK_WEIGHTS } from './task-weights.ts';
import {
  DEFAULT_SETTINGS,
  INITIAL_STATE,
  STATE_VERSION,
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
      settings: { translationLanguage: 'klingon', theme: 'dark', newPerDay: 999 },
      cards: {},
    });

    const state = parseState(raw);

    expect(state.progress.xp).toBe(420);
    expect(state.progress.streakDays).toBe(0);
    expect(state.progress.dailyGoal).toBe(DAILY_GOAL_BOUNDS.min);
    expect(state.progress.unlockedBadges).toEqual(['x']);
    expect(state.settings.translationLanguage).toBe(DEFAULT_SETTINGS.translationLanguage);
    expect(state.settings.theme).toBe('dark');
    expect(state.settings.newPerDay).toBe(100);
  });

  it('reads the pace settings, with defaults for state saved before they existed', () => {
    const old = parseState(JSON.stringify({ settings: { newPerDay: 5 } }));
    const custom = parseState(
      JSON.stringify({ settings: { sessionSize: 999, newPerDay: 30, reviewsPerDay: 300 } }),
    );
    const broken = parseState(JSON.stringify({ settings: { sessionSize: 'x', reviewsPerDay: 1 } }));

    expect(old.settings.sessionSize).toBe(DEFAULT_SETTINGS.sessionSize);
    expect(old.settings.newPerDay).toBe(5);
    expect(old.settings.reviewsPerDay).toBe(DEFAULT_SETTINGS.reviewsPerDay);
    expect(custom.settings.sessionSize).toBe(50);
    expect(custom.settings.newPerDay).toBe(30);
    expect(custom.settings.reviewsPerDay).toBe(300);
    expect(broken.settings.sessionSize).toBe(DEFAULT_SETTINGS.sessionSize);
    expect(broken.settings.reviewsPerDay).toBe(10);
  });

  it('ignores the per-session settings and the young-plant gate of earlier builds', () => {
    const state = parseState(
      JSON.stringify({ settings: { newPerSession: 40, maxYoungPlants: 99, youngIntervalDays: 14 } }),
    );

    expect(state.settings.newPerDay).toBe(DEFAULT_SETTINGS.newPerDay);
    expect(state.settings).not.toHaveProperty('maxYoungPlants');
    expect(state.settings).not.toHaveProperty('newPerSession');
  });

  it('reads the daily counters, from zero when none are stored', () => {
    const stored = parseState(
      JSON.stringify({ progress: { limitsDay: '2026-01-15', newToday: 4.7, reviewsToday: 12 } }),
    ).progress;
    const old = parseState(JSON.stringify({ progress: {} })).progress;

    expect(stored).toMatchObject({ limitsDay: '2026-01-15', newToday: 4, reviewsToday: 12 });
    expect(old).toMatchObject({ limitsDay: null, newToday: 0, reviewsToday: 0 });
  });

  it('drops cards that are not usable and keeps the rest', () => {
    const raw = JSON.stringify({
      cards: {
        good: { deckId: 'deck', phase: 'review', stability: 4, difficulty: 5, due: 123, reps: 3 },
        broken: { phase: 'review' },
        alsoBroken: 42,
      },
    });

    const state = parseState(raw);

    expect(Object.keys(state.cards)).toEqual(['good']);
    expect(state.cards['good']?.exerciseId).toBe('good');
    expect(state.cards['good']?.stability).toBe(4);
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

  it('keeps difficulty in the FSRS range and stability positive', () => {
    const raw = JSON.stringify({
      cards: {
        low: { deckId: 'deck', difficulty: -3, stability: -1 },
        high: { deckId: 'deck', difficulty: 99 },
      },
    });

    const cards = parseState(raw).cards;

    expect(cards['low']?.difficulty).toBe(0);
    expect(cards['low']?.stability).toBe(0);
    expect(cards['high']?.difficulty).toBe(10);
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
      'word-order': 100,
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
  seedsSown: 1,
  plantsGrown: 2,
  plantsWilted: 1,
  gardenStart: { b: { stage: 'plant', wilted: false, growth: 0.25 } },
  startedAt: 1_000,
  deckIds: ['deck'],
  mode: 'practice',
  feedback: {
    exerciseId: 'b',
    given: 'på',
    correct: false,
    grade: 'again',
    xpGained: 0,
    newBadges: [],
    goalJustReached: false,
    plantBefore: { stage: 'plant', wilted: false, growth: 0.5 },
    plantAfter: { stage: 'sprout', wilted: true, growth: 0 },
    species: 'cactus',
    nextDue: 2_000,
    reps: 3,
    ratingOptions: null,
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

  it('reads a session saved before practice sessions existed as a review', () => {
    const legacy: Record<string, unknown> = { ...SESSION };
    delete legacy['mode'];

    expect(parseSession(JSON.stringify(legacy))?.mode).toBe('review');
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

describe('migration from version 1', () => {
  const V1_CARDS = {
    mature: {
      deckId: 'deck',
      phase: 'review',
      ease: 2.8,
      intervalDays: 40,
      due: 1_000,
      reps: 9,
      lapses: 1,
      failures: 3,
      lastReviewed: 500,
    },
    hardWon: {
      deckId: 'deck',
      phase: 'review',
      ease: 1.3,
      intervalDays: 3,
      due: 2_000,
      reps: 5,
      lapses: 2,
      failures: 4,
      lastReviewed: 600,
    },
    wilted: {
      deckId: 'deck',
      phase: 'learning',
      ease: 2.3,
      intervalDays: 0,
      due: 3_000,
      reps: 4,
      lapses: 1,
      failures: 2,
      lastReviewed: 700,
    },
    failedNew: {
      deckId: 'deck',
      phase: 'learning',
      ease: 2.3,
      intervalDays: 0,
      due: 3_500,
      reps: 1,
      lapses: 0,
      failures: 1,
      lastReviewed: 800,
    },
  };

  function migrated() {
    const raw = JSON.stringify({ version: 1, progress: { ...INITIAL_PROGRESS, xp: 77 }, cards: V1_CARDS });

    return parseState(raw);
  }

  it('is the current version after parsing', () => {
    expect(STATE_VERSION).toBe(2);
    expect(migrated().version).toBe(STATE_VERSION);
  });

  it('keeps due, counters and last review of every card', () => {
    const { mature, hardWon } = migrated().cards;

    expect(mature).toMatchObject({ due: 1_000, reps: 9, lapses: 1, failures: 3, lastReviewed: 500, phase: 'review' });
    expect(mature?.lastGrade).toBeNull();
    expect(hardWon).toMatchObject({ due: 2_000, reps: 5, lapses: 2, failures: 4, lastReviewed: 600 });
  });

  it('carries the interval over as stability', () => {
    const { mature, hardWon } = migrated().cards;

    expect(mature?.stability).toBe(40);
    expect(hardWon?.stability).toBe(3);
  });

  it('turns a high ease into a low difficulty and a low ease into a high one', () => {
    const { mature, hardWon } = migrated().cards;

    expect(mature?.difficulty).toBe(1);
    expect(hardWon?.difficulty).toBe(10);
  });

  it('gives a failed card a small stability and the phase that matches its history', () => {
    const { wilted, failedNew } = migrated().cards;

    expect(wilted).toMatchObject({ phase: 'relearning', stability: 0.5, lastGrade: 'again' });
    expect(failedNew).toMatchObject({ phase: 'learning', stability: 0.5, lastGrade: 'again' });
  });

  it('keeps ids and everything else in the state', () => {
    const state = migrated();

    expect(Object.keys(state.cards)).toEqual(['mature', 'hardWon', 'wilted', 'failedNew']);
    expect(state.cards['mature']?.exerciseId).toBe('mature');
    expect(state.progress.xp).toBe(77);
  });

  it('leaves no SM-2 fields behind', () => {
    const card = migrated().cards['mature'];

    expect(card).not.toHaveProperty('ease');
    expect(card).not.toHaveProperty('intervalDays');
  });

  it('leaves version 2 data alone', () => {
    const current = { deckId: 'deck', phase: 'review', stability: 12, difficulty: 4, due: 1, reps: 2 };
    const state = parseState(JSON.stringify({ version: 2, cards: { a: current } }));

    expect(state.cards['a']).toMatchObject({ stability: 12, difficulty: 4 });
  });
});

describe('manual rating setting', () => {
  it('is off for data written before it existed', () => {
    expect(parseState(JSON.stringify({ version: 2, settings: {} })).settings.manualRating).toBe(false);
    expect(DEFAULT_SETTINGS.manualRating).toBe(false);
  });

  it('is read back when set', () => {
    const state = parseState(JSON.stringify({ version: 2, settings: { manualRating: true } }));

    expect(state.settings.manualRating).toBe(true);
  });
});

describe('pending rating in a stored session', () => {
  it('survives parsing and drops damaged entries', () => {
    const feedback = {
      exerciseId: 'a',
      given: 'på',
      correct: true,
      grade: 'good',
      ratingOptions: [{ grade: 'good', delayMs: 5 }, { grade: 'bogus', delayMs: -4 }, 'x'],
    };
    const raw = JSON.stringify({ queue: ['a'], index: 0, startedAt: 1, feedback });

    const options = parseSession(raw)?.feedback?.ratingOptions;

    expect(options).toEqual([
      { grade: 'good', delayMs: 5 },
      { grade: 'good', delayMs: 0 },
    ]);
  });

  it('is not pending when none is stored', () => {
    const feedback = { exerciseId: 'a', given: 'på', correct: false, grade: 'again' };
    const raw = JSON.stringify({ queue: ['a'], index: 0, startedAt: 1, feedback });

    expect(parseSession(raw)?.feedback?.ratingOptions).toBeNull();
  });
});
