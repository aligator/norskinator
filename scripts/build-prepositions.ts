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
import { join } from 'node:path';

import {
  CONFUSION_GROUPS,
  PREPOSITIONS,
  isExcludedDistractor,
  isPreposition,
  type Preposition,
} from '../src/decks/prepositions/prepositions.ts';
import type { GeneratedItem, Level } from '../src/core/types.ts';
import {
  ROOT,
  blankOut,
  createRandom,
  creditsFor,
  isUsableSentence,
  loadNorwegian,
  loadTranslations,
  shuffle,
  wordsOf,
  writeBundle,
  type CorpusSentence,
  type NorwegianCorpus,
  type TranslationCorpus,
} from './tatoeba.ts';

const OUT_FILE = join(ROOT, 'src', 'decks', 'prepositions', 'tatoeba.json');

/** Upper bound per preposition; keeps the shipped bundle small enough for mobile. */
const MAX_PER_PREPOSITION = 90;

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

interface Candidate extends CorpusSentence {
  readonly id: number;
  readonly answer: Preposition;
  readonly words: readonly string[];
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
  norwegian: NorwegianCorpus,
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

  return {
    id: `t${candidate.id}`,
    prompt,
    solution: candidate.text,
    answer: candidate.answer,
    options: shuffle([candidate.answer, ...distractors], random),
    level: levelFor(candidate.words, candidate.answer),
    tags: [candidate.answer],
    ...creditsFor(candidate.id, candidate, norwegian, corpora),
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
  const norwegian = await loadNorwegian();
  const chosen = selectBalanced(collectCandidates(norwegian.sentences));
  const corpora = await loadTranslations(chosen.map((candidate) => candidate.id));

  const items: GeneratedItem[] = [];

  for (const candidate of chosen) {
    const item = buildItem(candidate, norwegian, corpora);

    if (item !== null) {
      items.push(item);
    }
  }

  await writeBundle(OUT_FILE, items);

  console.log(`wrote ${items.length} items -> ${OUT_FILE}`);
  console.log(summarize(items));
}

await main();
