import { describe, expect, it, vi } from 'vitest';

import { INITIAL_PROGRESS } from './gamification.ts';
import { MAX_RESUME_AGE_MS } from './resume.ts';
import { Store } from './store.ts';
import { SESSION_STORAGE_KEY, type StorageLike } from './storage.ts';
import type { ClozeItem, DataItem, Deck } from './types.ts';

const NOW = Date.parse('2026-01-15T10:00:00Z');

function item(id: string): ClozeItem {
  return {
    dataKind: 'cloze',
    id,
    deckId: 'test',
    prompt: 'Jeg bor ___ Norge.',
    solution: 'Jeg bor i Norge.',
    answer: 'i',
    distractors: ['på', 'til', 'av'],
    level: 1,
    tags: ['i'],
  };
}

function deckFrom(id: string, load: () => Promise<readonly DataItem[]>): Deck {
  return {
    id,
    title: 'Test',
    shortTitle: 'Test',
    description: '',
    icon: '🧪',
    tagLabel: 'Tag',
    sources: [{ dataKind: 'cloze', tasks: ['multiple-choice'], load }],
  };
}

function deckOf(items: readonly DataItem[]): Deck {
  return deckFrom('test', async () => items);
}

function fakeStorage(): StorageLike {
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

interface Harness {
  readonly store: Store;
  readonly storage: StorageLike;
  setNow(value: number): void;
}

async function createHarness(exercises: readonly DataItem[]): Promise<Harness> {
  const storage = fakeStorage();
  let clock = NOW;

  const store = new Store({
    decks: [deckOf(exercises)],
    storage,
    now: () => clock,
    random: () => 0,
  });

  await store.init();

  return {
    store,
    storage,
    setNow: (value) => {
      clock = value;
    },
  };
}

/** A second store on the same storage, as after a page reload. */
async function reopen(storage: StorageLike, exercises: readonly DataItem[], now: number): Promise<Store> {
  const store = new Store({ decks: [deckOf(exercises)], storage, now: () => now, random: () => 0 });

  await store.init();

  return store;
}

/** A deck whose load resolves only when the test says so. */
function deferredDeck(id: string, exercises: readonly DataItem[]): { deck: Deck; resolve: () => void } {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    deck: deckFrom(id, async () => gate.then(() => exercises)),
    resolve: () => {
      release();
    },
  };
}

