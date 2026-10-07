import { describe, expect, it } from 'vitest';

import { MAX_RESUME_AGE_MS, restoreSession, snapshotSession } from './resume.ts';
import type { PersistedFeedback, PersistedSession } from './storage.ts';
import type { Feedback, SessionState } from './store.ts';
import type { Exercise, ExerciseKind } from './types.ts';

const NOW = Date.parse('2026-01-15T10:00:00Z');

function exercise(id: string): Exercise {
  return {
    kind: 'multiple-choice',
    id,
    deckId: 'deck',
    prompt: 'Jeg bor ___ Norge.',
    answer: 'i',
    options: ['i', 'på', 'til'],
    level: 1,
    tags: ['i'],
  };
}

const POOL = [exercise('a'), exercise('b'), exercise('c'), exercise('d')];

/** Rebuilds queue entries from a fixed pool, as the store does from its items. */
function lookup(pool: readonly Exercise[]): (id: string, kind: ExerciseKind) => Exercise | null {
  return (id, kind) => pool.find((entry) => entry.id === id && entry.kind === kind) ?? null;
}

function persisted(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    queue: ['a', 'b', 'c', 'd'],
    kinds: ['multiple-choice', 'multiple-choice', 'multiple-choice', 'multiple-choice'],
    index: 2,
    options: ['til', 'i', 'på'],
    answered: 2,
    correct: 2,
    xpEarned: 20,
    bestCombo: 2,
    badgesEarned: [],
    requeuedIds: [],
    completed: false,
    streakExtended: false,
    startedAt: NOW - 60_000,
    deckIds: ['deck'],
    feedback: null,
    ...overrides,
  };
}

const PENDING_FEEDBACK: PersistedFeedback = {
  exerciseId: 'c',
  given: 'på',
  correct: false,
  grade: 'again',
  xpGained: 0,
  newBadges: [],
  goalJustReached: false,
  levelBefore: 1,
  levelAfter: 1,
};

const reshuffle = (): readonly string[] => ['reshuffled'];

describe('snapshotSession', () => {
  it('stores ids and survives a restore unchanged', () => {
    const session: SessionState = {
      queue: POOL,
      index: 1,
      options: ['på', 'til', 'i'],
      answered: 2,
      correct: 1,
      xpEarned: 10,
      bestCombo: 1,
      badgesEarned: ['first-steps'],
      requeuedIds: ['b'],
      completed: false,
      streakExtended: false,
      startedAt: NOW - 1_000,
      questionShownAt: NOW - 500,
      deckIds: ['deck'],
    };
    const feedback: Feedback = {
      exercise: exercise('b'),
      given: 'på',
      correct: false,
      grade: 'again',
      xpGained: 0,
      newBadges: [],
      goalJustReached: false,
      levelBefore: 1,
      levelAfter: 1,
    };

    const snapshot = snapshotSession(session, feedback);
    const restored = restoreSession(snapshot, lookup(POOL), NOW, reshuffle);

    expect(snapshot.queue).toEqual(['a', 'b', 'c', 'd']);
    expect(snapshot.feedback?.exerciseId).toBe('b');
    expect(restored?.session).toEqual({ ...session, questionShownAt: NOW });
    expect(restored?.feedback).toEqual(feedback);
  });
});

describe('restoreSession', () => {
  it('drops completed and stale sessions', () => {
    expect(restoreSession(persisted({ completed: true }), lookup(POOL), NOW, reshuffle)).toBeNull();
    expect(
      restoreSession(persisted({ startedAt: NOW - MAX_RESUME_AGE_MS - 1 }), lookup(POOL), NOW, reshuffle),
    ).toBeNull();
  });

  it('keeps the current exercise when earlier ones were removed', () => {
    const pool = POOL.filter((item) => item.id !== 'a');

    const restored = restoreSession(persisted(), lookup(pool), NOW, reshuffle);

    expect(restored?.session.queue.map((item) => item.id)).toEqual(['b', 'c', 'd']);
    expect(restored?.session.index).toBe(1);
    expect(restored?.session.queue[1]?.id).toBe('c');
  });

  it('moves on to the next exercise when the current one was removed', () => {
    const pool = POOL.filter((item) => item.id !== 'c');

    const restored = restoreSession(persisted({ feedback: PENDING_FEEDBACK }), lookup(pool), NOW, reshuffle);

    expect(restored?.session.queue[restored.session.index]?.id).toBe('d');
    expect(restored?.feedback).toBeNull();
  });

  it('skips an exercise whose stored feedback does not match it', () => {
    const feedback = { ...PENDING_FEEDBACK, exerciseId: 'b' };

    const restored = restoreSession(persisted({ feedback }), lookup(POOL), NOW, reshuffle);

    expect(restored?.session.index).toBe(3);
    expect(restored?.feedback).toBeNull();
  });

  it('drops a session with nothing left to show', () => {
    const pool = POOL.filter((item) => item.id === 'a' || item.id === 'b');

    expect(restoreSession(persisted(), lookup(pool), NOW, reshuffle)).toBeNull();
    expect(restoreSession(persisted({ queue: [], kinds: [], index: 0 }), lookup(POOL), NOW, reshuffle)).toBeNull();
  });

  it('rebuilds every entry as the task type it was shown as', () => {
    const typed: Exercise = { ...exercise('c'), kind: 'type-in', answer: 'i' };
    const kinds: ExerciseKind[] = ['multiple-choice', 'multiple-choice', 'type-in', 'multiple-choice'];

    const restored = restoreSession(persisted({ kinds }), lookup([...POOL, typed]), NOW, reshuffle);

    expect(restored?.session.queue.map((entry) => entry.kind)).toEqual(kinds);
    expect(restored?.session.options).toEqual(['reshuffled']);
  });

  it('reshuffles options that no longer match the exercise', () => {
    const restored = restoreSession(persisted({ options: ['i', 'av'] }), lookup(POOL), NOW, reshuffle);

    expect(restored?.session.options).toEqual(['reshuffled']);
  });
});
