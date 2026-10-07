/**
 * Shared reading of the Tatoeba exports in .cache/ for the exercise
 * generators: Norwegian sentences with their authors, the linked German and
 * English translations, licences, and writing the bundle a deck loads.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { GeneratedBundle, GeneratedCredit, GeneratedItem, LanguageCode } from '../src/core/types.ts';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const CACHE_DIR = join(ROOT, '.cache');

const BUNDLE_VERSION = 1;

const BUNDLE_LICENSE = 'CC BY 2.0 FR';

const CC0_LICENSE = 'CC0 1.0';

const MIN_WORDS = 4;
const MAX_WORDS = 14;

export interface CorpusSentence {
  readonly text: string;
  readonly author?: string;
}

export interface TranslationCorpus {
  readonly lang: LanguageCode;
  readonly links: ReadonlyMap<number, number>;
  readonly sentences: ReadonlyMap<number, CorpusSentence>;
  readonly cc0: ReadonlySet<number>;
}

export interface NorwegianCorpus {
  readonly sentences: ReadonlyMap<number, CorpusSentence>;
  readonly cc0: ReadonlySet<number>;
}

/** Tatoeba export prefix per translation language, in the order they are stored. */
const TRANSLATION_LANGUAGES: readonly { readonly lang: LanguageCode; readonly code: string }[] = [
  { lang: 'de', code: 'deu' },
  { lang: 'en', code: 'eng' },
];

/** Tatoeba writes `\N` when a sentence's contributor account no longer exists. */
const UNKNOWN_AUTHOR = '\\N';

function idOf(line: string): number {
  const tab = line.indexOf('\t');

  return tab < 0 ? Number.NaN : Number(line.slice(0, tab));
}

/** Parses one row of a `*_sentences_detailed.tsv`: id, lang, text, username, added, modified. */
function parseSentence(line: string): CorpusSentence | null {
  const [, , text, author] = line.split('\t');
  const trimmed = text?.trim() ?? '';

  if (trimmed === '') {
    return null;
  }

  if (author === undefined || author === '' || author === UNKNOWN_AUTHOR) {
    return { text: trimmed };
  }

  return { text: trimmed, author };
}

function parseSentences(tsv: string): Map<number, CorpusSentence> {
  const sentences = new Map<number, CorpusSentence>();

  for (const line of tsv.split('\n')) {
    const id = idOf(line);
    const sentence = parseSentence(line);

    if (Number.isFinite(id) && sentence !== null) {
      sentences.set(id, sentence);
    }
  }

  return sentences;
}

function parseIds(tsv: string): Set<number> {
  const ids = new Set<number>();

  for (const line of tsv.split('\n')) {
    const id = idOf(line);

    if (Number.isFinite(id)) {
      ids.add(id);
    }
  }

  return ids;
}

/**
 * Tatoeba lists every translation of a sentence; the first one is the oldest
 * and usually the most literal, so later paraphrases are dropped.
 */
function parseLinks(tsv: string): Map<number, number> {
  const links = new Map<number, number>();

  for (const line of tsv.split('\n')) {
    const tab = line.indexOf('\t');

    if (tab < 0) {
      continue;
    }

    const from = Number(line.slice(0, tab));
    const to = Number(line.slice(tab + 1));

    if (Number.isFinite(from) && Number.isFinite(to) && !links.has(from)) {
      links.set(from, to);
    }
  }

  return links;
}

export function wordsOf(sentence: string): string[] {
  return sentence.toLowerCase().match(/[a-zæøåéèüö]+/g) ?? [];
}

