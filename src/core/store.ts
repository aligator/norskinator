/**
 * Application state container.
 *
 * Framework-free on purpose: Lit components subscribe through a controller,
 * but the rules live here and can be driven from tests without a DOM.
 */
import { isCorrect } from './checker.ts';
import { unlockBadges } from './badges.ts';
import { clampDailyGoal, recordAnswer, recordSessionCompleted, type Progress } from './gamification.ts';
import { plantChange, plantOf, type Plant } from './garden.ts';
import { DEFAULT_SPECIES, buySpecies, sow, type GardenState, type SpeciesId } from './species.ts';
import { restoreSession, snapshotSession } from './resume.ts';
import {
  buildPracticeSession,
  buildSession,
  canRequeue,
  requeue,
  sessionOptions,
  shuffleOptions,
  shuffleTiles,
  type SessionMode,
} from './session.ts';
import { createCard, ratingOptions, review, type CardState, type Grade, type RatingOption } from './srs.ts';
import {
  INITIAL_STATE,
  STATE_VERSION,
  clampPace,
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
import { gradeFromAnswer, loadDeck, presentAs, presentItem } from './tasks.ts';
import { dailyRoom, recordCounted } from './daily.ts';
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
  readonly plantBefore: Plant;
  readonly plantAfter: Plant;
  readonly species: SpeciesId;
  /** Epoch ms the item comes back. */
  readonly nextDue: number;
  /** Times the item was answered, this answer included. */
  readonly reps: number;
  /**
   * Set while a right answer waits for the learner's rating (`manualRating`);
   * the card is not reviewed and nothing is paid before `rate`.
   */
  readonly ratingOptions: readonly RatingOption[] | null;
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
  /** Items answered for the first time. */
  readonly seedsSown: number;
  readonly plantsGrown: number;
  readonly plantsWilted: number;
  /** Each answered item's plant before its first answer this session, for the summary. */
  readonly gardenStart: Readonly<Record<string, Plant>>;
  readonly startedAt: number;
  readonly questionShownAt: number;
  readonly deckIds: readonly string[];
  readonly mode: SessionMode;
}

export interface AppState {
  readonly status: LoadStatus;
  readonly error: string | null;
  /** Items of every enabled deck; a session presents them as exercises. */
  readonly items: readonly PlayableItem[];
  readonly progress: Progress;
  readonly cards: Readonly<Record<string, CardState>>;
  readonly settings: Settings;
  readonly garden: GardenState;
  readonly session: SessionState | null;
  readonly feedback: Feedback | null;
  /**
   * A newer build of the app saved data this build does not know. Writing
   * would overwrite it with an older shape, so this build stops saving until
   * the page is reloaded.
   */
  readonly newerVersionStored: boolean;
}

export interface StoreDependencies {
  readonly decks: readonly Deck[];
  readonly storage?: StorageLike;
  readonly now?: () => number;
  readonly random?: () => number;
}

const PERSIST_DEBOUNCE_MS = 250;

