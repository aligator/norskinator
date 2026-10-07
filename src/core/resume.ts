/**
 * Turns a running session into a storable snapshot and back.
 *
 * The snapshot holds item ids and task types only. Restoring rebuilds the
 * exercises from the items that are loaded now, so a deck that was disabled
 * or regenerated in the meantime shrinks the session instead of breaking it.
 */
import type { PersistedSession } from './storage.ts';
import type { Feedback, SessionState } from './store.ts';
import type { Exercise, ExerciseKind } from './types.ts';

/** A session untouched for longer than this is not resumed; the learner has moved on. */
export const MAX_RESUME_AGE_MS = 12 * 60 * 60 * 1000;

export interface ResumedSession {
  readonly session: SessionState;
  readonly feedback: Feedback | null;
}

export function snapshotSession(session: SessionState, feedback: Feedback | null): PersistedSession {
  return {
    queue: session.queue.map((exercise) => exercise.id),
    kinds: session.queue.map((exercise) => exercise.kind),
    index: session.index,
    options: session.options,
    answered: session.answered,
    correct: session.correct,
    xpEarned: session.xpEarned,
    bestCombo: session.bestCombo,
    badgesEarned: session.badgesEarned,
    requeuedIds: session.requeuedIds,
    completed: session.completed,
    streakExtended: session.streakExtended,
    startedAt: session.startedAt,
    deckIds: session.deckIds,
    feedback:
      feedback === null
        ? null
        : {
            exerciseId: feedback.exercise.id,
            given: feedback.given,
            correct: feedback.correct,
            grade: feedback.grade,
            xpGained: feedback.xpGained,
            newBadges: feedback.newBadges,
            goalJustReached: feedback.goalJustReached,
            levelBefore: feedback.levelBefore,
            levelAfter: feedback.levelAfter,
          },
  };
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();

  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((entry, position) => entry === sortedRight[position])
  );
}

function optionsOf(exercise: Exercise): readonly string[] {
  switch (exercise.kind) {
    case 'multiple-choice': {
      return exercise.options;
    }

    case 'type-in': {
      return [];
    }

    case 'word-order': {
      return exercise.tiles;
    }
  }
}

/**
 * Rebuilds a session from its snapshot, or returns `null` when there is
 * nothing worth resuming: a completed or stale session, or one whose
 * remaining exercises no longer exist.
 *
 * `exerciseFor` rebuilds one queue entry, or returns null when its item is
 * gone. `optionsFor` shuffles fresh options when the stored ones no longer
 * match the exercise. `questionShownAt` restarts at `now`, so the reload
 * itself does not count as a slow answer.
 */
export function restoreSession(
  persisted: PersistedSession,
  exerciseFor: (id: string, kind: ExerciseKind) => Exercise | null,
  now: number,
  optionsFor: (exercise: Exercise) => readonly string[],
): ResumedSession | null {
  if (persisted.completed || now - persisted.startedAt > MAX_RESUME_AGE_MS) {
    return null;
  }

  const rebuilt = persisted.queue.map((id, position) =>
    exerciseFor(id, persisted.kinds[position] ?? 'multiple-choice'),
  );
  const queue: Exercise[] = [];
  let index = 0;

  for (const [position, exercise] of rebuilt.entries()) {
    if (exercise === null) {
      continue;
    }

    // Removed items before the current one shift it forward; removing the
    // current item itself makes the next surviving one current.
    if (position < persisted.index) {
      index += 1;
    }

    queue.push(exercise);
  }

  const shownId = persisted.queue[persisted.index];
  const shownExercise = rebuilt[persisted.index] ?? null;
  const pending = persisted.feedback;
  let feedback: Feedback | null = null;

  if (pending !== null && shownExercise !== null) {
    if (pending.exerciseId === shownId) {
      feedback = {
        exercise: shownExercise,
        given: pending.given,
        correct: pending.correct,
        grade: pending.grade,
        xpGained: pending.xpGained,
        newBadges: pending.newBadges,
        goalJustReached: pending.goalJustReached,
        levelBefore: pending.levelBefore,
        levelAfter: pending.levelAfter,
      };
    } else {
      // The shown exercise was already graded, so it must not be asked again.
      index += 1;
    }
  }

  const current = queue[index];

  if (current === undefined) {
    return null;
  }

  const options = sameMembers(persisted.options, optionsOf(current)) ? persisted.options : optionsFor(current);

  return {
    feedback,
    session: {
      queue,
      index,
      options,
      answered: persisted.answered,
      correct: persisted.correct,
      xpEarned: persisted.xpEarned,
      bestCombo: persisted.bestCombo,
      badgesEarned: persisted.badgesEarned,
      requeuedIds: persisted.requeuedIds,
      completed: false,
      streakExtended: persisted.streakExtended,
      startedAt: persisted.startedAt,
      questionShownAt: now,
      deckIds: persisted.deckIds,
    },
  };
}
