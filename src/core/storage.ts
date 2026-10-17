/**
 * localStorage persistence.
 *
 * Everything is validated on read: a corrupt or hand-edited entry must never
 * crash the app, it falls back to defaults. The stored shape is versioned so
 * future changes can migrate instead of wiping progress.
 */
import { INITIAL_PROGRESS, clampDailyGoal, type Progress } from './gamification.ts';
import { PLANT_STAGES, SEED, type Plant } from './garden.ts';
import { SESSION_MODES, type SessionMode } from './session.ts';
import { DEFAULT_SPECIES, INITIAL_GARDEN, SPECIES_IDS, type GardenState, type SpeciesId } from './species.ts';
import { CARD_PHASES, type CardState, type Grade, type RatingOption } from './srs.ts';
import { DEFAULT_TASK_WEIGHTS, parseTaskWeights, type TaskWeights } from './task-weights.ts';
import { EXERCISE_KINDS, type ExerciseKind } from './types.ts';

export const STORAGE_KEY = 'norskinator.state';
export const STATE_VERSION = 2;

export type TranslationLanguage = 'de' | 'en' | 'none';

export type ThemePreference = 'auto' | 'light' | 'dark';

export interface Settings {
  readonly translationLanguage: TranslationLanguage;
  readonly theme: ThemePreference;
  /** How many unseen exercises may be introduced per day. */
  readonly newPerDay: number;
  /** How many graduated cards may be reviewed per day; learning cards are not counted. */
  readonly reviewsPerDay: number;
  /** Exercises in one session, drawn from what is left of today's limits. */
  readonly sessionSize: number;
  readonly disabledDeckIds: readonly string[];
  /** Short synthesised feedback sounds for answers, level-ups and the daily goal. */
  readonly soundEffects: boolean;
  /** Read the Norwegian solution aloud after an answer, if the device has a voice. */
  readonly speakSolution: boolean;
  /** Share of each task type in percent, adding up to 100. */
  readonly taskWeights: TaskWeights;
  /** Rate every right answer yourself (hard, good, easy) instead of by response time. */
  readonly manualRating: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  translationLanguage: 'de',
  theme: 'auto',
  newPerDay: 10,
  reviewsPerDay: 100,
  sessionSize: 20,
  disabledDeckIds: [],
  soundEffects: false,
  speakSolution: false,
  taskWeights: DEFAULT_TASK_WEIGHTS,
  manualRating: false,
};

export interface PersistedState {
  readonly version: number;
  readonly progress: Progress;
  readonly cards: Readonly<Record<string, CardState>>;
  readonly settings: Settings;
  readonly garden: GardenState;
}

export const INITIAL_STATE: PersistedState = {
  version: STATE_VERSION,
  progress: INITIAL_PROGRESS,
  cards: {},
  settings: DEFAULT_SETTINGS,
  garden: INITIAL_GARDEN,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

/** Non-negative integer; counters must never come back fractional or negative. */
function readCount(value: unknown): number {
  return Math.max(0, Math.floor(readNumber(value, 0)));
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value !== 'boolean') {
    return fallback;
  }

  return value;
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    return fallback;
  }

  return value as T;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readNullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  return value;
}

function parseProgress(value: unknown): Progress {
  if (!isRecord(value)) {
    return INITIAL_PROGRESS;
  }

  const rawLastActiveDay = value['lastActiveDay'];
  const rawLastSessionDay = value['lastSessionDay'];
  const rawGoalReachedDay = value['goalReachedDay'];

  const lastActiveDay = typeof rawLastActiveDay === 'string' ? rawLastActiveDay : null;
  const totalAnswers = readCount(value['totalAnswers']);
  const answersToday = readCount(value['answersToday']);
  const dailyGoal = clampDailyGoal(readNumber(value['dailyGoal'], INITIAL_PROGRESS.dailyGoal));

  // State written before `goalReachedDay` existed: a day already at its goal was paid.
  const legacyGoalDay = answersToday >= dailyGoal ? lastActiveDay : null;

  return {
    xp: readCount(value['xp']),
    combo: readCount(value['combo']),
    bestCombo: readCount(value['bestCombo']),
    totalAnswers,
    correctAnswers: Math.min(totalAnswers, readCount(value['correctAnswers'])),
    lastActiveDay,
    // State written before `lastSessionDay` existed counted streaks per active day.
    // A stored `null` is a real value: no session completed yet.
    lastSessionDay: Object.hasOwn(value, 'lastSessionDay')
      ? readNullableString(rawLastSessionDay)
      : lastActiveDay,
    streakDays: readCount(value['streakDays']),
    bestStreakDays: readCount(value['bestStreakDays']),
    answersToday,
    dailyGoal,
    goalDaysReached: readCount(value['goalDaysReached']),
    goalReachedDay: typeof rawGoalReachedDay === 'string' ? rawGoalReachedDay : legacyGoalDay,
    unlockedBadges: readStringArray(value['unlockedBadges']),
    limitsDay: readNullableString(value['limitsDay']),
    newToday: readCount(value['newToday']),
    reviewsToday: readCount(value['reviewsToday']),
  };
}