/** A complete, short sentence without quotes or numbers, which make poor gaps. */
export function isUsableSentence(text: string): boolean {
  if (!/[.!?]$/.test(text)) {
    return false;
  }

  if (/["«»\d]/.test(text)) {
    return false;
  }

  const words = wordsOf(text);

  return words.length >= MIN_WORDS && words.length <= MAX_WORDS;
}

/** Mulberry32, seeded per sentence so regenerating the bundle is stable. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    const current = result[index]!;

    result[index] = result[swapWith]!;
    result[swapWith] = current;
  }

  return result;
}

/**
 * Replaces the single whole-word occurrence of `word` with `___`, keeping the
 * rest verbatim. Case-insensitive, so a sentence-initial word is found too.
 */
export function blankOut(sentence: string, word: string): string | null {
  const pattern = new RegExp(`(^|[^\\p{L}])(${word})(?=[^\\p{L}]|$)`, 'iu');
  const match = pattern.exec(sentence);

  if (match === null) {
    return null;
  }

  const start = match.index + (match[1]?.length ?? 0);

  return `${sentence.slice(0, start)}___${sentence.slice(start + word.length)}`;
}

async function readCache(name: string): Promise<string> {
  try {
    return await readFile(join(CACHE_DIR, name), 'utf8');
  } catch {
    throw new Error(`Missing .cache/${name}. Run "pnpm run fetch:data" first.`);
  }
}

export async function loadNorwegian(): Promise<NorwegianCorpus> {
  const [nobTsv, nobCc0Tsv] = await Promise.all([
    readCache('nob_sentences_detailed.tsv'),
    readCache('nob_sentences_CC0.tsv'),
  ]);

  return { sentences: parseSentences(nobTsv), cc0: parseIds(nobCc0Tsv) };
}

/**
 * Reads only the requested ids: the German and English exports are tens of
 * megabytes and we need a few thousand lines of them.
 */
async function readWantedSentences(
  file: string,
  wanted: ReadonlySet<number>,
): Promise<Map<number, CorpusSentence>> {
  const sentences = new Map<number, CorpusSentence>();

  if (wanted.size === 0) {
    return sentences;
  }

  const tsv = await readCache(file);

  for (const line of tsv.split('\n')) {
    const id = idOf(line);

    if (!wanted.has(id)) {
      continue;
    }

    const sentence = parseSentence(line);

    if (sentence !== null) {
      sentences.set(id, sentence);
    }
  }

  return sentences;
}

async function loadTranslationCorpus(
  lang: LanguageCode,
  code: string,
  norwegianIds: readonly number[],
): Promise<TranslationCorpus> {
  const links = parseLinks(await readCache(`nob-${code}_links.tsv`));
  const wanted = new Set<number>();

  for (const id of norwegianIds) {
    const translationId = links.get(id);

    if (translationId !== undefined) {
      wanted.add(translationId);
    }
  }

  const [sentences, cc0Tsv] = await Promise.all([
    readWantedSentences(`${code}_sentences_detailed.tsv`, wanted),
    readCache(`${code}_sentences_CC0.tsv`),
  ]);

  return { lang, links, sentences, cc0: parseIds(cc0Tsv) };
}

/** German and English translations of the given Norwegian sentences. */
export function loadTranslations(norwegianIds: readonly number[]): Promise<TranslationCorpus[]> {
  return Promise.all(
    TRANSLATION_LANGUAGES.map(({ lang, code }) => loadTranslationCorpus(lang, code, norwegianIds)),
  );
}

/** Author and licence of one sentence; the licence is left out when it is the bundle's. */
export function attributionOf(
  id: number,
  sentence: CorpusSentence,
  cc0: ReadonlySet<number>,
): Omit<GeneratedCredit, 'id'> {
  return {
    ...(sentence.author === undefined ? {} : { author: sentence.author }),
    ...(cc0.has(id) ? { license: CC0_LICENSE } : {}),
  };
}

/** The bundle fields that credit a Norwegian sentence and carry its translations. */
export function creditsFor(
  id: number,
  sentence: CorpusSentence,
  norwegian: NorwegianCorpus,
  corpora: readonly TranslationCorpus[],
): Pick<GeneratedItem, 'sourceId' | 'author' | 'license' | 'translations' | 'translationCredits'> {
  const translations: Partial<Record<LanguageCode, string>> = {};
  const translationCredits: Partial<Record<LanguageCode, GeneratedCredit>> = {};

  for (const corpus of corpora) {
    const translationId = corpus.links.get(id);
    const translation = translationId === undefined ? undefined : corpus.sentences.get(translationId);

    if (translationId === undefined || translation === undefined) {
      continue;
    }

    translations[corpus.lang] = translation.text;
    translationCredits[corpus.lang] = { id: translationId, ...attributionOf(translationId, translation, corpus.cc0) };
  }

  const hasTranslations = Object.keys(translations).length > 0;

  return {
    sourceId: id,
    ...attributionOf(id, sentence, norwegian.cc0),
    ...(hasTranslations ? { translations, translationCredits } : {}),
  };
}

export async function writeBundle(outFile: string, items: readonly GeneratedItem[]): Promise<void> {
  const bundle: GeneratedBundle = {
    version: BUNDLE_VERSION,
    generatedAt: new Date().toISOString().slice(0, 10),
    license: BUNDLE_LICENSE,
    source: 'https://tatoeba.org',
    items,
  };

  await mkdir(dirname(outFile), { recursive: true });
  // Indented for readable diffs; Vite strips the whitespace when bundling.
  await writeFile(outFile, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
}
