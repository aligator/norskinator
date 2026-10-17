/**
 * Runs a task as soon as a Norwegian voice exists. Browsers such as Chrome
 * load their voices asynchronously, so the first request often comes too early.
 * Pure over a small voice source, so it works on fakes in tests.
 */

export interface VoiceSource<Voice> {
  /** The best Norwegian voice loaded right now, if any. */
  find(): Voice | null;
  /** Calls `callback` whenever the voice list changes; returns the unsubscribe function. */
  subscribe(callback: () => void): () => void;
}

export interface VoiceWaiter<Voice> {
  /** Runs `task` now, or once a voice has loaded. A newer call replaces a waiting one. */
  whenReady(task: (voice: Voice) => void): void;
  /** Drops the waiting task, if any. */
  cancel(): void;
}

export function createVoiceWaiter<Voice>(source: VoiceSource<Voice>): VoiceWaiter<Voice> {
  let unsubscribe: (() => void) | null = null;

  const cancel = (): void => {
    unsubscribe?.();
    unsubscribe = null;
  };

  const whenReady = (task: (voice: Voice) => void): void => {
    cancel();

    const voice = source.find();

    if (voice !== null) {
      task(voice);
      return;
    }

    unsubscribe = source.subscribe(() => {
      const loaded = source.find();

      // The list can change without a Norwegian voice in it; keep waiting for the next change.
      if (loaded === null) {
        return;
      }

      cancel();
      task(loaded);
    });
  };

  return { whenReady, cancel };
}
