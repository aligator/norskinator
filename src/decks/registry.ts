/**
 * Deck registry — the single place to add a topic.
 *
 * A new deck is a folder under `src/decks/` exporting a {@link Deck}; add it
 * to `DECKS` and it shows up in the UI, the scheduler and the statistics
 * without further changes.
 */
import type { Deck } from '../core/types.ts';
import { adjectiveDeck } from './adjectives/index.ts';
import { prepositionDeck } from './prepositions/index.ts';

export const DECKS: readonly Deck[] = [prepositionDeck, adjectiveDeck];

export function deckById(id: string): Deck | undefined {
  return DECKS.find((deck) => deck.id === id);
}
