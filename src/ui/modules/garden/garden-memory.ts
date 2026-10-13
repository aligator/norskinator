/**
 * Where the learner was in the garden, so coming back from a plant's page
 * shows the same deck and the same page of its bed. Lives for the page visit
 * only.
 */
export const gardenMemory = {
  deckId: null as string | null,
  /** Bed page to reopen once, set when a plant's page is opened. */
  deckPage: null as number | null,
  /** Last plant opened, highlighted in the bed. */
  visitedId: null as string | null,
};
