/**
 * Turns the raw Tatoeba exports in .cache/ into
 * src/decks/prepositions/tatoeba.json.
 *
 * Strategy: find bokmål sentences that contain exactly one occurrence of a
 * target preposition, blank it out, and offer distractors from the same
 * confusion group. Sentences with more than one candidate preposition are
 * rejected, so the gap is never ambiguous about *which* word was removed.
 *
 * The generated file is committed; CI and the published site never fetch.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONFUSION_GROUPS,
  PREPOSITIONS,
  isExcludedDistractor,
  isPreposition,
  type Preposition,
} from '../src/decks/prepositions/prepositions.ts';
import type {
  GeneratedBundle,
  GeneratedCredit,
  GeneratedItem,
  LanguageCode,
  Level,
} from '../src/core/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, '.cache');
const OUT_FILE = join(ROOT, 'src', 'decks', 'prepositions', 'tatoeba.json');

const BUNDLE_VERSION = 1;

const BUNDLE_LICENSE = 'CC BY 2.0 FR';

const CC0_LICENSE = 'CC0 1.0';

/** Upper bound per preposition; keeps the shipped bundle small enough for mobile. */
const MAX_PER_PREPOSITION = 90;

const MIN_WORDS = 4;
const MAX_WORDS = 14;
const OPTION_COUNT = 4;

/** Multi-word expressions whose parts must not become a gap on their own. */
const BLOCKED_PHRASES: readonly string[] = [
  'ved siden av',
  'i stedet for',
  'på grunn av',
  'i forhold til',
  'til tross for',
  'fra og med',
  'ut av',
  'av og til',
  'når det gjelder',
  'som om',
  'selv om',
  'om bare',
];

const BLOCKED_PATTERNS: readonly RegExp[] = BLOCKED_PHRASES.map(
  (phrase) => new RegExp(`(?<!\\p{L})${phrase}(?!\\p{L})`, 'u'),
);

/**
 * A subject pronoun right after «om», «til», «før» or «siden» means the word
 * opens a clause and is a conjunction: «Jeg vet ikke om du kommer», «Vent til
 * vi er ferdige». «det» and «den» are listed too, even though «om det» is
 * often prepositional — losing a few good sentences beats mining bad ones.
 */
const SUBJECT_PRONOUNS: ReadonlySet<string> = new Set([
  'jeg',
  'du',
  'han',
  'hun',
  'vi',
  'dere',
  'de',
  'det',
  'den',
  'man',
]);

const CONJUNCTION_CANDIDATES: ReadonlySet<Preposition> = new Set(['om', 'til', 'før', 'siden']);

/** «for» in front of these means "too" (for sent, for mye), not a preposition. */
const DEGREE_WORDS: ReadonlySet<string> = new Set([
  'sent',
  'seint',
  'tidlig',
  'mye',
  'lite',
  'mange',
  'få',
  'stor',
  'stort',
  'store',
  'liten',
  'lita',
  'lille',
  'små',
  'dyr',
  'dyrt',
  'dyre',
  'billig',
  'billige',
  'gammel',
  'gammelt',
  'gamle',
  'ung',
  'ungt',
  'unge',
  'lang',
  'langt',
  'lange',
  'kort',
  'korte',
  'varm',
  'varmt',
  'varme',
  'kald',
  'kaldt',
  'kalde',
  'vanskelig',
  'vanskelige',
  'lett',
  'lette',
  'tung',
  'tungt',
  'tunge',
  'høy',
  'høyt',
  'høye',
  'lav',
  'lavt',
  'lave',
  'fort',
  'raskt',
  'sakte',
  'ofte',
  'sjelden',
  'nær',
  'trøtt',
  'sliten',
  'opptatt',
  'travel',
  'full',
  'fullt',
  'svak',
  'sterk',
  'sterkt',
  'tykk',
  'tynn',
  'farlig',
  'dårlig',
  'god',
  'godt',
  'bra',
  'stille',
  'tett',
]);

