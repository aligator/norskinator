/**
 * Adjectives the generator looks for in Tatoeba sentences, with every form.
 *
 * Only words whose forms are rarely anything else are listed: «kort» (card),
 * «lys» (light), «rund» (rundt = around) or «hel» (helt = completely) would
 * mostly find nouns and adverbs. Indeclinable adjectives (moderne, stille)
 * are left out, since there is no form to choose.
 */

/** How an adjective inflects; becomes the `type:` tag. */
export type AdjectiveKind =
  | 'regelmessig'
  | 'ig-lig'
  | 'sk'
  | 'ender-på-t'
  | 'dobbel-konsonant'
  | 'vokal'
  | 'sammentrekning'
  | 'uregelmessig';

export interface Adjective {
  /** Dictionary form: masculine and feminine singular indefinite. */
  readonly base: string;
  /** Neuter singular indefinite. */
  readonly neuter: string;
  /** Plural, and definite singular unless `definite` says otherwise. */
  readonly plural: string;
  /** Only «liten»: «den lille gutten». */
  readonly definite?: string;
  /** Only «liten»: «ei lita jente». */
  readonly feminine?: string;
  /** Other accepted spellings of the plural, e.g. «blåe». */
  readonly pluralVariants?: readonly string[];
  /** Typical learner mistakes, offered as wrong choices. */
  readonly errors?: readonly string[];
  readonly kind: AdjectiveKind;
}

function regular(base: string, kind: AdjectiveKind = 'regelmessig'): Adjective {
  return { base, neuter: `${base}t`, plural: `${base}e`, kind };
}

/** -ig, -lig and most -sk adjectives take no -t; «billigt» is the classic slip. */
function noNeuterT(base: string, kind: AdjectiveKind): Adjective {
  return { base, neuter: base, plural: `${base}e`, errors: [`${base}t`], kind };
}

