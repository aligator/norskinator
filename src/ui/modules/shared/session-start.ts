/** Starting a session from anywhere outside the practice module. */
import { store } from './store.ts';

export const SESSION_STARTED_EVENT = 'session-started';

/**
 * Starts a session and, if there was anything to practise, tells the page so it
 * can switch to the practice route.
 */
export function startSession(source: EventTarget, deckIds?: readonly string[], newPerSession?: number): void {
  store.startSession(deckIds, newPerSession === undefined ? {} : { newPerSession });

  if (store.state.session !== null) {
    source.dispatchEvent(new CustomEvent(SESSION_STARTED_EVENT, { bubbles: true, composed: true }));
  }
}