const MIN_STABILITY = 0.01;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;

function parseCard(id: string, value: unknown): CardState | null {
  if (!isRecord(value)) {
    return null;
  }

  const deckId = value['deckId'];

  if (typeof deckId !== 'string') {
    return null;
  }

  const lastReviewed = value['lastReviewed'];
  const lapses = readCount(value['lapses']);
  const phase = readEnum(value['phase'], CARD_PHASES, 'new');

  // The scheduler rejects a memory state outside its range, so an answered card is kept inside it.
  const stability = Math.max(0, readNumber(value['stability'], 0));
  const difficulty = Math.min(MAX_DIFFICULTY, Math.max(0, readNumber(value['difficulty'], 0)));

  return {
    exerciseId: id,
    deckId,
    phase,
    stability: phase === 'new' ? stability : Math.max(MIN_STABILITY, stability),
    difficulty: phase === 'new' ? difficulty : Math.max(MIN_DIFFICULTY, difficulty),
    learningStep: readCount(value['learningStep']),
    due: readNumber(value['due'], 0),
    reps: readCount(value['reps']),
    lapses,
    // Older state counted every miss as a lapse, so that is the best estimate.
    failures: readCount(value['failures'] ?? lapses),
    lastReviewed: typeof lastReviewed === 'number' ? lastReviewed : null,
    lastGrade: isGrade(value['lastGrade']) ? value['lastGrade'] : null,
  };
}

/** Keys that would touch the prototype chain instead of storing a card. */
const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

function parseCards(value: unknown): Record<string, CardState> {
  if (!isRecord(value)) {
    return {};
  }

  const cards: Record<string, CardState> = {};

  for (const [id, raw] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(id)) {
      continue;
    }

    const card = parseCard(id, raw);

    if (card !== null) {
      cards[id] = card;
    }
  }

  return cards;
}

/** Sane ranges for the pace settings, as whole numbers. */
export const PACE_BOUNDS = {
  newPerDay: { min: 0, max: 100 },
  reviewsPerDay: { min: 10, max: 1000 },
  sessionSize: { min: 5, max: 50 },
} as const;

