/**
 * Turns the raw Tatoeba exports in .cache/ into
 * src/decks/adjectives/tatoeba.json.
 *
 * Strategy: find bokmål sentences with exactly one form of exactly one
 * adjective from the lexicon, blank it out and offer the adjective's other
 * forms (plus typical slips like «billigt») as wrong choices. The dictionary
 * form is shown as a hint, so the task is the inflection, not the word.
 *
 * The form category (en/ei-ord, et-ord, flertall, bestemt form) is guessed
 * from the word in front; the review in `overrides.json` corrects it where
 * the guess is wrong, and drops sentences where the word is not an adjective.
 */
import { join } from 'node:path';

import type { GeneratedItem, Level } from '../src/core/types.ts';
import type { FormCategory } from '../src/decks/adjectives/categories.ts';
import { ADJECTIVES, formsOf, type Adjective } from '../src/decks/adjectives/lexicon.ts';
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

const OUT_FILE = join(ROOT, 'src', 'decks', 'adjectives', 'tatoeba.json');

/** Keeps one common word («god», «ny») from filling the deck. */
const MAX_PER_ADJECTIVE = 16;

/** And within one adjective, no single form crowds out the others. */
const MAX_PER_FORM = 7;

/**
 * The base form is the most common one in running text; without a lower cap
 * it would be the answer in most items, and "leave the hint as it is" would
 * win most of them.
 */
const MAX_BASE_PER_ADJECTIVE = 4;

/** Words after which an adjective is in the definite form: «den store», «mitt nye». */
const DEFINITE_MARKERS: ReadonlySet<string> = new Set([
  'den',
  'det',
  'de',
  'denne',
  'dette',
  'disse',
  'min',
  'mitt',
  'mine',
  'din',
  'ditt',
  'dine',
  'sin',
  'sitt',
  'sine',
  'hans',
  'hennes',
  'vår',
  'vårt',
  'våre',
  'deres',
  'samme',
]);

/** Words after which a neuter noun phrase follows: «et stort», «noe nytt». */
const NEUTER_MARKERS: ReadonlySet<string> = new Set(['et', 'ett', 'noe', 'intet', 'hvert', 'mitt', 'ditt', 'sitt', 'vårt']);

interface Candidate extends CorpusSentence {
  readonly id: number;
  readonly adjective: Adjective;
  /** The form as it stands in the sentence, lower-cased. */
  readonly form: string;
  readonly words: readonly string[];
}

const LEMMAS_BY_FORM: ReadonlyMap<string, readonly Adjective[]> = (() => {
  const index = new Map<string, Adjective[]>();

  for (const adjective of ADJECTIVES) {
    for (const form of formsOf(adjective)) {
      index.set(form, [...(index.get(form) ?? []), adjective]);
    }
  }

  return index;
})();

/** The single adjective form in a sentence, or null when there is none, several, or it is ambiguous. */
function findSoleForm(words: readonly string[]): { adjective: Adjective; form: string } | null {
  let found: { adjective: Adjective; form: string } | null = null;

  for (const word of words) {
    const lemmas = LEMMAS_BY_FORM.get(word);

    if (lemmas === undefined) {
      continue;
    }

    const adjective = lemmas[0];

    if (found !== null || lemmas.length !== 1 || adjective === undefined) {
      return null;
    }

    found = { adjective, form: word };
  }

  return found;
}

/** A first guess from the word in front; the review fixes predicative and adverbial uses. */
function guessCategory(candidate: Candidate): FormCategory {
  const { adjective, form, words } = candidate;
  const previous = words[words.indexOf(form) - 1] ?? '';

  if (form === adjective.definite) {
    return 'bestemt form';
  }

  if (form === adjective.plural || adjective.pluralVariants?.includes(form) === true) {
    if (DEFINITE_MARKERS.has(previous) || previous.endsWith('s')) {
      return 'bestemt form';
    }

    if (form !== adjective.base) {
      return 'flertall';
    }
  }

  if (form === adjective.neuter && (form !== adjective.base || NEUTER_MARKERS.has(previous))) {
    return 'et-ord';
  }

  return 'en/ei-ord';
}

