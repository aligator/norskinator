/** Preposition vocabulary shared by the app and the data generator. */

export const PREPOSITIONS = [
  'i',
  'på',
  'til',
  'fra',
  'av',
  'med',
  'om',
  'for',
  'hos',
  'ved',
  'etter',
  'før',
  'under',
  'over',
  'mot',
  'gjennom',
  'mellom',
  'uten',
  'bak',
  'foran',
  'blant',
  'siden',
] as const;

export type Preposition = (typeof PREPOSITIONS)[number];

export function isPreposition(value: string): value is Preposition {
  return (PREPOSITIONS as readonly string[]).includes(value);
}

/**
 * Which prepositions are offered as wrong answers for a given correct one.
 * Grouping by real confusion beats random distractors: picking between
 * "i / på / til / fra" teaches something, "i / blant / siden / foran" does not.
 */
export const CONFUSION_GROUPS: readonly (readonly Preposition[])[] = [
  ['i', 'på', 'til', 'fra', 'hos', 'ved'],
  ['til', 'mot', 'fra', 'gjennom'],
  ['av', 'med', 'om', 'for', 'uten'],
  ['etter', 'før', 'under', 'siden', 'om', 'i'],
  ['over', 'under', 'bak', 'foran', 'mellom', 'blant'],
];

/**
 * Pairs that never serve as each other's distractor. Antonyms usually fit the
 * same slot grammatically ("Vi spiser før/etter jobb"), so offering one as the
 * wrong answer makes the gap a coin toss. The same goes for «om»/«med»
 * («snakke om/med noen») and for before/during/since around an event
 * («før/under/i krigen», «før/siden frokost»).
 */
export const EXCLUDED_DISTRACTORS: readonly (readonly [Preposition, Preposition])[] = [
  ['før', 'etter'],
  ['over', 'under'],
  ['bak', 'foran'],
  ['til', 'fra'],
  ['fra', 'mot'],
  ['med', 'uten'],
  ['om', 'med'],
  ['før', 'siden'],
  ['før', 'under'],
  ['etter', 'under'],
  ['i', 'under'],
];

export function isExcludedDistractor(answer: Preposition, candidate: Preposition): boolean {
  return EXCLUDED_DISTRACTORS.some(
    ([left, right]) =>
      (left === answer && right === candidate) || (left === candidate && right === answer),
  );
}

/** Short glosses used in the deck overview. */
export const GLOSSES: Readonly<Record<Preposition, string>> = {
  i: 'in (sted/tid)',
  på: 'on, at (flate, institusjon)',
  til: 'to (retning, mottaker)',
  fra: 'from (utgangspunkt)',
  av: 'of, off, by (del, årsak)',
  med: 'with (følge, middel)',
  om: 'about, in (tema, framtid)',
  for: 'for (hensikt, mottaker)',
  hos: 'at someone’s (person)',
  ved: 'by, next to (nærhet)',
  etter: 'after (tid, rekkefølge)',
  før: 'before (tid)',
  under: 'under, during (plassering, varighet)',
  over: 'over, above (plassering, mengde)',
  mot: 'towards, against (retning)',
  gjennom: 'through (bevegelse)',
  mellom: 'between (to størrelser)',
  uten: 'without (mangel)',
  bak: 'behind (plassering)',
  foran: 'in front of (plassering)',
  blant: 'among (flere)',
  siden: 'since (tid)',
};
