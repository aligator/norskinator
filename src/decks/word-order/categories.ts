/**
 * Word-order rules of the word-order deck: the first tag of every item, so
 * the statistics group by them.
 */
export const WORD_ORDER_RULES = [
  'rett ordstilling',
  'inversjon',
  'spørsmål',
  'leddsetning',
  'setningsadverb',
] as const;

export type WordOrderRule = (typeof WORD_ORDER_RULES)[number];
