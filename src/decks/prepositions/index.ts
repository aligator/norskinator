/** Preposition deck: hand-written rules, rule templates and mined Tatoeba sentences. */
import {
  LANGUAGE_CODES,
  type Deck,
  type Exercise,
  type GeneratedCredit,
  type GeneratedItem,
  type LanguageCode,
  type Level,
  type MultipleChoiceExercise,
  type SourceCredit,
} from '../../core/types.ts';
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

interface Bundle {
  readonly license: string;
  readonly items: readonly GeneratedItem[];
}

function readBundle(bundle: unknown): Bundle {
  if (!isRecord(bundle) || typeof bundle['version'] !== 'number') {
    throw new Error('exercises.json: missing bundle version');
  }

  const items = bundle['items'];
  const license = bundle['license'];

  if (!isUnknownArray(items)) {
    throw new Error('exercises.json: items is not an array');
  }

  if (typeof license !== 'string') {
    throw new Error('exercises.json: missing licence');
  }

  return { license, items: items.filter(isUsableItem) };
}

function tatoebaCredit(credit: GeneratedCredit, defaultLicense: string): SourceCredit {
  return {
    id: String(credit.id),
    url: `https://tatoeba.org/en/sentences/show/${credit.id}`,
    ...(credit.author === undefined ? {} : { author: credit.author }),
    license: credit.license ?? defaultLicense,
  };
}

function translationCredits(
  item: GeneratedItem,
  defaultLicense: string,
): Partial<Record<LanguageCode, SourceCredit>> {
  const credits: Partial<Record<LanguageCode, SourceCredit>> = {};

  for (const lang of LANGUAGE_CODES) {
    const credit = item.translationCredits?.[lang];

    if (credit !== undefined) {
      credits[lang] = tatoebaCredit(credit, defaultLicense);
    }
  }

  return credits;
}

function toExercise(item: GeneratedItem, defaultLicense: string): MultipleChoiceExercise {
  const sentenceCredit: GeneratedCredit = {
    id: item.sourceId,
    ...(item.author === undefined ? {} : { author: item.author }),
    ...(item.license === undefined ? {} : { license: item.license }),
  };

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
      ...tatoebaCredit(sentenceCredit, defaultLicense),
      translations: translationCredits(item, defaultLicense),
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

    // Dynamic import keeps the ~430 kB corpus out of the initial bundle.
    const bundle: unknown = (await import('./exercises.json')).default;

    const { license, items } = readBundle(bundle);

    cache = [...CURATED_EXERCISES, ...TEMPLATE_EXERCISES, ...items.map((item) => toExercise(item, license))];

    return cache;
  },
};
