/** Preposition deck: hand-written rules, rule templates and mined Tatoeba sentences. */
import type { Deck, Exercise, GeneratedItem, Level, MultipleChoiceExercise } from '../../core/types.ts';
import { CURATED_EXERCISES } from './curated.ts';
import { TEMPLATE_EXERCISES } from './templates.ts';

const DECK_ID = 'prepositions';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isLevel(value: unknown): value is Level {
  return value === 1 || value === 2 || value === 3;
}

/**
 * Only checks what would break a session: a level the scheduler cannot place
 * or a question without a choice. The rest is trusted to the generator.
 */
function isUsableItem(value: unknown): value is GeneratedItem {
  if (!isRecord(value)) {
    return false;
  }

  const options = value['options'];

  return isLevel(value['level']) && isUnknownArray(options) && options.length >= 2;
}

function readItems(bundle: unknown): readonly GeneratedItem[] {
  if (!isRecord(bundle) || typeof bundle['version'] !== 'number') {
    throw new Error('exercises.json: missing bundle version');
  }

  const items = bundle['items'];

  if (!isUnknownArray(items)) {
    throw new Error('exercises.json: items is not an array');
  }

  return items.filter(isUsableItem);
}

function toExercise(item: GeneratedItem): MultipleChoiceExercise {
  return {
    kind: 'multiple-choice',
    id: `p-${item.id}`,
    deckId: DECK_ID,
    prompt: item.prompt,
    solution: item.solution,
    answer: item.answer,
    options: item.options,
    level: item.level,
    tags: item.tags,
    source: {
      name: 'Tatoeba',
      id: String(item.sourceId),
      url: `https://tatoeba.org/en/sentences/show/${item.sourceId}`,
    },
    ...(item.translations === undefined ? {} : { translations: item.translations }),
  };
}

let cache: readonly Exercise[] | null = null;

export const prepositionDeck: Deck = {
  id: DECK_ID,
  title: 'Preposisjoner',
  shortTitle: 'Preposisjoner',
  description: 'i, på, til, av … Velg riktig preposisjon i setningen.',
  icon: '🧭',
  tagLabel: 'Preposisjon',
  async load() {
    if (cache !== null) {
      return cache;
    }

    // Dynamic import keeps the ~350 kB corpus out of the initial bundle.
    const bundle: unknown = (await import('./exercises.json')).default;

    cache = [...CURATED_EXERCISES, ...TEMPLATE_EXERCISES, ...readItems(bundle).map(toExercise)];

    return cache;
  },
};