interface CorpusSentence {
  readonly text: string;
  readonly author?: string;
}

interface Candidate extends CorpusSentence {
  readonly id: number;
  readonly answer: Preposition;
  readonly words: readonly string[];
}

interface TranslationCorpus {
  readonly lang: LanguageCode;
  readonly links: ReadonlyMap<number, number>;
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

function wordsOf(sentence: string): string[] {
  return sentence.toLowerCase().match(/[a-zæøåéèüö]+/g) ?? [];
}

function isUsableSentence(text: string): boolean {
  if (!/[.!?]$/.test(text)) {
    return false;
  }

  if (/["«»\d]/.test(text)) {
    return false;
  }

  const words = wordsOf(text);

  return words.length >= MIN_WORDS && words.length <= MAX_WORDS;
}

function containsBlockedPhrase(lower: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(lower));
}

/** «tre år siden» means "three years ago": «siden» is an adverb there. */
const TIME_SPANS: ReadonlySet<string> = new Set([
  'lenge',
  'tid',
  'stund',
  'år',
  'tiår',
  'måned',
  'måneder',
  'uke',
  'uker',
  'dag',
  'dager',
  'døgn',
  'time',
  'timer',
  'minutt',
  'minutter',
  'sekund',
  'sekunder',
]);

/** After these, «mot» and «under» are nouns: «hans mot» (courage), «et under» (miracle). */
const DETERMINERS: ReadonlySet<string> = new Set([
  'mitt',
  'ditt',
  'sitt',
  'hans',
  'hennes',
  'vårt',
  'deres',
  'et',
  'mye',
  'nok',
  'stort',
]);

/** «Det verste er over»: «over» as "finished" is an adverb. */
const COPULAS: ReadonlySet<string> = new Set(['er', 'var', 'blitt', 'være']);

/**
 * Filters out sentences where the target word is not used as a preposition:
 * conjunctions («om du vil», «…, for det lyver aldri»), adverbs («tre år
 * siden», «sett ham før», «det er over»), «for» meaning "too" («for sent») and
 * the nouns «mot» and «under».
 */
function isPrepositionalUse(
  text: string,
  words: readonly string[],
  answer: Preposition,
): boolean {
  const index = words.indexOf(answer);
  const previous = words[index - 1];
  const next = words[index + 1];
  const isSentenceFinal = next === undefined;

  if (CONJUNCTION_CANDIDATES.has(answer) && next !== undefined && SUBJECT_PRONOUNS.has(next)) {
    return false;
  }

  switch (answer) {
    case 'siden': {
      const followsFor = words.slice(0, index).includes('for');
      const followsTimeSpan = previous !== undefined && TIME_SPANS.has(previous);

      return !(isSentenceFinal || followsFor || followsTimeSpan);
    }

    case 'før':
      return !isSentenceFinal;

    case 'over':
      return !(isSentenceFinal && previous !== undefined && COPULAS.has(previous));

    case 'under':
    case 'mot':
      return previous === undefined || !DETERMINERS.has(previous);

    case 'for': {
      const isCausalConjunction = /,\s*for(?!\p{L})/iu.test(text);
      const meansToo = next !== undefined && DEGREE_WORDS.has(next);

      return !(isCausalConjunction || meansToo);
    }

    default:
      return true;
  }
}

/**
 * Returns the single target preposition of a sentence, or null when there is
 * none, when several different ones occur, or when it appears more than once —
 * in those cases the learner could not tell which slot to fill.
 */
function findSoleTarget(words: readonly string[]): Preposition | null {
  let found: Preposition | null = null;
  let occurrences = 0;

  for (const word of words) {
    if (!isPreposition(word)) {
      continue;
    }

    if (found !== null && word !== found) {
      return null;
    }

    found = word;
    occurrences += 1;
  }

  if (found === null || occurrences !== 1) {
    return null;
  }

  return found;
}

/** Mulberry32, seeded per sentence so regenerating the bundle is stable. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    const current = result[index]!;

    result[index] = result[swapWith]!;
    result[swapWith] = current;
  }

  return result;
}

function isAllowedDistractor(
  answer: Preposition,
  candidate: Preposition,
  present: ReadonlySet<string>,
): boolean {
  return candidate !== answer && !present.has(candidate) && !isExcludedDistractor(answer, candidate);
}

/**
 * Distractors come from the same confusion group as the answer: choosing
 * between "i / på / til / fra" teaches something, "i / blant / siden / foran"
 * gives the answer away. Prepositions already in the sentence are skipped,
 * since seeing one twice hints at the gap, and so are antonyms of the answer
 * (see EXCLUDED_DISTRACTORS).
 */
function pickDistractors(
  answer: Preposition,
  present: ReadonlySet<string>,
  random: () => number,
): Preposition[] {
  const pool = new Set<Preposition>();

  for (const group of CONFUSION_GROUPS) {
    if (!group.includes(answer)) {
      continue;
    }

    for (const candidate of group) {
      if (isAllowedDistractor(answer, candidate, present)) {
        pool.add(candidate);
      }
    }
  }

  if (pool.size < OPTION_COUNT - 1) {
    for (const candidate of PREPOSITIONS) {
      if (isAllowedDistractor(answer, candidate, present)) {
        pool.add(candidate);
      }
    }
  }

  return shuffle([...pool], random).slice(0, OPTION_COUNT - 1);
}

/** Replaces the single occurrence of `answer` with `___`, preserving the rest verbatim. */
function blankOut(sentence: string, answer: Preposition): string | null {
  const pattern = new RegExp(`(^|[^\\p{L}])(${answer})(?=[^\\p{L}]|$)`, 'iu');
  const match = pattern.exec(sentence);

  if (match === null) {
    return null;
  }

  const start = match.index + (match[1]?.length ?? 0);

  return `${sentence.slice(0, start)}___${sentence.slice(start + answer.length)}`;
}

function levelFor(words: readonly string[], answer: Preposition): Level {
  const common: readonly Preposition[] = ['i', 'på', 'til', 'med', 'for'];

  if (words.length <= 6 && common.includes(answer)) {
    return 1;
  }

  if (words.length <= 10) {
    return 2;
  }

  return 3;
}

async function readCache(name: string): Promise<string> {
  try {
    return await readFile(join(CACHE_DIR, name), 'utf8');
  } catch {
    throw new Error(`Missing .cache/${name}. Run "pnpm run fetch:data" first.`);
  }
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
  chosen: readonly Candidate[],
): Promise<TranslationCorpus> {
  const links = parseLinks(await readCache(`nob-${code}_links.tsv`));
  const wanted = new Set<number>();

  for (const candidate of chosen) {
    const translationId = links.get(candidate.id);

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

/** Author and licence of one sentence; the licence is left out when it is the bundle's. */
function attributionOf(
  id: number,
  sentence: CorpusSentence,
  cc0: ReadonlySet<number>,
): Omit<GeneratedCredit, 'id'> {
  return {
    ...(sentence.author === undefined ? {} : { author: sentence.author }),
    ...(cc0.has(id) ? { license: CC0_LICENSE } : {}),
  };
}

function collectCandidates(sentences: ReadonlyMap<number, CorpusSentence>): Candidate[] {
  const candidates: Candidate[] = [];
  const seenText = new Set<string>();

  for (const [id, sentence] of sentences) {
    const text = sentence.text;

    if (!isUsableSentence(text)) {
      continue;
    }

    const lower = text.toLowerCase();

    if (seenText.has(lower) || containsBlockedPhrase(lower)) {
      continue;
    }

    const words = wordsOf(text);
    const answer = findSoleTarget(words);

    if (answer === null || !isPrepositionalUse(text, words, answer)) {
      continue;
    }

    seenText.add(lower);
    candidates.push({ ...sentence, id, answer, words });
  }

  // Map iteration order follows insertion, not sentence id.
  return candidates.sort((left, right) => left.id - right.id);
}

/** Caps how many sentences each preposition contributes, so none dominates. */
function selectBalanced(candidates: readonly Candidate[]): Candidate[] {
  const perPreposition = new Map<Preposition, number>();
  const chosen: Candidate[] = [];

  for (const candidate of candidates) {
    const used = perPreposition.get(candidate.answer) ?? 0;

    if (used >= MAX_PER_PREPOSITION) {
      continue;
    }

    perPreposition.set(candidate.answer, used + 1);
    chosen.push(candidate);
  }

  return chosen;
}

function buildItem(
  candidate: Candidate,
  nobCc0: ReadonlySet<number>,
  corpora: readonly TranslationCorpus[],
): GeneratedItem | null {
  const prompt = blankOut(candidate.text, candidate.answer);

  if (prompt === null) {
    return null;
  }

  const random = createRandom(candidate.id);
  const distractors = pickDistractors(candidate.answer, new Set(candidate.words), random);

  if (distractors.length < OPTION_COUNT - 1) {
    return null;
  }

  const translations: Partial<Record<LanguageCode, string>> = {};
  const translationCredits: Partial<Record<LanguageCode, GeneratedCredit>> = {};

  for (const corpus of corpora) {
    const translationId = corpus.links.get(candidate.id);
    const translation = translationId === undefined ? undefined : corpus.sentences.get(translationId);

    if (translationId === undefined || translation === undefined) {
      continue;
    }

    translations[corpus.lang] = translation.text;
    translationCredits[corpus.lang] = { id: translationId, ...attributionOf(translationId, translation, corpus.cc0) };
  }

  const hasTranslations = Object.keys(translations).length > 0;

  return {
    id: `t${candidate.id}`,
    prompt,
    solution: candidate.text,
    answer: candidate.answer,
    options: shuffle([candidate.answer, ...distractors], random),
    level: levelFor(candidate.words, candidate.answer),
    tags: [candidate.answer],
    sourceId: candidate.id,
    ...attributionOf(candidate.id, candidate, nobCc0),
    ...(hasTranslations ? { translations, translationCredits } : {}),
  };
}

function summarize(items: readonly GeneratedItem[]): string {
  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.answer, (counts.get(item.answer) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([preposition, count]) => `${preposition}:${count}`)
    .join(' ');
}

async function main(): Promise<void> {
  const [nobTsv, nobCc0Tsv] = await Promise.all([
    readCache('nob_sentences_detailed.tsv'),
    readCache('nob_sentences_CC0.tsv'),
  ]);

  const chosen = selectBalanced(collectCandidates(parseSentences(nobTsv)));
  const nobCc0 = parseIds(nobCc0Tsv);
  const corpora = await Promise.all(
    TRANSLATION_LANGUAGES.map(({ lang, code }) => loadTranslationCorpus(lang, code, chosen)),
  );

  const items: GeneratedItem[] = [];

  for (const candidate of chosen) {
    const item = buildItem(candidate, nobCc0, corpora);

    if (item !== null) {
      items.push(item);
    }
  }

  const bundle: GeneratedBundle = {
    version: BUNDLE_VERSION,
    generatedAt: new Date().toISOString().slice(0, 10),
    license: BUNDLE_LICENSE,
    source: 'https://tatoeba.org',
    items,
  };

  await mkdir(dirname(OUT_FILE), { recursive: true });
  // Indented for readable diffs; Vite strips the whitespace when bundling.
  await writeFile(OUT_FILE, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');

  console.log(`wrote ${items.length} items -> ${OUT_FILE}`);
  console.log(summarize(items));
}

await main();
