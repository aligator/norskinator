/**
 * Turns a generated Tatoeba bundle (`pnpm run data`) into cloze items of one
 * deck, with every sentence and translation credited, and layers the deck's
 * reviewed `overrides.json` on top.
 *
 * The bundle and overrides are passed in as loaders, so each deck keeps its own
 * dynamic `import()` and its corpus stays a separate chunk.
 */
import { applyOverrides, parseOverrides, type Overrides } from '../core/overrides.ts';
import {
  LANGUAGE_CODES,
  type DataItem,
  type GeneratedCredit,
  type GeneratedItem,
  type LanguageCode,
  type Level,
  type SourceCredit,
  type TranslationCredit,
} from '../core/types.ts';

export interface TatoebaDeckIds {
  readonly deckId: string;
  /**
   * Prepended to the bundle's item ids, e.g. `p-` turns `t342063` into
   * `p-t342063`. Part of the permanent SRS key: never change it once shipped.
   */
  readonly idPrefix: string;
}

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

  const choices = value['options'] ?? value['tiles'];

  return isLevel(value['level']) && isUnknownArray(choices) && choices.length >= 2;
}

export interface TatoebaBundle {
  readonly license: string;
  readonly items: readonly GeneratedItem[];
}

/** Validates a generated bundle; the review scripts read it the same way the app does. */
export function readTatoebaBundle(bundle: unknown): TatoebaBundle {
  if (!isRecord(bundle) || typeof bundle['version'] !== 'number') {
    throw new Error('tatoeba.json: missing bundle version');
  }

  const items = bundle['items'];
  const license = bundle['license'];

  if (!isUnknownArray(items)) {
    throw new Error('tatoeba.json: items is not an array');
  }

  if (typeof license !== 'string') {
    throw new Error('tatoeba.json: missing licence');
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
): Partial<Record<LanguageCode, TranslationCredit>> {
  const credits: Partial<Record<LanguageCode, TranslationCredit>> = {};

  for (const lang of LANGUAGE_CODES) {
    const credit = item.translationCredits?.[lang];

    if (credit !== undefined) {
      credits[lang] = tatoebaCredit(credit, defaultLicense);
    }
  }

  return credits;
}

/** A bundle with `tiles` holds whole sentences to order; one with `options` holds cloze items. */
function toItem(item: GeneratedItem, defaultLicense: string, ids: TatoebaDeckIds): DataItem {
  const sentenceCredit: GeneratedCredit = {
    id: item.sourceId,
    ...(item.author === undefined ? {} : { author: item.author }),
    ...(item.license === undefined ? {} : { license: item.license }),
  };
  const alternatives = (item.alternatives ?? []).filter((word) => word !== item.answer);
  const content = {
    id: `${ids.idPrefix}${item.id}`,
    deckId: ids.deckId,
    prompt: item.prompt,
    solution: item.solution,
    answer: item.answer,
    level: item.level,
    tags: item.tags,
    source: {
      name: 'Tatoeba',
      ...tatoebaCredit(sentenceCredit, defaultLicense),
      translations: translationCredits(item, defaultLicense),
    },
    ...(item.hint === undefined ? {} : { hint: item.hint }),
    ...(alternatives.length > 0 ? { alternatives } : {}),
    ...(item.translations === undefined ? {} : { translations: item.translations }),
  };

  if (item.tiles !== undefined) {
    return { ...content, dataKind: 'sentence', tiles: item.tiles };
  }

  return {
    ...content,
    dataKind: 'cloze',
    distractors: (item.options ?? []).filter((option) => option !== item.answer),
  };
}

/** Maps a raw `tatoeba.json` to items; throws when the bundle itself is malformed. */
export function tatoebaItems(bundle: unknown, ids: TatoebaDeckIds): DataItem[] {
  const { license, items } = readTatoebaBundle(bundle);

  return items.map((item) => toItem(item, license, ids));
}

/**
 * A pool loader for a deck's Tatoeba items with its overrides applied. The
 * overrides are parsed once and reused when the deck is loaded again.
 */
export function reviewedTatoebaLoader(
  ids: TatoebaDeckIds,
  loadBundle: () => Promise<unknown>,
  loadOverrides: () => Promise<unknown>,
): () => Promise<DataItem[]> {
  let overrides: Promise<Overrides> | null = null;

  return async () => {
    overrides ??= loadOverrides().then(parseOverrides);

    const [bundle, reviewed] = await Promise.all([loadBundle(), overrides]);

    return applyOverrides(tatoebaItems(bundle, ids), reviewed);
  };
}
