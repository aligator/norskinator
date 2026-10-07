/**
 * Application state container.
 *
 * Framework-free on purpose: Lit components subscribe through a controller,
 * but the rules live here and can be driven from tests without a DOM.
 */
import { isCorrect } from './checker.ts';
import { clampDailyGoal, levelInfo, recordAnswer, recordSessionCompleted, type Progress } from './gamification.ts';
import { restoreSession, snapshotSession } from './resume.ts';
import { buildSession, canRequeue, requeue, shuffleOptions } from './session.ts';
import { createCard, gradeFromAnswer, review, type CardState, type Grade } from './srs.ts';
import {
  INITIAL_STATE,
  STATE_VERSION,
  clampNewPerSession,
  clearSession,
  defaultStorage,
  loadSession,
  loadState,
  saveSession,
  saveState,
  storedVersion,
  type PersistedSession,
  type PersistedState,
  type Settings,
  type StorageLike,
} from './storage.ts';
import { loadDeck, presentAs, presentItem } from './tasks.ts';
import type { Deck, Exercise, ExerciseKind, PlayableItem } from './types.ts';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface Feedback {
  readonly exercise: Exercise;
  readonly given: string;
  readonly correct: boolean;
  readonly grade: Grade;
  readonly xpGained: number;
  readonly newBadges: readonly string[];
  readonly goalJustReached: boolean;
  readonly levelBefore: number;
  readonly levelAfter: number;
}

export interface SessionState {
  readonly queue: readonly Exercise[];
  readonly index: number;
  /** Options for the current exercise, shuffled once per presentation. */
  readonly options: readonly string[];
  readonly answered: number;
  readonly correct: number;
  readonly xpEarned: number;
  readonly bestCombo: number;
  readonly badgesEarned: readonly string[];
  /** One entry per re-queue so far; see `canRequeue`. */
  readonly requeuedIds: readonly string[];
  /** Set once the queue is worked through; quitting early leaves it false. */
  readonly completed: boolean;
  readonly streakExtended: boolean;
  readonly startedAt: number;
  readonly questionShownAt: number;
  readonly deckIds: readonly string[];
}

export interface AppState {
  readonly status: LoadStatus;
  readonly error: string | null;
  /** Items of every enabled deck; a session presents them as exercises. */
  readonly items: readonly PlayableItem[];
  readonly progress: Progress;
  readonly cards: Readonly<Record<string, CardState>>;
  readonly settings: Settings;
  readonly session: SessionState | null;
  readonly feedback: Feedback | null;
  /**
   * A newer build of the app saved data this build does not know. Writing
   * would overwrite it with an older shape, so this build stops saving until
   * the page is reloaded.
   */
  readonly newerVersionStored: boolean;
}

export interface StartOptions {
  /** Overrides the configured limit, e.g. for "Øv ekstra" after the daily work is done. */
  readonly newPerSession?: number;
}

export interface StoreDependencies {
  readonly decks: readonly Deck[];
  readonly storage?: StorageLike;
  readonly now?: () => number;
  readonly random?: () => number;
}

const PERSIST_DEBOUNCE_MS = 250;

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}

export class Store {
  #state: AppState;
  #persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped per deck load so a slower, outdated load cannot overwrite a newer one. */
  #loadGeneration = 0;
  /** Session found in storage at startup, resumed once the exercises are loaded. */
  #pendingResume: PersistedSession | null;

  readonly #listeners = new Set<() => void>();
  readonly #decks: readonly Deck[];
  readonly #storage: StorageLike;
  readonly #now: () => number;
  readonly #random: () => number;

  constructor(dependencies: StoreDependencies) {
    this.#decks = dependencies.decks;
    this.#storage = dependencies.storage ?? defaultStorage();
    this.#now = dependencies.now ?? (() => Date.now());
    this.#random = dependencies.random ?? Math.random;

    const persisted = loadState(this.#storage);

    this.#pendingResume = loadSession(this.#storage);

    this.#state = {
      status: 'idle',
      error: null,
      items: [],
      progress: persisted.progress,
      cards: persisted.cards,
      settings: persisted.settings,
      session: null,
      feedback: null,
      newerVersionStored: this.#hasNewerData(),
    };
  }

  get state(): AppState {
    return this.#state;
  }

  get currentExercise(): Exercise | null {
    const session = this.#state.session;

    if (session === null) {
      return null;
    }

    return session.queue[session.index] ?? null;
  }

