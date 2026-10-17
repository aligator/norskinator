/**
 * Adjectives the generator looks for in Tatoeba sentences, with every form.
 *
 * Only words whose forms are rarely anything else are listed: «kort» (card),
 * «lys» (light), «rund» (rundt = around) or «hel» (helt = completely) would
 * mostly find nouns and adverbs. Indeclinable adjectives (moderne, stille)
 * are left out, since there is no form to choose.
 */

/** How an adjective inflects; becomes the `type:` tag. */
export enum AdjectiveKind {
  Regelmessig = 'regelmessig',
  IgLig = 'ig-lig',
  Sk = 'sk',
  EnderPaT = 'ender-på-t',
  DobbelKonsonant = 'dobbel-konsonant',
  Vokal = 'vokal',
  Sammentrekning = 'sammentrekning',
  Uregelmessig = 'uregelmessig',
}

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

function regular(base: string, kind: AdjectiveKind = AdjectiveKind.Regelmessig): Adjective {
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
    .map((base) => noNeuterT(base, AdjectiveKind.IgLig)),
  ...['rolig', 'kjedelig', 'riktig'].map((base) => noNeuterT(base, AdjectiveKind.IgLig)),
  ...['norsk', 'tysk', 'engelsk', 'svensk', 'dansk', 'fransk', 'praktisk', 'typisk', 'politisk', 'elektrisk']
    .map((base) => noNeuterT(base, AdjectiveKind.Sk)),
  // These -sk adjectives do take -t: «et raskt svar».
  regular('rask', AdjectiveKind.Sk),
  regular('fersk', AdjectiveKind.Sk),
  regular('frisk', AdjectiveKind.Sk),
  { base: 'svart', neuter: 'svart', plural: 'svarte', errors: ['svartt'], kind: AdjectiveKind.EnderPaT },
  { base: 'lett', neuter: 'lett', plural: 'lette', errors: ['lettt'], kind: AdjectiveKind.EnderPaT },
  { base: 'sint', neuter: 'sint', plural: 'sinte', errors: ['sintt'], kind: AdjectiveKind.EnderPaT },
  { base: 'trøtt', neuter: 'trøtt', plural: 'trøtte', errors: ['trøttt'], kind: AdjectiveKind.EnderPaT },
  { base: 'smart', neuter: 'smart', plural: 'smarte', errors: ['smartt'], kind: AdjectiveKind.EnderPaT },
  { base: 'hvit', neuter: 'hvitt', plural: 'hvite', kind: AdjectiveKind.EnderPaT },
  { base: 'søt', neuter: 'søtt', plural: 'søte', kind: AdjectiveKind.EnderPaT },
  { base: 'våt', neuter: 'vått', plural: 'våte', kind: AdjectiveKind.EnderPaT },
  { base: 'grønn', neuter: 'grønt', plural: 'grønne', errors: ['grønnt'], kind: AdjectiveKind.DobbelKonsonant },
  { base: 'tynn', neuter: 'tynt', plural: 'tynne', errors: ['tynnt'], kind: AdjectiveKind.DobbelKonsonant },
  { base: 'sann', neuter: 'sant', plural: 'sanne', errors: ['sannt'], kind: AdjectiveKind.DobbelKonsonant },
  { base: 'trygg', neuter: 'trygt', plural: 'trygge', errors: ['tryggt'], kind: AdjectiveKind.DobbelKonsonant },
  { base: 'stygg', neuter: 'stygt', plural: 'stygge', errors: ['styggt'], kind: AdjectiveKind.DobbelKonsonant },
  { base: 'tykk', neuter: 'tykt', plural: 'tykke', errors: ['tykkt'], kind: AdjectiveKind.DobbelKonsonant },
  { base: 'snill', neuter: 'snilt', plural: 'snille', errors: ['snillt'], kind: AdjectiveKind.DobbelKonsonant },
  { base: 'full', neuter: 'fullt', plural: 'fulle', errors: ['fult'], kind: AdjectiveKind.DobbelKonsonant },
  { base: 'tom', neuter: 'tomt', plural: 'tomme', errors: ['tome'], kind: AdjectiveKind.DobbelKonsonant },
  { base: 'dum', neuter: 'dumt', plural: 'dumme', errors: ['dume'], kind: AdjectiveKind.DobbelKonsonant },
  { base: 'morsom', neuter: 'morsomt', plural: 'morsomme', errors: ['morsome'], kind: AdjectiveKind.DobbelKonsonant },
  { base: 'ensom', neuter: 'ensomt', plural: 'ensomme', errors: ['ensome'], kind: AdjectiveKind.DobbelKonsonant },
  { base: 'ny', neuter: 'nytt', plural: 'nye', errors: ['nyt'], kind: AdjectiveKind.Vokal },
  { base: 'fri', neuter: 'fritt', plural: 'frie', errors: ['frit'], kind: AdjectiveKind.Vokal },
  { base: 'blå', neuter: 'blått', plural: 'blå', pluralVariants: ['blåe'], errors: ['blåt'], kind: AdjectiveKind.Vokal },
  { base: 'grå', neuter: 'grått', plural: 'grå', pluralVariants: ['gråe'], errors: ['gråt'], kind: AdjectiveKind.Vokal },
  { base: 'gammel', neuter: 'gammelt', plural: 'gamle', errors: ['gammele'], kind: AdjectiveKind.Sammentrekning },
  { base: 'enkel', neuter: 'enkelt', plural: 'enkle', errors: ['enkele'], kind: AdjectiveKind.Sammentrekning },
  { base: 'vakker', neuter: 'vakkert', plural: 'vakre', errors: ['vakkere'], kind: AdjectiveKind.Sammentrekning },
  { base: 'sikker', neuter: 'sikkert', plural: 'sikre', errors: ['sikkere'], kind: AdjectiveKind.Sammentrekning },
  { base: 'mager', neuter: 'magert', plural: 'magre', errors: ['magere'], kind: AdjectiveKind.Sammentrekning },
  { base: 'sulten', neuter: 'sultent', plural: 'sultne', errors: ['sultene'], kind: AdjectiveKind.Sammentrekning },
  { base: 'åpen', neuter: 'åpent', plural: 'åpne', errors: ['åpene'], kind: AdjectiveKind.Sammentrekning },
  { base: 'sliten', neuter: 'slitent', plural: 'slitne', errors: ['slitene'], kind: AdjectiveKind.Sammentrekning },
  { base: 'skitten', neuter: 'skittent', plural: 'skitne', errors: ['skittene'], kind: AdjectiveKind.Sammentrekning },
  { base: 'travel', neuter: 'travelt', plural: 'travle', errors: ['travele'], kind: AdjectiveKind.Sammentrekning },
  { base: 'god', neuter: 'godt', plural: 'gode', kind: AdjectiveKind.Uregelmessig },
  { base: 'glad', neuter: 'glad', plural: 'glade', errors: ['gladt'], kind: AdjectiveKind.Uregelmessig },
  { base: 'liten', neuter: 'lite', plural: 'små', definite: 'lille', feminine: 'lita', errors: ['litet'], kind: AdjectiveKind.Uregelmessig },
  { base: 'annen', neuter: 'annet', plural: 'andre', errors: ['annene'], kind: AdjectiveKind.Uregelmessig },
  { base: 'egen', neuter: 'eget', plural: 'egne', errors: ['egene'], kind: AdjectiveKind.Uregelmessig },
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