describe('Store', () => {
  it('stops saving when a newer app version has written the data', async () => {
    const { store, storage } = await createHarness([item('a')]);
    const newer = JSON.stringify({ version: 99, progress: { xp: 5000 }, futureField: true });

    storage.setItem('norskinator.state', newer);
    store.reloadFromStorage();
    store.startSession();
    store.answer('i');
    store.flush();

    expect(store.state.newerVersionStored).toBe(true);
    expect(storage.getItem('norskinator.state')).toBe(newer);
  });

  it('extends the streak only when the whole session is completed', async () => {
    const { store } = await createHarness([item('a')]);
    store.startSession();
    store.answer('i');

    expect(store.state.progress.streakDays).toBe(0);

    store.next();

    expect(store.state.session?.completed).toBe(true);
    expect(store.state.session?.streakExtended).toBe(true);
    expect(store.state.progress.streakDays).toBe(1);
  });

  it('does not count a quit session towards the streak', async () => {
    const { store } = await createHarness([item('a'), item('b')]);
    store.startSession();
    store.answer('i');
    store.next();
    store.endSession();

    expect(store.state.progress.streakDays).toBe(0);
    expect(store.state.progress.lastSessionDay).toBeNull();
  });

  it('loads decks and exposes their items', async () => {
    const { store } = await createHarness([item('a')]);

    expect(store.state.status).toBe('ready');
    expect(store.state.items).toHaveLength(1);
  });

  it('reports an error instead of throwing when a deck fails to load', async () => {
    const failing = deckFrom('test', async () => {
      throw new Error('nettverk nede');
    });

    const store = new Store({ decks: [failing], storage: fakeStorage(), now: () => NOW });
    await store.init();

    expect(store.state.status).toBe('error');
    expect(store.state.error).toBe('nettverk nede');
  });

  it('scores a correct answer, awards XP and advances', async () => {
    const { store } = await createHarness([item('a')]);
    store.startSession();

    store.answer('i');

    expect(store.state.feedback?.correct).toBe(true);
    expect(store.state.progress.xp).toBeGreaterThan(0);
    expect(store.state.cards['a']?.reps).toBe(1);

    store.next();

    expect(store.sessionFinished).toBe(true);
  });

  it('requeues an exercise only once, however often it is missed', async () => {
    const { store } = await createHarness([item('a')]);
    store.startSession();

    store.answer('på');
    store.next();
    store.answer('på');

    expect(store.state.feedback?.correct).toBe(false);
    expect(store.state.feedback?.grade).toBe('again');
    expect(store.state.session?.queue).toHaveLength(2);
    expect(store.state.cards['a']?.failures).toBe(2);

    store.next();

    expect(store.state.session?.completed).toBe(true);
  });

  it('requeues a wrong answer so the exercise comes back in the same session', async () => {
    const { store } = await createHarness([item('a')]);
    store.startSession();

    store.answer('på');

    expect(store.state.feedback?.correct).toBe(false);
    expect(store.state.session?.queue).toHaveLength(2);
    expect(store.state.progress.combo).toBe(0);
  });

  it('ignores a second answer while the feedback is showing', async () => {
    const { store } = await createHarness([item('a')]);
    store.startSession();

    store.answer('i');
    store.answer('på');

    expect(store.state.progress.totalAnswers).toBe(1);
  });

  it('shuffles options per presentation without losing any', async () => {
    const { store } = await createHarness([item('a')]);
    store.startSession();

    const shown = store.state.session?.options ?? [];

    expect([...shown].sort()).toEqual(['av', 'i', 'på', 'til']);
  });

  it('persists progress and restores it in a new store', async () => {
    vi.useFakeTimers();

    try {
      const { store, storage } = await createHarness([item('a')]);
      store.startSession();
      store.answer('i');
      store.flush();

      const revived = new Store({ decks: [deckOf([item('a')])], storage, now: () => NOW });

      expect(revived.state.progress.totalAnswers).toBe(1);
      expect(revived.state.cards['a']?.reps).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts an empty session when nothing is due', async () => {
    const { store, setNow } = await createHarness([item('a')]);
    store.startSession();
    store.answer('i');
    store.next();

    setNow(NOW + 60_000);
    store.startSession();

    expect(store.state.session).toBeNull();
  });

  it('clears progress and session on reset but keeps settings and the daily goal', async () => {
    const { store, storage } = await createHarness([item('a')]);
    store.updateSettings({ theme: 'dark', newPerSession: 5 });
    store.setDailyGoal(40);
    store.startSession();
    store.answer('i');

    store.resetProgress();

    expect(store.state.progress).toEqual({ ...INITIAL_PROGRESS, dailyGoal: 40 });
    expect(store.state.cards).toEqual({});
    expect(store.state.session).toBeNull();
    expect(store.state.settings.theme).toBe('dark');
    expect(storage.getItem(SESSION_STORAGE_KEY)).toBeNull();

    const revived = new Store({ decks: [deckOf([item('a')])], storage, now: () => NOW });

    expect(revived.state.progress.totalAnswers).toBe(0);
    expect(revived.state.progress.dailyGoal).toBe(40);
    expect(revived.state.settings.newPerSession).toBe(5);
  });

  it('ignores next() until the current exercise is answered', async () => {
    const { store } = await createHarness([item('a'), item('b')]);
    store.startSession();

    store.next();
    store.next();

    expect(store.state.session?.index).toBe(0);
    expect(store.sessionFinished).toBe(false);
  });

  it('clamps the number of new exercises per session', async () => {
    const { store } = await createHarness([item('a')]);

    store.updateSettings({ newPerSession: 999 });
    expect(store.state.settings.newPerSession).toBe(50);

    store.updateSettings({ newPerSession: -4.6 });
    expect(store.state.settings.newPerSession).toBe(0);
  });

  it('keeps the newest deck selection when an older load finishes last', async () => {
    const slow = deferredDeck('slow', [{ ...item('old'), deckId: 'slow' }]);
    const fast = deferredDeck('fast', [{ ...item('new'), deckId: 'fast' }]);
    const store = new Store({ decks: [slow.deck, fast.deck], storage: fakeStorage(), now: () => NOW });

    const firstLoad = store.init();
    store.updateSettings({ disabledDeckIds: ['slow'] });

    fast.resolve();
    await vi.waitFor(() => {
      expect(store.state.status).toBe('ready');
    });

    slow.resolve();
    await firstLoad;

    expect(store.state.items.map((entry) => entry.id)).toEqual(['new']);
  });

  it('keeps disabled decks disabled across a reset', async () => {
    const { store } = await createHarness([item('a')]);

    store.updateSettings({ disabledDeckIds: ['test'] });
    await vi.waitFor(() => {
      expect(store.state.status).toBe('ready');
    });

    store.resetProgress();

    expect(store.state.settings.disabledDeckIds).toEqual(['test']);
    expect(store.state.items).toHaveLength(0);
  });

  it('adopts progress written by another tab without ending the session', async () => {
    vi.useFakeTimers();

    try {
      const { store, storage } = await createHarness([item('a'), item('b')]);
      const otherTab = new Store({ decks: [deckOf([item('a')])], storage, now: () => NOW });

      store.startSession();
      otherTab.setDailyGoal(50);
      otherTab.flush();

      store.reloadFromStorage();

      expect(store.state.progress.dailyGoal).toBe(50);
      expect(store.state.session?.queue).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('notifies subscribers and stops after unsubscribe', async () => {
    const { store } = await createHarness([item('a')]);
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    store.startSession();

    expect(listener).toHaveBeenCalled();

    unsubscribe();
    const callsBefore = listener.mock.calls.length;
    store.answer('i');

    expect(listener.mock.calls).toHaveLength(callsBefore);
  });

  it('resumes a session after a reload with its exercise, index and feedback', async () => {
    const exercises = [item('a'), item('b'), item('c')];
    const { store, storage } = await createHarness(exercises);
    store.startSession();
    store.answer('i');
    store.next();
    store.answer('på');

    const before = store.state;
    const later = NOW + 60_000;
    const revived = await reopen(storage, exercises, later);

    expect(revived.state.session?.index).toBe(1);
    expect(revived.currentExercise?.id).toBe(store.currentExercise?.id);
    expect(revived.state.session?.queue.map((item) => item.id)).toEqual(
      before.session?.queue.map((item) => item.id),
    );
    expect(revived.state.session?.options).toEqual(before.session?.options);
    expect(revived.state.session?.requeuedIds).toEqual(before.session?.requeuedIds);
    expect(revived.state.session?.questionShownAt).toBe(later);
    expect(revived.state.feedback).toEqual(before.feedback);
  });

  it('grades a resumed exercise from the moment it is shown again', async () => {
    const exercises = [item('a'), item('b')];
    const { store, storage } = await createHarness(exercises);
    store.startSession();

    const revived = await reopen(storage, exercises, NOW + 3_600_000);
    revived.answer('i');

    expect(revived.state.feedback?.grade).not.toBe('hard');
  });

  it('drops a stale session instead of resuming it', async () => {
    const exercises = [item('a'), item('b')];
    const { store, storage } = await createHarness(exercises);
    store.startSession();
    store.answer('i');

    const revived = await reopen(storage, exercises, NOW + MAX_RESUME_AGE_MS + 1);

    expect(revived.state.session).toBeNull();
    expect(storage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('resumes without exercises that were removed in the meantime', async () => {
    const exercises = [item('a'), item('b'), item('c')];
    const { store, storage } = await createHarness(exercises);
    store.startSession();
    store.answer('i');
    store.next();

    const order = store.state.session?.queue.map((item) => item.id) ?? [];
    const remaining = exercises.filter((item) => item.id !== order[0]);
    const revived = await reopen(storage, remaining, NOW);

    expect(revived.state.session?.queue.map((item) => item.id)).toEqual(order.slice(1));
    expect(revived.state.session?.index).toBe(0);
    expect(revived.currentExercise?.id).toBe(order[1]);
  });

  it('forgets the session once it is ended or completed', async () => {
    const exercises = [item('a'), item('b')];
    const { store, storage } = await createHarness(exercises);

    store.startSession();
    store.endSession();

    expect(storage.getItem(SESSION_STORAGE_KEY)).toBeNull();

    store.startSession();
    store.answer('i');
    store.next();
    store.answer('i');
    store.next();

    expect(store.state.session?.completed).toBe(true);
    expect(storage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect((await reopen(storage, exercises, NOW)).state.session).toBeNull();
  });

  it('does not adopt the session of another tab', async () => {
    const exercises = [item('a'), item('b')];
    const { store, storage } = await createHarness(exercises);
    const otherTab = await reopen(storage, exercises, NOW);

    otherTab.startSession();
    otherTab.answer('i');
    store.reloadFromStorage();

    expect(store.state.session).toBeNull();
    expect(storage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
  });
});