  get sessionFinished(): boolean {
    const session = this.#state.session;

    return session !== null && session.index >= session.queue.length;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Loads every enabled deck. Safe to call repeatedly. */
  async init(): Promise<void> {
    if (this.#state.status === 'loading' || this.#state.status === 'ready') {
      return;
    }

    await this.#loadDecks();
  }

  /** Starts a session over the given decks, or over all enabled decks. */
  startSession(deckIds?: readonly string[], options: StartOptions = {}): void {
    const now = this.#now();
    const scope = deckIds ?? this.#decks.map((deck) => deck.id);
    const pool = this.#state.items.filter((item) => scope.includes(item.deckId));

    const picked = buildSession(
      pool,
      this.#state.cards,
      {
        newPerSession: options.newPerSession ?? this.#state.settings.newPerSession,
        random: this.#random,
      },
      now,
    );

    const queue = picked.flatMap((item) => {
      const exercise = presentItem(item, this.#state.settings.taskWeights, this.#random);

      return exercise === null ? [] : [exercise];
    });

    if (queue.length === 0) {
      this.#patch({ session: null, feedback: null });

      return;
    }

    this.#patch({
      feedback: null,
      session: {
        queue,
        index: 0,
        options: this.#optionsFor(queue[0]!),
        answered: 0,
        correct: 0,
        xpEarned: 0,
        bestCombo: 0,
        badgesEarned: [],
        requeuedIds: [],
        completed: false,
        streakExtended: false,
        startedAt: now,
        questionShownAt: now,
        deckIds: scope,
      },
    });
  }

