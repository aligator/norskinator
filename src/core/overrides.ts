/**
 * Reviewed corrections layered over deck content without touching the source
 * data: extra accepted answers, missing translations, corrected tags,
 * explanations and items to drop. Keyed by item id, so an override survives
 * regenerating a corpus.
 */
import {
  LANGUAGE_CODES,
  type ClozeItem,
  type LanguageCode,
  type TranslationCredit,
  type Translations,
} from './types.ts';

export interface ItemOverride {
  /** More words that fill the gap correctly. */
  readonly alternatives?: readonly string[];
  /** The item is broken (ungrammatical, wrong answer) and is not shown. */
  readonly exclude?: boolean;
  /** Written by AI where the source had none; credited as machine translations. */
  readonly translations?: Translations;
  /** Replaces the item's tags when non-empty, e.g. when the generator guessed the wrong category. */
  readonly tags?: readonly string[];
  /** Didactic note shown after answering; replaces the item's own. */
  readonly explanation?: string;
  /** Why the override exists, for whoever reviews it next. */
  readonly note?: string;
}

export type Overrides = ReadonlyMap<string, ItemOverride>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function readWords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
}

function readTranslations(value: unknown): Translations {
  const translations: Partial<Record<LanguageCode, string>> = {};

  if (!isRecord(value)) {
    return translations;
  }

  for (const lang of LANGUAGE_CODES) {
    const text = value[lang];

    if (typeof text === 'string' && text.trim() !== '') {
      translations[lang] = text;
    }
  }

  return translations;
}

/** Reads `{ items: { [id]: override } }`; malformed entries are skipped, not fatal. */
export function parseOverrides(raw: unknown): Overrides {
  const overrides = new Map<string, ItemOverride>();
  const items = isRecord(raw) ? raw['items'] : undefined;

  if (!isRecord(items)) {
    return overrides;
  }

  for (const [id, entry] of Object.entries(items)) {
    if (!isRecord(entry)) {
      continue;
    }

    const note = entry['note'];
    const explanation = entry['explanation'];

    overrides.set(id, {
      alternatives: readWords(entry['alternatives']),
      exclude: entry['exclude'] === true,
      translations: readTranslations(entry['translations']),
      tags: readWords(entry['tags']),
      ...(typeof explanation === 'string' && explanation.trim() !== '' ? { explanation } : {}),
      ...(typeof note === 'string' ? { note } : {}),
    });
  }

  return overrides;
}

function applyOverride(item: ClozeItem, override: ItemOverride): ClozeItem {
  const existing = item.translations ?? {};
  const translations: Partial<Record<LanguageCode, string>> = { ...existing };
  const machineCredits: Partial<Record<LanguageCode, TranslationCredit>> = {};

  // A translation from the source always wins over a generated one.
  for (const lang of LANGUAGE_CODES) {
    const generated = override.translations?.[lang];

    if (existing[lang] === undefined && generated !== undefined) {
      translations[lang] = generated;
      machineCredits[lang] = { machine: true };
    }
  }

  const alternatives = [...new Set([...(item.alternatives ?? []), ...(override.alternatives ?? [])])].filter(
    (word) => word !== item.answer,
  );
  const hasMachineCredits = Object.keys(machineCredits).length > 0;
  const tags = override.tags ?? [];

  return {
    ...item,
    ...(alternatives.length > 0 ? { alternatives } : {}),
    ...(Object.keys(translations).length > 0 ? { translations } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(override.explanation === undefined ? {} : { explanation: override.explanation }),
    ...(item.source !== undefined && hasMachineCredits
      ? { source: { ...item.source, translations: { ...item.source.translations, ...machineCredits } } }
      : {}),
  };
}

export function applyOverrides(items: readonly ClozeItem[], overrides: Overrides): ClozeItem[] {
  return items.flatMap((item) => {
    const override = overrides.get(item.id);

    if (override === undefined) {
      return [item];
    }

    return override.exclude === true ? [] : [applyOverride(item, override)];
  });
}