function clampToBounds(value: number, bounds: { readonly min: number; readonly max: number }, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

/** Brings every numeric pace setting into its range, e.g. after a partial update. */
export function clampPace(settings: Settings): Settings {
  return {
    ...settings,
    newPerDay: clampToBounds(settings.newPerDay, PACE_BOUNDS.newPerDay, DEFAULT_SETTINGS.newPerDay),
    reviewsPerDay: clampToBounds(settings.reviewsPerDay, PACE_BOUNDS.reviewsPerDay, DEFAULT_SETTINGS.reviewsPerDay),
    sessionSize: clampToBounds(settings.sessionSize, PACE_BOUNDS.sessionSize, DEFAULT_SETTINGS.sessionSize),
  };
}

function parseSettings(value: unknown): Settings {
  if (!isRecord(value)) {
    return DEFAULT_SETTINGS;
  }

  return clampPace({
    translationLanguage: readEnum(
      value['translationLanguage'],
      ['de', 'en', 'none'] as const,
      DEFAULT_SETTINGS.translationLanguage,
    ),
    theme: readEnum(value['theme'], ['auto', 'light', 'dark'] as const, DEFAULT_SETTINGS.theme),
    newPerDay: readNumber(value['newPerDay'], DEFAULT_SETTINGS.newPerDay),
    reviewsPerDay: readNumber(value['reviewsPerDay'], DEFAULT_SETTINGS.reviewsPerDay),
    sessionSize: readNumber(value['sessionSize'], DEFAULT_SETTINGS.sessionSize),
    disabledDeckIds: readStringArray(value['disabledDeckIds']),
    soundEffects: readBoolean(value['soundEffects'], DEFAULT_SETTINGS.soundEffects),
    speakSolution: readBoolean(value['speakSolution'], DEFAULT_SETTINGS.speakSolution),
    taskWeights: parseTaskWeights(value['taskWeights']),
    manualRating: readBoolean(value['manualRating'], DEFAULT_SETTINGS.manualRating),
  });
}

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** SM-2 ease range of version 1, which maps onto the FSRS difficulty range. */
const V1_EASE = { min: 1.3, max: 2.8, start: 2.5 } as const;
const FSRS_DIFFICULTY = { easiest: 1, hardest: 10 } as const;

/** Stability for a v1 card that was failed and had no interval yet. */
const V1_LEARNING_STABILITY_DAYS = 0.5;

/**
 * An SM-2 card becomes an FSRS card. At 90 % retention the interval is the
 * stability, so the interval carries over as is. A high ease (easy card)
 * becomes a low difficulty, linearly across both ranges.
 */
function migrateCardV1(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const { intervalDays, ease, phase, lapses, ...kept } = value;
  const days = readNumber(intervalDays, 0);
  const easeShare =
    (Math.min(V1_EASE.max, Math.max(V1_EASE.min, readNumber(ease, V1_EASE.start))) - V1_EASE.min) /
    (V1_EASE.max - V1_EASE.min);
  const answered = readCount(kept['reps']) > 0;

  return {
    ...kept,
    lapses,
    // A failed card with earlier lapses was a graduated card forgotten.
    phase: phase === 'learning' && readCount(lapses) > 0 ? 'relearning' : phase,
    stability: answered ? Math.max(days, V1_LEARNING_STABILITY_DAYS) : 0,
    difficulty: answered
      ? FSRS_DIFFICULTY.hardest - easeShare * (FSRS_DIFFICULTY.hardest - FSRS_DIFFICULTY.easiest)
      : 0,
    learningStep: 0,
    // A failed card is a card whose last answer was wrong.
    lastGrade: phase === 'learning' ? 'again' : null,
  };
}

/** Version 1 → 2: SM-2 cards (ease, interval) become FSRS cards (stability, difficulty). */
function migrateV1(raw: Record<string, unknown>): Record<string, unknown> {
  const cards = raw['cards'];

  if (!isRecord(cards)) {
    return raw;
  }

  return {
    ...raw,
    cards: Object.fromEntries(Object.entries(cards).map(([id, card]) => [id, migrateCardV1(card)])),
  };
}

/** Step `n` upgrades raw data from version `n` to `n + 1`. */
const MIGRATIONS: Readonly<Partial<Record<number, Migration>>> = { 1: migrateV1 };

/**
 * Applies upgrade steps `from` → `to`, one version at a time. Pure, so the
 * mechanics can be tested with fake steps before a real one exists.
 */
export function runMigrations(
  raw: Record<string, unknown>,
  from: number,
  to: number,
  steps: Readonly<Partial<Record<number, Migration>>>,
): Record<string, unknown> {
  let current = raw;

  for (let step = Math.max(1, Math.floor(from)); step < to; step += 1) {
    const upgrade = steps[step];

    if (upgrade !== undefined) {
      current = upgrade(current);
    }
  }

  return current;
}

/**
 * Upgrades raw stored data to the current shape before it is validated, so a
 * format change migrates instead of wiping progress: bump `STATE_VERSION` and
 * add the step to `MIGRATIONS`. Data from a newer build is parsed best effort;
 * the store refuses to write over it (see `storedVersion`).
 */
export function migrate(raw: Record<string, unknown>, version: number): Record<string, unknown> {
  return runMigrations(raw, version, STATE_VERSION, MIGRATIONS);
}

/**
 * Version of the stored main state, or null when nothing usable is stored.
 * A value above `STATE_VERSION` means a newer build (another tab, after an
 * update) wrote it, and this build must not overwrite it with an older shape.
 */
export function storedVersion(storage: StorageLike = defaultStorage()): number | null {
  let parsed: unknown;

  try {
    const raw = storage.getItem(STORAGE_KEY);

    if (raw === null) {
      return null;
    }

    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const version = parsed['version'];

  return typeof version === 'number' && Number.isFinite(version) ? version : null;
}

function isSpeciesId(value: unknown): value is SpeciesId {
  return SPECIES_IDS.some((known) => known === value);
}

/** State saved before the shop existed has no garden: it starts with the free species. */
function parseGarden(value: unknown): GardenState {
  if (!isRecord(value)) {
    return INITIAL_GARDEN;
  }

  const unlocked = Array.isArray(value['unlocked']) ? value['unlocked'].filter(isSpeciesId) : [];
  const species = isRecord(value['species']) ? value['species'] : {};

  return {
    unlocked: [...new Set<SpeciesId>([DEFAULT_SPECIES, ...unlocked])],
    spentXp: readCount(value['spentXp']),
    species: Object.fromEntries(Object.entries(species).filter((entry): entry is [string, SpeciesId] => isSpeciesId(entry[1]))),
  };
}

export function parseState(raw: string | null): PersistedState {
  if (raw === null) {
    return INITIAL_STATE;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return INITIAL_STATE;
  }

  if (!isRecord(parsed)) {
    return INITIAL_STATE;
  }

  const migrated = migrate(parsed, readNumber(parsed['version'], STATE_VERSION));

  return {
    version: STATE_VERSION,
    progress: parseProgress(migrated['progress']),
    cards: parseCards(migrated['cards']),
    settings: parseSettings(migrated['settings']),
    garden: parseGarden(migrated['garden']),
  };
}

/** Minimal storage surface, so tests can inject a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function memoryStorage(): StorageLike {
  const entries = new Map<string, string>();

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

/** Private mode and blocked storage both throw on write, so probe before use. */
export function defaultStorage(): StorageLike {
  try {
    const probeKey = '__norskinator_probe__';

    globalThis.localStorage.setItem(probeKey, '1');
    globalThis.localStorage.removeItem(probeKey);

    return globalThis.localStorage;
  } catch {
    return memoryStorage();
  }
}

export function loadState(storage: StorageLike = defaultStorage()): PersistedState {
  return parseState(storage.getItem(STORAGE_KEY));
}

export function saveState(state: PersistedState, storage: StorageLike = defaultStorage()): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage unavailable: losing a write beats crashing.
  }
}

