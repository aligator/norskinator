import { describe, expect, it } from 'vitest';

import { createVoiceWaiter } from '../../../../src/ui/modules/audio/voice-waiter.ts';

/** Chrome's behavior: no voice until the browser has loaded them, then the list changes. */
function fakeSource() {
  const listeners = new Set<() => void>();
  let voice: string | null = null;

  return {
    find: () => voice,
    subscribe: (callback: () => void) => {
      listeners.add(callback);

      return () => {
        listeners.delete(callback);
      };
    },
    listenerCount: () => listeners.size,
    /** The voice list changed; `next` is the Norwegian voice in it, if any. */
    change(next: string | null): void {
      voice = next;

      for (const listener of [...listeners]) {
        listener();
      }
    },
  };
}

describe('createVoiceWaiter', () => {
  it('runs the task at once when a voice is already loaded', () => {
    const source = fakeSource();
    const waiter = createVoiceWaiter(source);
    const heard: string[] = [];

    source.change('nb-NO');
    waiter.whenReady((voice) => heard.push(voice));

    expect(heard).toEqual(['nb-NO']);
    expect(source.listenerCount()).toBe(0);
  });

  it('runs the task once the voice arrives after the call', () => {
    const source = fakeSource();
    const waiter = createVoiceWaiter(source);
    const heard: string[] = [];

    waiter.whenReady((voice) => heard.push(voice));

    expect(heard).toEqual([]);

    source.change('nb-NO');
    source.change('nb-NO');

    expect(heard).toEqual(['nb-NO']);
    expect(source.listenerCount()).toBe(0);
  });

  it('keeps waiting when the list changes without a Norwegian voice', () => {
    const source = fakeSource();
    const waiter = createVoiceWaiter(source);
    const heard: string[] = [];

    waiter.whenReady((voice) => heard.push(voice));
    source.change(null);

    expect(heard).toEqual([]);

    source.change('nb-NO');

    expect(heard).toEqual(['nb-NO']);
  });

  it('lets a newer task replace one that still waits', () => {
    const source = fakeSource();
    const waiter = createVoiceWaiter(source);
    const heard: string[] = [];

    waiter.whenReady(() => heard.push('first'));
    waiter.whenReady(() => heard.push('second'));
    source.change('nb-NO');

    expect(heard).toEqual(['second']);
  });

  it('drops a waiting task when cancelled', () => {
    const source = fakeSource();
    const waiter = createVoiceWaiter(source);
    const heard: string[] = [];

    waiter.whenReady((voice) => heard.push(voice));
    waiter.cancel();
    source.change('nb-NO');

    expect(heard).toEqual([]);
    expect(source.listenerCount()).toBe(0);
  });
});