/** «Tom» is a name, not «tom»; a capital letter also hides sentence-initial adjectives, which is rare. */
function isCapitalized(text: string, form: string): boolean {
  const match = new RegExp(`(?<!\\p{L})${form}(?!\\p{L})`, 'iu').exec(text);
  const first = match?.[0][0];

  return first !== undefined && first !== first.toLowerCase();
}

function collectCandidates(sentences: ReadonlyMap<number, CorpusSentence>): Candidate[] {
  const candidates: Candidate[] = [];
  const seenText = new Set<string>();

  for (const [id, sentence] of sentences) {
    const lower = sentence.text.toLowerCase();

    if (!isUsableSentence(sentence.text) || seenText.has(lower)) {
      continue;
    }

    const words = wordsOf(sentence.text);
    const found = findSoleForm(words);

    if (found === null || isCapitalized(sentence.text, found.form)) {
      continue;
    }

    seenText.add(lower);
    candidates.push({ ...sentence, id, ...found, words });
  }

  // Map iteration order follows insertion, not sentence id.
  return candidates.sort((left, right) => left.id - right.id);
}

function selectBalanced(candidates: readonly Candidate[]): Candidate[] {
  const perAdjective = new Map<string, number>();
  const perForm = new Map<string, number>();
  const chosen: Candidate[] = [];

  for (const candidate of candidates) {
    const adjectiveCount = perAdjective.get(candidate.adjective.base) ?? 0;
    const formCount = perForm.get(candidate.form) ?? 0;
    const formCap = candidate.form === candidate.adjective.base ? MAX_BASE_PER_ADJECTIVE : MAX_PER_FORM;

    if (adjectiveCount >= MAX_PER_ADJECTIVE || formCount >= formCap) {
      continue;
    }

    perAdjective.set(candidate.adjective.base, adjectiveCount + 1);
    perForm.set(candidate.form, formCount + 1);
    chosen.push(candidate);
  }

  return chosen;
}

/** Spelling rules and irregular words are harder than plain -t/-e, long sentences harder than short ones. */
function levelFor(candidate: Candidate): Level {
  const tricky = candidate.adjective.kind !== 'regelmessig';

  if (!tricky && candidate.words.length <= 7) {
    return 1;
  }

  if (tricky && candidate.words.length > 9) {
    return 3;
  }

  return 2;
}

/** Forms that are also correct in this slot: «blåe» next to «blå», «liten» next to «lita». */
function alternativesFor(candidate: Candidate): string[] {
  const { adjective, form } = candidate;
  const pluralSpellings = [adjective.plural, ...(adjective.pluralVariants ?? [])];

  if (pluralSpellings.includes(form)) {
    return pluralSpellings.filter((spelling) => spelling !== form);
  }

  if (form === adjective.feminine) {
    return [adjective.base];
  }

  return [];
}

function buildItem(
  candidate: Candidate,
  norwegian: NorwegianCorpus,
  corpora: readonly TranslationCorpus[],
): GeneratedItem | null {
  const prompt = blankOut(candidate.text, candidate.form);

  if (prompt === null) {
    return null;
  }

  const random = createRandom(candidate.id);
  const alternatives = alternativesFor(candidate);
  const accepted = new Set([candidate.form, ...alternatives]);
  const distractors = [...formsOf(candidate.adjective), ...(candidate.adjective.errors ?? [])].filter(
    (option) => !accepted.has(option),
  );

  return {
    id: `t${candidate.id}`,
    prompt,
    solution: candidate.text,
    hint: candidate.adjective.base,
    answer: candidate.form,
    options: shuffle([candidate.form, ...new Set(distractors)], random),
    level: levelFor(candidate),
    tags: [guessCategory(candidate), `type:${candidate.adjective.kind}`],
    ...(alternatives.length > 0 ? { alternatives } : {}),
    ...creditsFor(candidate.id, candidate, norwegian, corpora),
  };
}

function summarize(items: readonly GeneratedItem[]): string {
  const counts = new Map<string, number>();

  for (const item of items) {
    const category = item.tags[0] ?? '?';

    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return [...counts.entries()].map(([category, count]) => `${category}:${count}`).join(' ');
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