export function clearState(storage: StorageLike = defaultStorage()): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

/**
 * The running session lives under its own key and without a version: it is
 * disposable, so an unreadable one is dropped instead of migrated, and the
 * main state keeps version 1. A separate key also means a tab without a
 * session never overwrites another tab's, and other tabs never reload their
 * progress just because this one moved to the next exercise.
 */
export const SESSION_STORAGE_KEY = 'norskinator.session';

/** A pending answer, stored by exercise id. */
export interface PersistedFeedback {
  readonly exerciseId: string;
  readonly given: string;
  readonly correct: boolean;
  readonly grade: Grade;
  readonly xpGained: number;
  readonly newBadges: readonly string[];
  readonly goalJustReached: boolean;
  readonly plantBefore: Plant;
  readonly plantAfter: Plant;
  readonly species: SpeciesId;
  readonly nextDue: number;
  readonly reps: number;
  /** Set while the right answer still waits for the learner's rating. */
  readonly ratingOptions: readonly RatingOption[] | null;
}

/** A running session, stored by exercise ids so it survives a reload. */
export interface PersistedSession {
  readonly queue: readonly string[];
  /** Task type of each queue entry, same positions as `queue`. */
  readonly kinds: readonly ExerciseKind[];
  readonly index: number;
  readonly options: readonly string[];
  readonly answered: number;
  readonly correct: number;
  readonly xpEarned: number;
  readonly bestCombo: number;
  readonly badgesEarned: readonly string[];
  readonly requeuedIds: readonly string[];
  readonly completed: boolean;
  readonly streakExtended: boolean;
  readonly seedsSown: number;
  readonly plantsGrown: number;
  readonly plantsWilted: number;
  readonly gardenStart: Readonly<Record<string, Plant>>;
  readonly startedAt: number;
  readonly deckIds: readonly string[];
  readonly mode: SessionMode;
  readonly feedback: PersistedFeedback | null;
}

const GRADES: readonly Grade[] = ['again', 'hard', 'good', 'easy'];