/** The first answer of an item and the review of a graduated card use up today's limits; learning steps do not. */
function countAgainstLimits(progress: Progress, previous: CardState | undefined, now: number): Progress {
  if (previous === undefined) {
    return recordCounted(progress, 'new', now);
  }

  return previous.phase === 'review' ? recordCounted(progress, 'review', now) : progress;
}

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

    // Badges added in a newer build are earned at once by a garden that already qualifies.
    const { progress } = unlockBadges(persisted);

    this.#state = {
      status: 'idle',
      error: null,
      items: [],
      progress,
      cards: persisted.cards,
      settings: persisted.settings,
      garden: persisted.garden,
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
  startSession(deckIds?: readonly string[]): void {
    const now = this.#now();
    const scope = deckIds ?? this.#decks.map((deck) => deck.id);
    const pool = this.#state.items.filter((item) => scope.includes(item.deckId));

    const room = dailyRoom(this.#state.progress, this.#state.settings, now);
    const options = { ...sessionOptions(this.#state.settings, room), random: this.#random };
    const scheduled = buildSession(pool, this.#state.cards, options, now);

    // Nothing to review and no room for seeds still leaves something to practise.
    const mode: SessionMode = scheduled.length > 0 ? 'review' : 'practice';
    const picked = mode === 'review' ? scheduled : buildPracticeSession(pool, this.#state.cards, options);

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
        seedsSown: 0,
        plantsGrown: 0,
        plantsWilted: 0,
        gardenStart: {},
        startedAt: now,
        questionShownAt: now,
        deckIds: scope,
        mode,
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
    const practice = session.mode === 'practice';
    const previous = this.#state.cards[exercise.id];

    // A right answer in a review session waits for the learner's own rating.
    if (correct && !practice && this.#state.settings.manualRating) {
      const plant = plantOf(previous);

      this.#patch({
        feedback: {
          exercise,
          given,
          correct,
          grade: 'good',
          xpGained: 0,
          newBadges: [],
          goalJustReached: false,
          plantBefore: plant,
          plantAfter: plant,
          species: this.#state.garden.species[exercise.id] ?? DEFAULT_SPECIES,
          nextDue: previous?.due ?? now,
          reps: previous?.reps ?? 0,
          ratingOptions: ratingOptions(previous ?? createCard(exercise.id, exercise.deckId, now), now),
        },
      });

      return;
    }

    const grade = gradeFromAnswer(exercise.kind, correct, now - session.questionShownAt);

    this.#settle(session, exercise, given, grade, now);
    this.#persist();
  }

  /** Rates the right answer that is waiting for it and moves the session into its feedback step. */
  rate(grade: RatingOption['grade']): void {
    const session = this.#state.session;
    const pending = this.#state.feedback;

    if (session === null || pending === null || pending.ratingOptions === null) {
      return;
    }

    if (!pending.ratingOptions.some((option) => option.grade === grade)) {
      return;
    }

    this.#settle(session, pending.exercise, pending.given, grade, this.#now());
    this.#persist();
  }

  /** Reviews the card, pays the answer and shows its feedback. */
  #settle(session: SessionState, exercise: Exercise, given: string, grade: Grade, now: number): void {
    const correct = grade !== 'again';
    const practice = session.mode === 'practice';

    // Practice leaves the card alone: its plant neither grows nor wilts, and no seed is sown.
    const previous = this.#state.cards[exercise.id];
    const card = practice ? previous : review(previous ?? createCard(exercise.id, exercise.deckId, now), grade, now);
    const cards = practice || card === undefined ? this.#state.cards : { ...this.#state.cards, [exercise.id]: card };
    const garden = practice ? this.#state.garden : sow(this.#state.garden, exercise.id, this.#random);
    const outcome = recordAnswer(this.#state.progress, correct, now, { cards, garden }, session.mode);
    const progress = practice ? outcome.progress : countAgainstLimits(outcome.progress, previous, now);

    const plantBefore = plantOf(previous);
    const plantAfter = plantOf(card);
    const change = plantChange(plantBefore, plantAfter);

    const requeued = !correct && canRequeue(session.requeuedIds, exercise.id);

    this.#patch({
      cards,
      progress,
      garden,
      session: {
        ...session,
        queue: requeued ? requeue(session.queue, session.index, exercise) : session.queue,
        requeuedIds: requeued ? [...session.requeuedIds, exercise.id] : session.requeuedIds,
        answered: session.answered + 1,
        correct: session.correct + (correct ? 1 : 0),
        xpEarned: session.xpEarned + outcome.xpGained,
        bestCombo: Math.max(session.bestCombo, outcome.progress.combo),
        badgesEarned: [...session.badgesEarned, ...outcome.newBadges],
        seedsSown: session.seedsSown + (!practice && plantBefore.stage === 'seed' ? 1 : 0),
        plantsGrown: session.plantsGrown + (change === 'grown' ? 1 : 0),
        plantsWilted: session.plantsWilted + (change === 'wilted' ? 1 : 0),
        gardenStart:
          practice || exercise.id in session.gardenStart
            ? session.gardenStart
            : { ...session.gardenStart, [exercise.id]: plantBefore },
      },
      feedback: {
        exercise,
        given,
        correct,
        grade,
        xpGained: outcome.xpGained,
        newBadges: outcome.newBadges,
        goalJustReached: outcome.goalJustReached,
        plantBefore,
        plantAfter,
        species: garden.species[exercise.id] ?? DEFAULT_SPECIES,
        nextDue: card?.due ?? now,
        reps: card?.reps ?? 0,
        ratingOptions: null,
      },
    });
  }

  /** Moves to the next exercise; an index equal to the queue length means the session is done. */
  next(): void {
    const session = this.#state.session;

    // A right answer has to be rated before the session moves on.
    if (session === null || this.#state.feedback === null || this.#state.feedback.ratingOptions !== null) {
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
    const { cards, garden } = this.#state;
    const outcome = recordSessionCompleted(this.#state.progress, this.#now(), { cards, garden });

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
    const settings = clampPace(merged);

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
      garden: INITIAL_STATE.garden,
      session: null,
      feedback: null,
    });

    this.#writeNow();
    clearSession(this.#storage);
  }

  /**
   * Buys a plant species with XP and returns the badges the purchase earned;
   * does nothing when it is owned already or too expensive.
   */
  buySpecies(id: SpeciesId): readonly string[] {
    const garden = buySpecies(this.#state.progress.xp, this.#state.garden, id);

    if (garden === null) {
      return [];
    }

    const { progress, newBadges } = unlockBadges({ progress: this.#state.progress, cards: this.#state.cards, garden });

    this.#patch({ garden, progress });
    this.#persist();

    return newBadges;
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
      garden: persisted.garden,
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

  /** Choices shuffled once per presentation; word-order tiles never start out already solved. */
  #optionsFor(exercise: Exercise): string[] {
    switch (exercise.kind) {
      case 'multiple-choice': {
        return shuffleOptions(exercise.options, this.#random);
      }

      case 'type-in': {
        return [];
      }

      case 'word-order': {
        return shuffleTiles(exercise.tiles, this.#random);
      }
    }
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
      garden: this.#state.garden,
    };

    saveState(snapshot, this.#storage);
  }
}
