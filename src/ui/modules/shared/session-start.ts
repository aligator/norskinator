/** Starting a session from anywhere outside the practice module. */
import { store } from './store.ts';

export const SESSION_STARTED_EVENT = 'session-started';

/** What a practice session (nothing due, no room for seeds) gives and what it doesn't. */
export const PRACTICE_NOTE = 'Lite penger, og plantene vokser ikke.';

/** Feedback on a practice answer, in place of what happened to the plant. */
export const PRACTICE_PLANT_NEWS = 'Fri øving – planten står stille';

/**
 * Starts a session and, if there was anything to practise, tells the page so it
 * can switch to the practice route.
 */
export function startSession(source: EventTarget, deckIds?: readonly string[]): void {
  store.startSession(deckIds);

  if (store.state.session !== null) {
    source.dispatchEvent(new CustomEvent(SESSION_STARTED_EVENT, { bubbles: true, composed: true }));
  }
}