function isGrade(value: unknown): value is Grade {
  return GRADES.some((known) => known === value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function readPlant(value: unknown): Plant {
  if (!isRecord(value)) {
    return SEED;
  }

  return {
    stage: readEnum(value['stage'], PLANT_STAGES, 'seed'),
    wilted: readBoolean(value['wilted'], false),
    growth: Math.min(1, readNumber(value['growth'], 0)),
  };
}

function readPlants(value: unknown): Record<string, Plant> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value).map(([id, plant]) => [id, readPlant(plant)]));
}

function parseFeedback(value: unknown): PersistedFeedback | null {
  if (!isRecord(value)) {
    return null;
  }

  const exerciseId = value['exerciseId'];
  const given = value['given'];
  const correct = value['correct'];
  const grade = value['grade'];

  if (typeof exerciseId !== 'string' || typeof given !== 'string' || typeof correct !== 'boolean') {
    return null;
  }

  if (!isGrade(grade)) {
    return null;
  }

  return {
    exerciseId,
    given,
    correct,
    grade,
    xpGained: readCount(value['xpGained']),
    newBadges: readStringArray(value['newBadges']),
    goalJustReached: readBoolean(value['goalJustReached'], false),
    plantBefore: readPlant(value['plantBefore']),
    plantAfter: readPlant(value['plantAfter']),
    species: readEnum(value['species'], SPECIES_IDS, DEFAULT_SPECIES),
    nextDue: readNumber(value['nextDue'], 0),
    reps: readCount(value['reps']),
    ratingOptions: readRatingOptions(value['ratingOptions']),
  };
}

const RATED_GRADES: readonly RatingOption['grade'][] = ['hard', 'good', 'easy'];

function readRatingOptions(value: unknown): RatingOption[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const options: RatingOption[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const grade = readEnum(entry['grade'], RATED_GRADES, 'good');

    options.push({ grade, delayMs: Math.max(0, readNumber(entry['delayMs'], 0)) });
  }

  return options.length === 0 ? null : options;
}

/** Sessions saved before task types existed have no `kinds`: everything was multiple choice then. */
function readKinds(value: unknown, length: number): ExerciseKind[] {
  const stored: readonly unknown[] = Array.isArray(value) ? value : [];

  return Array.from({ length }, (_unused, position) =>
    readEnum(stored[position], EXERCISE_KINDS, 'multiple-choice'),
  );
}

/**
 * Returns `null` unless the stored session is structurally sound. Whether it
 * is still worth resuming (age, completion, exercises that still exist) is
 * decided when it is restored.
 */
export function parseSession(raw: string | null): PersistedSession | null {
  if (raw === null) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const queue = parsed['queue'];
  const index = parsed['index'];
  const startedAt = parsed['startedAt'];

  // Dropping single bad ids would shift every later position, so a damaged queue is rejected whole.
  if (!isStringArray(queue)) {
    return null;
  }

  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > queue.length) {
    return null;
  }

  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) {
    return null;
  }

  const answered = readCount(parsed['answered']);

  return {
    queue,
    kinds: readKinds(parsed['kinds'], queue.length),
    index,
    options: readStringArray(parsed['options']),
    answered,
    correct: Math.min(answered, readCount(parsed['correct'])),
    xpEarned: readCount(parsed['xpEarned']),
    bestCombo: readCount(parsed['bestCombo']),
    badgesEarned: readStringArray(parsed['badgesEarned']),
    requeuedIds: readStringArray(parsed['requeuedIds']),
    completed: readBoolean(parsed['completed'], false),
    streakExtended: readBoolean(parsed['streakExtended'], false),
    seedsSown: readCount(parsed['seedsSown']),
    plantsGrown: readCount(parsed['plantsGrown']),
    plantsWilted: readCount(parsed['plantsWilted']),
    gardenStart: readPlants(parsed['gardenStart']),
    startedAt,
    deckIds: readStringArray(parsed['deckIds']),
    mode: readEnum(parsed['mode'], SESSION_MODES, 'review'),
    feedback: parseFeedback(parsed['feedback']),
  };
}

export function loadSession(storage: StorageLike = defaultStorage()): PersistedSession | null {
  try {
    return parseSession(storage.getItem(SESSION_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveSession(session: PersistedSession, storage: StorageLike = defaultStorage()): void {
  try {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // A lost session snapshot only costs a resume after reload.
  }
}

export function clearSession(storage: StorageLike = defaultStorage()): void {
  try {
    storage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