export const ADJECTIVES: readonly Adjective[] = [
  ...['stor', 'fin', 'varm', 'kald', 'rød', 'pen', 'dyr', 'rik', 'sterk', 'svak', 'ren', 'myk', 'tung', 'høy', 'lav']
    .map((base) => regular(base)),
  ...['bred', 'gul', 'brun', 'sur', 'ung', 'flink', 'klok', 'mørk', 'skarp', 'slank', 'smal', 'nær', 'fjern', 'syk', 'hard']
    .map((base) => regular(base)),
  ...['billig', 'vanskelig', 'viktig', 'lykkelig', 'farlig', 'hyggelig', 'ledig', 'deilig', 'nydelig', 'dårlig']
    .map((base) => noNeuterT(base, 'ig-lig')),
  ...['rolig', 'kjedelig', 'riktig'].map((base) => noNeuterT(base, 'ig-lig')),
  ...['norsk', 'tysk', 'engelsk', 'svensk', 'dansk', 'fransk', 'praktisk', 'typisk', 'politisk', 'elektrisk']
    .map((base) => noNeuterT(base, 'sk')),
  // These -sk adjectives do take -t: «et raskt svar».
  regular('rask', 'sk'),
  regular('fersk', 'sk'),
  regular('frisk', 'sk'),
  { base: 'svart', neuter: 'svart', plural: 'svarte', errors: ['svartt'], kind: 'ender-på-t' },
  { base: 'lett', neuter: 'lett', plural: 'lette', errors: ['lettt'], kind: 'ender-på-t' },
  { base: 'sint', neuter: 'sint', plural: 'sinte', errors: ['sintt'], kind: 'ender-på-t' },
  { base: 'trøtt', neuter: 'trøtt', plural: 'trøtte', errors: ['trøttt'], kind: 'ender-på-t' },
  { base: 'smart', neuter: 'smart', plural: 'smarte', errors: ['smartt'], kind: 'ender-på-t' },
  { base: 'hvit', neuter: 'hvitt', plural: 'hvite', kind: 'ender-på-t' },
  { base: 'søt', neuter: 'søtt', plural: 'søte', kind: 'ender-på-t' },
  { base: 'våt', neuter: 'vått', plural: 'våte', kind: 'ender-på-t' },
  { base: 'grønn', neuter: 'grønt', plural: 'grønne', errors: ['grønnt'], kind: 'dobbel-konsonant' },
  { base: 'tynn', neuter: 'tynt', plural: 'tynne', errors: ['tynnt'], kind: 'dobbel-konsonant' },
  { base: 'sann', neuter: 'sant', plural: 'sanne', errors: ['sannt'], kind: 'dobbel-konsonant' },
  { base: 'trygg', neuter: 'trygt', plural: 'trygge', errors: ['tryggt'], kind: 'dobbel-konsonant' },
  { base: 'stygg', neuter: 'stygt', plural: 'stygge', errors: ['styggt'], kind: 'dobbel-konsonant' },
  { base: 'tykk', neuter: 'tykt', plural: 'tykke', errors: ['tykkt'], kind: 'dobbel-konsonant' },
  { base: 'snill', neuter: 'snilt', plural: 'snille', errors: ['snillt'], kind: 'dobbel-konsonant' },
  { base: 'full', neuter: 'fullt', plural: 'fulle', errors: ['fult'], kind: 'dobbel-konsonant' },
  { base: 'tom', neuter: 'tomt', plural: 'tomme', errors: ['tome'], kind: 'dobbel-konsonant' },
  { base: 'dum', neuter: 'dumt', plural: 'dumme', errors: ['dume'], kind: 'dobbel-konsonant' },
  { base: 'morsom', neuter: 'morsomt', plural: 'morsomme', errors: ['morsome'], kind: 'dobbel-konsonant' },
  { base: 'ensom', neuter: 'ensomt', plural: 'ensomme', errors: ['ensome'], kind: 'dobbel-konsonant' },
  { base: 'ny', neuter: 'nytt', plural: 'nye', errors: ['nyt'], kind: 'vokal' },
  { base: 'fri', neuter: 'fritt', plural: 'frie', errors: ['frit'], kind: 'vokal' },
  { base: 'blå', neuter: 'blått', plural: 'blå', pluralVariants: ['blåe'], errors: ['blåt'], kind: 'vokal' },
  { base: 'grå', neuter: 'grått', plural: 'grå', pluralVariants: ['gråe'], errors: ['gråt'], kind: 'vokal' },
  { base: 'gammel', neuter: 'gammelt', plural: 'gamle', errors: ['gammele'], kind: 'sammentrekning' },
  { base: 'enkel', neuter: 'enkelt', plural: 'enkle', errors: ['enkele'], kind: 'sammentrekning' },
  { base: 'vakker', neuter: 'vakkert', plural: 'vakre', errors: ['vakkere'], kind: 'sammentrekning' },
  { base: 'sikker', neuter: 'sikkert', plural: 'sikre', errors: ['sikkere'], kind: 'sammentrekning' },
  { base: 'mager', neuter: 'magert', plural: 'magre', errors: ['magere'], kind: 'sammentrekning' },
  { base: 'sulten', neuter: 'sultent', plural: 'sultne', errors: ['sultene'], kind: 'sammentrekning' },
  { base: 'åpen', neuter: 'åpent', plural: 'åpne', errors: ['åpene'], kind: 'sammentrekning' },
  { base: 'sliten', neuter: 'slitent', plural: 'slitne', errors: ['slitene'], kind: 'sammentrekning' },
  { base: 'skitten', neuter: 'skittent', plural: 'skitne', errors: ['skittene'], kind: 'sammentrekning' },
  { base: 'travel', neuter: 'travelt', plural: 'travle', errors: ['travele'], kind: 'sammentrekning' },
  { base: 'god', neuter: 'godt', plural: 'gode', kind: 'uregelmessig' },
  { base: 'glad', neuter: 'glad', plural: 'glade', errors: ['gladt'], kind: 'uregelmessig' },
  { base: 'liten', neuter: 'lite', plural: 'små', definite: 'lille', feminine: 'lita', errors: ['litet'], kind: 'uregelmessig' },
  { base: 'annen', neuter: 'annet', plural: 'andre', errors: ['annene'], kind: 'uregelmessig' },
  { base: 'egen', neuter: 'eget', plural: 'egne', errors: ['egene'], kind: 'uregelmessig' },
];

/** Every form of an adjective, the main spelling first. */
export function formsOf(adjective: Adjective): string[] {
  const forms = [
    adjective.base,
    adjective.feminine,
    adjective.neuter,
    adjective.plural,
    adjective.definite,
    ...(adjective.pluralVariants ?? []),
  ];

  return [...new Set(forms.filter((form) => form !== undefined))];
}
