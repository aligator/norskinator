/**
 * Turns the raw Tatoeba exports in .cache/ into
 * src/decks/word-order/tatoeba.json.
 *
 * Strategy: short bokmål sentences become word tiles. The rule they train
 * (inversion, subordinate clause, …) is guessed from signal words; the review
 * in `overrides.json` corrects it, lists other correct orders and drops
 * sentences whose words can be ordered too many ways.
 */
import { join } from 'node:path';

import type { GeneratedItem, Level } from '../src/core/types.ts';
import type { WordOrderRule } from '../src/decks/word-order/categories.ts';
import {
  ROOT,
  creditsFor,
  loadNorwegian,
  loadTranslations,
  writeBundle,
  type CorpusSentence,
  type NorwegianCorpus,
  type TranslationCorpus,
} from './tatoeba.ts';

const OUT_FILE = join(ROOT, 'src', 'decks', 'word-order', 'tatoeba.json');

/** Fewer words leave nothing to order; more turn tapping into a chore on a phone. */
const MIN_TILES = 4;
const MAX_TILES = 9;

/** Per rule, so plain subject-first sentences do not crowd out the interesting ones. */
const MAX_PER_RULE = 130;

const SUBORDINATORS: ReadonlySet<string> = new Set([
  'at',
  'fordi',
  'hvis',
  'når',
  'som',
  'om',
  'mens',
  'siden',
  'selv',
  'enda',
  'dersom',
]);

/** Fronted words after which the verb comes before the subject. */
const FRONTED_ADVERBIALS: ReadonlySet<string> = new Set([
  'i',
  'på',
  'nå',
  'da',
  'så',
  'derfor',
  'kanskje',
  'heldigvis',
  'dessverre',
  'etterpå',
  'plutselig',
  'hver',
  'neste',
  'her',
  'der',
  'hjemme',
  'ofte',
  'alltid',
  'aldri',
  'snart',
  'endelig',
  'egentlig',
  'vanligvis',
  'om',
  'etter',
  'før',
  'til',
  'med',
  'uten',
]);

/** Adverbs whose place in the clause is the classic learner mistake. */
const SENTENCE_ADVERBS: ReadonlySet<string> = new Set(['ikke', 'aldri', 'alltid', 'ofte', 'også', 'bare', 'kanskje', 'allerede']);

const SUBJECT_PRONOUNS: ReadonlySet<string> = new Set(['jeg', 'du', 'han', 'hun', 'vi', 'dere', 'de', 'det', 'den', 'man']);

interface Candidate extends CorpusSentence {
  readonly id: number;
  readonly tiles: readonly string[];
  readonly rule: WordOrderRule;
}

/** Splits a sentence into words; null when a token is not a plain word (numbers, quotes, symbols). */
function tokenize(text: string): string[] | null {
  const tokens = text
    .split(/\s+/u)
    .map((token) => token.replace(/^[,.!?;:]+|[,.!?;:]+$/gu, ''))
    .filter((token) => token !== '');

  return tokens.every((token) => /^[\p{L}][\p{L}'-]*$/u.test(token)) ? tokens : null;
}

/**
 * Counts how often each word stands capitalised inside a sentence: «Tom» is
 * a name and keeps its capital as the first tile, «Jeg» does not.
 */
function countMidSentenceCase(sentences: ReadonlyMap<number, CorpusSentence>): Map<string, number> {
  const balance = new Map<string, number>();

  for (const sentence of sentences.values()) {
    const tokens = tokenize(sentence.text) ?? [];

    for (const token of tokens.slice(1)) {
      const key = token.toLowerCase();
      const capitalised = token !== key;

      balance.set(key, (balance.get(key) ?? 0) + (capitalised ? 1 : -1));
    }
  }

  return balance;
}

function guessRule(text: string, words: readonly string[]): WordOrderRule {
  const first = words[0] ?? '';

  if (text.endsWith('?')) {
    return 'spørsmål';
  }

  if (words.some((word) => SUBORDINATORS.has(word))) {
    return 'leddsetning';
  }

  if (FRONTED_ADVERBIALS.has(first) && !SUBJECT_PRONOUNS.has(first)) {
    return 'inversjon';
  }

  if (words.slice(1).some((word) => SENTENCE_ADVERBS.has(word))) {
    return 'setningsadverb';
  }

  return 'rett ordstilling';
}

function collectCandidates(sentences: ReadonlyMap<number, CorpusSentence>): Candidate[] {
  const caseBalance = countMidSentenceCase(sentences);
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  for (const [id, sentence] of sentences) {
    const text = sentence.text;
    const tokens = /[.!?]$/u.test(text) ? tokenize(text) : null;

    if (tokens === null || tokens.length < MIN_TILES || tokens.length > MAX_TILES) {
      continue;
    }

    const words = tokens.map((token) => token.toLowerCase());
    const key = words.join(' ');

    if (seen.has(key)) {
      continue;
    }

    const [first = '', ...rest] = tokens;
    const keepsCapital = (caseBalance.get(first.toLowerCase()) ?? 0) > 0;

    seen.add(key);
    candidates.push({
      ...sentence,
      id,
      tiles: [keepsCapital ? first : first.toLowerCase(), ...rest],
      rule: guessRule(text, words),
    });
  }

  // Map iteration order follows insertion, not sentence id.
  return candidates.sort((left, right) => left.id - right.id);
}

/** Only sentences someone already translated: the translation is the prompt. */
function selectBalanced(candidates: readonly Candidate[], corpora: readonly TranslationCorpus[]): Candidate[] {
  const perRule = new Map<WordOrderRule, number>();
  const chosen: Candidate[] = [];

  for (const candidate of candidates) {
    const used = perRule.get(candidate.rule) ?? 0;
    const translated = corpora.some((corpus) => corpus.links.has(candidate.id));

    if (used >= MAX_PER_RULE || !translated) {
      continue;
    }

    perRule.set(candidate.rule, used + 1);
    chosen.push(candidate);
  }

  return chosen;
}

function levelFor(candidate: Candidate): Level {
  if (candidate.tiles.length <= 5) {
    return 1;
  }

  return candidate.tiles.length <= 7 ? 2 : 3;
}

function buildItem(candidate: Candidate, norwegian: NorwegianCorpus, corpora: readonly TranslationCorpus[]): GeneratedItem {
  return {
    id: `t${candidate.id}`,
    prompt: candidate.text,
    solution: candidate.text,
    answer: candidate.text,
    tiles: candidate.tiles,
    level: levelFor(candidate),
    tags: [candidate.rule],
    ...creditsFor(candidate.id, candidate, norwegian, corpora),
  };
}

function summarize(items: readonly GeneratedItem[]): string {
  const counts = new Map<string, number>();

  for (const item of items) {
    const rule = item.tags[0] ?? '?';

    counts.set(rule, (counts.get(rule) ?? 0) + 1);
  }

  return [...counts.entries()].map(([rule, count]) => `${rule}:${count}`).join(' ');
}

async function main(): Promise<void> {
  const norwegian = await loadNorwegian();
  const candidates = collectCandidates(norwegian.sentences);

  // Whether a sentence has a translation decides the selection, so every candidate's is read.
  const corpora = await loadTranslations(candidates.map((candidate) => candidate.id));
  const chosen = selectBalanced(candidates, corpora);
  const items = chosen.map((candidate) => buildItem(candidate, norwegian, corpora));

  await writeBundle(OUT_FILE, items);

  console.log(`wrote ${items.length} items -> ${OUT_FILE}`);
  console.log(summarize(items));
}

await main();