  /** Grades the current exercise and moves the session into its feedback step. */
  answer(given: string): void {
    const session = this.#state.session;

    if (session === null || this.#state.feedback !== null) {
      return;
    }

    const exercise = session.queue[session.index];

    if (exercise === undefined) {
      return;
    }

    const now = this.#now();
    const correct = isCorrect(exercise, given);
    const grade = gradeFromAnswer(correct, now - session.questionShownAt);

    const existing = this.#state.cards[exercise.id] ?? createCard(exercise.id, exercise.deckId, now);
    const card = review(existing, grade, now);
    const outcome = recordAnswer(this.#state.progress, correct, now);

    const requeued = !correct && canRequeue(session.requeuedIds, exercise.id);

    this.#patch({
      cards: { ...this.#state.cards, [exercise.id]: card },
      progress: outcome.progress,
      session: {
        ...session,
        queue: requeued ? requeue(session.queue, session.index, exercise) : session.queue,
        requeuedIds: requeued ? [...session.requeuedIds, exercise.id] : session.requeuedIds,
        answered: session.answered + 1,
        correct: session.correct + (correct ? 1 : 0),
        xpEarned: session.xpEarned + outcome.xpGained,
        bestCombo: Math.max(session.bestCombo, outcome.progress.combo),
        badgesEarned: [...session.badgesEarned, ...outcome.newBadges],
      },
      feedback: {
        exercise,
        given,
        correct,
        grade,
        xpGained: outcome.xpGained,
        newBadges: outcome.newBadges,
        goalJustReached: outcome.goalJustReached,
        levelBefore: levelInfo(this.#state.progress.xp).level,
        levelAfter: levelInfo(outcome.progress.xp).level,
      },
    });

    this.#persist();
  }

  /** Moves to the next exercise; an index equal to the queue length means the session is done. */
  next(): void {
    const session = this.#state.session;

    if (session === null || this.#state.feedback === null) {
      return;
    }

    const index = Math.min(session.index + 1, session.queue.length);

    if (index >= session.queue.length) {
      this.#complete(session, index);

      return;
    }

    this.#patch({
      feedback: null,
      session: {
        ...session,
        index,
        options: this.#optionsFor(session.queue[index]!),
        questionShownAt: this.#now(),
      },
    });
  }

  #complete(session: SessionState, index: number): void {
    const outcome = recordSessionCompleted(this.#state.progress, this.#now());

    this.#patch({
      feedback: null,
      progress: outcome.progress,
      session: {
        ...session,
        index,
        completed: true,
        streakExtended: outcome.streakExtended,
        badgesEarned: [...session.badgesEarned, ...outcome.newBadges],
      },
    });

    this.#persist();
  }

  endSession(): void {
    this.#patch({ session: null, feedback: null });
  }

  updateSettings(patch: Partial<Settings>): void {
    const previous = this.#state.settings;
    const merged = { ...previous, ...patch };
    const settings = { ...merged, newPerSession: clampNewPerSession(merged.newPerSession) };

    this.#patch({ settings });
    this.#persist();

    if (!sameIds(previous.disabledDeckIds, settings.disabledDeckIds)) {
      this.#patch({ status: 'idle', items: [], session: null, feedback: null });
      void this.init();
    }
  }

  setDailyGoal(goal: number): void {
    const dailyGoal = clampDailyGoal(goal);

    this.#patch({ progress: { ...this.#state.progress, dailyGoal } });
    this.#persist();
  }

  /**
   * Wipes learning progress, cards and the session. Irreversible for the
   * learner. Settings and the daily goal are preferences, not progress, and
   * survive. Written at once so other tabs pick up the reset immediately.
   */
  resetProgress(): void {
    this.#cancelPendingWrite();

    this.#patch({
      progress: { ...INITIAL_STATE.progress, dailyGoal: this.#state.progress.dailyGoal },
      cards: {},
      session: null,
      feedback: null,
    });

    this.#writeNow();
    clearSession(this.#storage);
  }

  /**
   * Adopts state another tab persisted (call it from the `storage` event).
   * The running session and its feedback stay as they are. A pending local
   * write is dropped: the other tab wrote last, and writing ours afterwards
   * would silently undo its answers.
   */
  reloadFromStorage(): void {
    const persisted = loadState(this.#storage);
    const decksChanged = !sameIds(
      this.#state.settings.disabledDeckIds,
      persisted.settings.disabledDeckIds,
    );

    this.#cancelPendingWrite();

    this.#patch({
      progress: persisted.progress,
      cards: persisted.cards,
      settings: persisted.settings,
      newerVersionStored: this.#hasNewerData(),
    });

    // The session keeps its own copies of its exercises, so the pool can be
    // swapped underneath it; idle or failed stores pick up the change on init.
    if (decksChanged && (this.#state.status === 'ready' || this.#state.status === 'loading')) {
      void this.#loadDecks();
    }
  }

  /** Flushes a pending debounce, e.g. when the tab is being hidden. */
  flush(): void {
    if (this.#persistTimer === null) {
      return;
    }

    this.#cancelPendingWrite();
    this.#writeNow();
  }

  /** Loads every enabled deck; a store that is already ready refreshes without a loading state. */
  async #loadDecks(): Promise<void> {
    this.#loadGeneration += 1;
    const generation = this.#loadGeneration;

    if (this.#state.status !== 'ready') {
      this.#patch({ status: 'loading', error: null });
    }

    try {
      const disabled = this.#state.settings.disabledDeckIds;
      const enabled = this.#decks.filter((deck) => !disabled.includes(deck.id));
      const loaded = await Promise.all(enabled.map((deck) => loadDeck(deck)));

      if (generation !== this.#loadGeneration) {
        return;
      }

      this.#patch({ status: 'ready', items: loaded.flat() });
      this.#resumePending();
    } catch (error) {
      if (generation !== this.#loadGeneration) {
        return;
      }

      const message =
        error instanceof Error ? error.message : 'Ukjent feil ved lasting av oppgaver.';

      this.#patch({ status: 'error', error: message });
    }
  }

  /** Resumes the session a reload interrupted, unless one was started since. */
  #resumePending(): void {
    const pending = this.#pendingResume;

    this.#pendingResume = null;

    if (pending === null || this.#state.session !== null) {
      return;
    }

    const resumed = restoreSession(
      pending,
      (id, kind) => this.#exerciseFor(id, kind),
      this.#now(),
      (exercise) => this.#optionsFor(exercise),
    );

    if (resumed === null) {
      clearSession(this.#storage);

      return;
    }

    this.#patch({ session: resumed.session, feedback: resumed.feedback });
  }

  /**
   * Rebuilds a stored queue entry as the task type it was shown as. If that
   * type no longer fits (deck changed, item edited), a new one is picked.
   */
  #exerciseFor(id: string, kind: ExerciseKind): Exercise | null {
    const item = this.#state.items.find((candidate) => candidate.id === id);

    if (item === undefined) {
      return null;
    }

    return presentAs(item, kind) ?? presentItem(item, this.#state.settings.taskWeights, this.#random);
  }

  #optionsFor(exercise: Exercise): string[] {
    if (exercise.kind !== 'multiple-choice') {
      return [];
    }

    return shuffleOptions(exercise.options, this.#random);
  }

  #patch(patch: Partial<AppState>): void {
    const previousSession = this.#state.session;

    this.#state = { ...this.#state, ...patch };

    if ('session' in patch || 'feedback' in patch) {
      this.#saveSession(previousSession);
    }

    for (const listener of this.#listeners) {
      listener();
    }
  }

  /**
   * Written right away rather than debounced: a reload can come at any moment
   * (PWA update, tab eviction) and the snapshot is tiny. A store that never
   * had a session leaves the key alone, so it cannot wipe another tab's.
   */
  #hasNewerData(): boolean {
    return (storedVersion(this.#storage) ?? 0) > STATE_VERSION;
  }

  #saveSession(previousSession: SessionState | null): void {
    if (this.#state.newerVersionStored) {
      return;
    }

    const session = this.#state.session;

    if (session !== null && !session.completed) {
      saveSession(snapshotSession(session, this.#state.feedback), this.#storage);

      return;
    }

    if (previousSession !== null) {
      clearSession(this.#storage);
    }
  }

  #persist(): void {
    this.#cancelPendingWrite();

    this.#persistTimer = setTimeout(() => {
      this.#persistTimer = null;
      this.#writeNow();
    }, PERSIST_DEBOUNCE_MS);
  }

  #cancelPendingWrite(): void {
    if (this.#persistTimer === null) {
      return;
    }

    clearTimeout(this.#persistTimer);
    this.#persistTimer = null;
  }

  #writeNow(): void {
    if (this.#state.newerVersionStored) {
      return;
    }

    const snapshot: PersistedState = {
      version: INITIAL_STATE.version,
      progress: this.#state.progress,
      cards: this.#state.cards,
      settings: this.#state.settings,
    };

    saveState(snapshot, this.#storage);
  }
}
