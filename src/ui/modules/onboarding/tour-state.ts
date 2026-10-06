/**
 * Whether the welcome tour was completed. Kept as UI state, apart from the
 * learner's progress: resetting progress should not replay the introduction.
 */

const TOUR_DONE_KEY = 'norskinator.tourDone';

export const TOUR_REQUESTED_EVENT = 'tour-requested';

export function tourDone(): boolean {
  try {
    return globalThis.localStorage.getItem(TOUR_DONE_KEY) === '1';
  } catch {
    // Without storage the tour would show on every visit; better to skip it.
    return true;
  }
}

export function markTourDone(): void {
  try {
    globalThis.localStorage.setItem(TOUR_DONE_KEY, '1');
  } catch {
    // The tour simply shows again next time.
  }
}

/** Asks the app shell to open the tour again, e.g. from settings. */
export function requestTour(source: EventTarget): void {
  source.dispatchEvent(new CustomEvent(TOUR_REQUESTED_EVENT, { bubbles: true, composed: true }));
}
