/**
 * Template exercises: one rule, many sentences.
 *
 * A template is a sentence with a `___` gap and one `{slot}`. Every filler
 * keeps the rule intact, so the answer is right by construction and the
 * distractors are chosen to be wrong for every filler, not just one. When the
 * rule depends on the filler (place names with «i» or «på»), the filler names
 * its own answer and the template lists both in `options`.
 *
 * Ids are `p-tpl-<templateId>-<fillerId>`. Never rename or reuse them: they
 * key the learner's SRS history.
 */
import type { Exercise, Level } from '../../core/types.ts';
import type { Preposition } from './prepositions.ts';
import type { Topic } from './topics.ts';

interface SlotFiller {
  /** Stable kebab-case id fragment. */
  readonly id: string;
  readonly text: string;
  /** Overrides the template answer when the rule depends on the filler. */
  readonly answer?: Preposition;
  readonly level?: Level;
}

interface Template {
  /** Stable kebab-case id fragment. */
  readonly id: string;
  /** Sentence with exactly one `___` and one `{name}` slot. */
  readonly pattern: string;
  readonly answer: Preposition;
  /** Every answer a filler can take, plus distractors wrong for every filler. */
  readonly options: readonly Preposition[];
  readonly explanation: string;
  /** Replaces `explanation` for fillers whose answer differs from the template's. */
  readonly explanationByAnswer?: Readonly<Partial<Record<Preposition, string>>>;
  readonly topic: Topic;
  readonly level: Level;
  readonly fillers: readonly SlotFiller[];
}

const SLOT = /\{[a-zæøå-]+\}/;

const CITIES_WITH_I: readonly SlotFiller[] = [
  { id: 'bergen', text: 'Bergen' },
  { id: 'trondheim', text: 'Trondheim' },
  { id: 'stavanger', text: 'Stavanger' },
  { id: 'tromso', text: 'Tromsø' },
  { id: 'kristiansand', text: 'Kristiansand' },
  { id: 'bodo', text: 'Bodø' },
];

const PLACES_WITH_PA: readonly SlotFiller[] = [
  { id: 'hamar', text: 'Hamar', answer: 'på', level: 3 },
  { id: 'lillehammer', text: 'Lillehammer', answer: 'på', level: 3 },
  { id: 'gjovik', text: 'Gjøvik', answer: 'på', level: 3 },
  { id: 'kongsberg', text: 'Kongsberg', answer: 'på', level: 3 },
  { id: 'roros', text: 'Røros', answer: 'på', level: 3 },
  { id: 'voss', text: 'Voss', answer: 'på', level: 3 },
];

const ISLANDS_WITH_PA: readonly SlotFiller[] = [
  { id: 'island', text: 'Island', answer: 'på', level: 2 },
  { id: 'kreta', text: 'Kreta', answer: 'på', level: 2 },
  { id: 'malta', text: 'Malta', answer: 'på', level: 2 },
];

/** For templates whose answer is the same for every place: strips the i/på overrides. */
function asPlainPlaces(fillers: readonly SlotFiller[]): readonly SlotFiller[] {
  return fillers.map((filler) => ({ id: filler.id, text: filler.text }));
}

const TEMPLATES: readonly Template[] = [
  // --- Stedsnavn --------------------------------------------------------------
  {
    id: 'bor-i-pa-sted',
    pattern: 'Jeg bor ___ {sted}.',
    answer: 'i',
    options: ['i', 'på', 'til', 'fra'],
    explanation: 'De fleste byer og land tar «i»: i Bergen, i Norge.',
    explanationByAnswer: {
      på: 'Øyer og en del byer og tettsteder tar «på»: på Island, på Hamar, på Voss. Slike unntak må læres ett for ett.',
    },
    topic: 'stedsnavn',
    level: 1,
    fillers: [
      { id: 'oslo', text: 'Oslo' },
      { id: 'drammen', text: 'Drammen' },
      ...CITIES_WITH_I,
      ...PLACES_WITH_PA,
      ...ISLANDS_WITH_PA,
    ],
  },
  {
    id: 'avstand-til-sted',
    pattern: 'Hvor langt er det ___ {sted} herfra?',
    answer: 'til',
    options: ['til', 'i', 'på', 'hos'],
    explanation: 'Avstand og retning mot et mål tar «til», uansett om stedet ellers tar «i» eller «på».',
    topic: 'bevegelse',
    level: 1,
    fillers: asPlainPlaces([...CITIES_WITH_I.slice(0, 4), ...PLACES_WITH_PA.slice(0, 4)]),
  },
  {
    id: 'kommer-fra-sted',
    pattern: 'Hun kommer opprinnelig ___ {sted}, men bor i Oslo nå.',
    answer: 'fra',
    options: ['fra', 'i', 'på', 'av'],
    explanation: '«Fra» = opprinnelse, både for steder som tar «i» og for steder som tar «på».',
    topic: 'bevegelse',
    level: 1,
    fillers: asPlainPlaces([
      ...CITIES_WITH_I.slice(0, 4),
      ...PLACES_WITH_PA.slice(0, 2),
      ...PLACES_WITH_PA.slice(5),
      ...ISLANDS_WITH_PA.slice(0, 1),
    ]),
  },

  // --- Sted -------------------------------------------------------------------
  {
    id: 'jobber-pa-arbeidsplass',
    pattern: 'Hun jobber ___ {arbeidsplass}.',
    answer: 'på',
    options: ['på', 'til', 'av', 'om'],
    explanation: 'Arbeidsplasser og institusjoner tar oftest «på»: på kontoret, på sykehuset, på skolen.',
    topic: 'sted',
    level: 1,
    fillers: [
      { id: 'kontoret', text: 'kontoret' },
      { id: 'sykehuset', text: 'sykehuset' },
      { id: 'skolen', text: 'skolen' },
      { id: 'flyplassen', text: 'flyplassen' },
      { id: 'hotellet', text: 'hotellet' },
      { id: 'fabrikken', text: 'fabrikken' },
      { id: 'kjopesenteret', text: 'kjøpesenteret' },
      { id: 'sykehjemmet', text: 'sykehjemmet' },
      { id: 'bensinstasjonen', text: 'bensinstasjonen' },
      { id: 'biblioteket', text: 'biblioteket' },
    ],
  },
  {
    id: 'hos-person',
    pattern: 'Vi var ___ {person} hele ettermiddagen.',
    answer: 'hos',
    options: ['hos', 'ved', 'i', 'mot'],
    explanation: '«Hos» + person: hjemme hos eller på kontoret til den personen. Tysk «beim Arzt» blir «hos legen».',
    topic: 'sted',
    level: 2,
    fillers: [
      { id: 'legen', text: 'legen' },
      { id: 'tannlegen', text: 'tannlegen' },
      { id: 'frisoren', text: 'frisøren' },
      { id: 'bestemor', text: 'bestemor' },
      { id: 'mormor', text: 'mormor' },
      { id: 'naboen', text: 'naboen' },
      { id: 'kari', text: 'Kari' },
      { id: 'fysioterapeuten', text: 'fysioterapeuten' },
    ],
  },

  // --- Tid --------------------------------------------------------------------
  {
    id: 'ukedag-pa',
    pattern: 'Vi skal ha møte ___ {ukedag}.',
    answer: 'på',
    options: ['på', 'i', 'ved', 'hos'],
    explanation: '«På» + ukedag om en dag som kommer. «I mandag» betyr forrige mandag og passer ikke med «skal».',
    topic: 'tid',
    level: 1,
    fillers: [
      { id: 'mandag', text: 'mandag' },
      { id: 'tirsdag', text: 'tirsdag' },
      { id: 'onsdag', text: 'onsdag' },
      { id: 'torsdag', text: 'torsdag' },
      { id: 'fredag', text: 'fredag' },
      { id: 'lordag', text: 'lørdag' },
      { id: 'sondag', text: 'søndag' },
    ],
  },
  {
    id: 'maned-i',
    pattern: 'Vi skal på ferie ___ {måned}.',
    answer: 'i',
    options: ['i', 'på', 'om', 'ved'],
    explanation: 'Måneder tar «i»: i mai, i juli. Ukedager tar «på».',
    topic: 'tid',
    level: 1,
    fillers: [
      { id: 'januar', text: 'januar' },
      { id: 'mars', text: 'mars' },
      { id: 'mai', text: 'mai' },
      { id: 'juni', text: 'juni' },
      { id: 'juli', text: 'juli' },
      { id: 'august', text: 'august' },
      { id: 'oktober', text: 'oktober' },
      { id: 'desember', text: 'desember' },
    ],
  },
  {
    id: 'tiar-pa',
    pattern: 'Huset ble bygd ___ {tiår}.',
    answer: 'på',
    options: ['på', 'i', 'om', 'ved'],
    explanation: 'Tiår og århundrer tar «på»: på 1970-tallet, på 1800-tallet. Enkeltår tar «i»: i 1975.',
    topic: 'tid',
    level: 2,
    fillers: [
      { id: '1700-tallet', text: '1700-tallet' },
      { id: '1800-tallet', text: '1800-tallet' },
      { id: '1920-tallet', text: '1920-tallet' },
      { id: '1950-tallet', text: '1950-tallet' },
      { id: '1970-tallet', text: '1970-tallet' },
      { id: '1990-tallet', text: '1990-tallet' },
    ],
  },
  {
    id: 'om-vane',
    pattern: 'Jeg trener alltid ___ {tid}.',
    answer: 'om',
    options: ['om', 'i', 'ved', 'av'],
    explanation:
      '«Om» + bestemt form om noe som gjentar seg: om morgenen, om sommeren. «I sommer» uten -en betyr denne sommeren.',
    topic: 'tid',
    level: 2,
    fillers: [
      { id: 'morgenen', text: 'morgenen' },
      { id: 'formiddagen', text: 'formiddagen' },
      { id: 'ettermiddagen', text: 'ettermiddagen' },
      { id: 'kvelden', text: 'kvelden' },
      { id: 'varen', text: 'våren' },
      { id: 'sommeren', text: 'sommeren' },
      { id: 'hosten', text: 'høsten' },
      { id: 'vinteren', text: 'vinteren' },
    ],
  },
  {
    id: 'i-naert-tidspunkt',
    pattern: 'Vi drar til Italia ___ {tid}.',
    answer: 'i',
    options: ['i', 'om', 'på', 'ved'],
    explanation:
      '«I» + tidsord uten endelse peker på et bestemt, nært tidspunkt: i sommer, i kveld, i morgen. Vaner tar «om sommeren».',
    topic: 'tid',
    level: 2,
    fillers: [
      { id: 'morgen', text: 'morgen' },
      { id: 'ettermiddag', text: 'ettermiddag' },
      { id: 'kveld', text: 'kveld' },
      { id: 'var', text: 'vår' },
      { id: 'sommer', text: 'sommer' },
      { id: 'host', text: 'høst' },
      { id: 'vinter', text: 'vinter' },
    ],
  },
  {
    id: 'i-fortid',
    pattern: 'Jeg traff henne ___ {tid}.',
    answer: 'i',
    options: ['i', 'på', 'om', 'ved'],
    explanation: 'Faste tidsuttrykk for det som nettopp var, tar «i»: i går, i morges, i fjor.',
    topic: 'tid',
    level: 2,
    fillers: [
      { id: 'gar', text: 'går' },
      { id: 'gar-kveld', text: 'går kveld' },
      { id: 'forgars', text: 'forgårs' },
      { id: 'morges', text: 'morges' },
      { id: 'fjor', text: 'fjor' },
    ],
  },
  {
    id: 'om-tidsrom-framover',
    pattern: 'Møtet starter ___ {tidsrom}, så vi må skynde oss.',
    answer: 'om',
    options: ['om', 'i', 'på', 'ved'],
    explanation: '«Om» + tidsrom = så lang tid fra nå. «I fem minutter» betyr varighet.',
    topic: 'tid',
    level: 2,
    fillers: [
      { id: 'to-minutter', text: 'to minutter' },
      { id: 'fem-minutter', text: 'fem minutter' },
      { id: 'ti-minutter', text: 'ti minutter' },
      { id: 'et-kvarter', text: 'et kvarter' },
      { id: 'en-halvtime', text: 'en halvtime' },
      { id: 'en-time', text: 'en time' },
    ],
  },
  {
    id: 'i-varighet',
    pattern: 'Vi var i Spania ___ {tidsrom}.',
    answer: 'i',
    options: ['i', 'om', 'på', 'siden'],
    explanation: 'Varighet tar «i»: i to uker. «Om» peker framover, og «siden» krever et startpunkt.',
    topic: 'tid',
    level: 2,
    fillers: [
      { id: 'tre-dager', text: 'tre dager' },
      { id: 'ti-dager', text: 'ti dager' },
      { id: 'to-uker', text: 'to uker' },
      { id: 'en-maned', text: 'en måned' },
      { id: 'et-halvt-ar', text: 'et halvt år' },
      { id: 'fire-ar', text: 'fire år' },
    ],
  },
  {
    id: 'for-siden',
    pattern: 'Vi flyttet hit for {tidsrom} ___.',
    answer: 'siden',
    options: ['siden', 'om', 'etter', 'i'],
    explanation: '«For … siden» = så lang tid tilbake fra nå. Tysk «vor zwei Jahren» blir ikke «før».',
    topic: 'tid',
    level: 2,
    fillers: [
      { id: 'en-uke', text: 'en uke' },
      { id: 'tre-maneder', text: 'tre måneder' },
      { id: 'et-halvt-ar', text: 'et halvt år' },
      { id: 'to-ar', text: 'to år' },
      { id: 'ti-ar', text: 'ti år' },
      { id: 'lenge', text: 'lenge' },
    ],
  },
  {
    id: 'siden-startpunkt',
    pattern: 'Jeg har lært norsk ___ {start}.',
    answer: 'siden',
    options: ['siden', 'om', 'på', 'ved'],
    explanation: '«Siden» + startpunkt når noe fortsatt pågår. Med en varighet bruker man «i»: i to år.',
    topic: 'tid',
    level: 2,
    fillers: [
      { id: '2019', text: '2019' },
      { id: '2021', text: '2021' },
      { id: 'januar', text: 'januar' },
      { id: 'mars', text: 'mars' },
      { id: 'oktober', text: 'oktober' },
      { id: 'forrige-uke', text: 'forrige uke' },
    ],
  },
  {
    id: 'under-hendelse',
    pattern: 'Det er forbudt å bruke mobilen ___ {hendelse}.',
    answer: 'under',
    options: ['under', 'mot', 'hos', 'blant'],
    explanation: '«Under» om tid = mens noe pågår: under eksamen, under møtet.',
    topic: 'tid',
    level: 2,
    fillers: [
      { id: 'eksamen', text: 'eksamen' },
      { id: 'moetet', text: 'møtet' },
      { id: 'forestillingen', text: 'forestillingen' },
      { id: 'filmen', text: 'filmen' },
      { id: 'gudstjenesten', text: 'gudstjenesten' },
      { id: 'kjoringen', text: 'kjøringen' },
    ],
  },
  {
    id: 'mellom-klokkeslett',
    pattern: 'Butikken er stengt ___ {tidsrom}.',
    answer: 'mellom',
    options: ['mellom', 'fra', 'blant', 'om'],
    explanation: '«Mellom» + to tidspunkter bundet sammen med «og». Etter «fra» følger «til».',
    topic: 'tid',
    level: 2,
    fillers: [
      { id: 'tolv-og-ett', text: 'tolv og ett' },
      { id: 'to-og-tre', text: 'to og tre' },
      { id: 'fire-og-fem', text: 'fire og fem' },
      { id: 'halv-tolv-og-halv-ett', text: 'halv tolv og halv ett' },
    ],
  },

  // --- Verb og faste uttrykk --------------------------------------------------
  {
    id: 'venter-pa',
    pattern: 'Vi har ventet ___ {noe} i over en time.',
    answer: 'på',
    options: ['på', 'for', 'etter', 'om'],
    explanation: '«Vente på» noe eller noen. Tysk «warten auf».',
    topic: 'verb',
    level: 1,
    fillers: [
      { id: 'toget', text: 'toget' },
      { id: 'bussen', text: 'bussen' },
      { id: 'taxien', text: 'taxien' },
      { id: 'deg', text: 'deg' },
      { id: 'legen', text: 'legen' },
      { id: 'pizzaen', text: 'pizzaen' },
      { id: 'svar', text: 'svar' },
    ],
  },
  {
    id: 'ser-fram-til',
    pattern: 'Jeg ser fram ___ {noe}.',
    answer: 'til',
    options: ['til', 'på', 'for', 'etter'],
    explanation: '«Se fram til» noe hyggelig som kommer. Tysk «sich freuen auf» blir ikke «på».',
    topic: 'verb',
    level: 2,
    fillers: [
      { id: 'helgen', text: 'helgen' },
      { id: 'ferien', text: 'ferien' },
      { id: 'sommeren', text: 'sommeren' },
      { id: 'jula', text: 'jula' },
      { id: 'konserten', text: 'konserten' },
      { id: 'bryllupet', text: 'bryllupet' },
      { id: 'a-mote-deg', text: 'å møte deg' },
    ],
  },
  {
    id: 'redd-for',
    pattern: 'Mange barn er redde ___ {noe}.',
    answer: 'for',
    options: ['for', 'av', 'på', 'før'],
    explanation: '«Redd for» noe. Tysk «Angst vor» blir ikke «før».',
    topic: 'fast-uttrykk',
    level: 2,
    fillers: [
      { id: 'morket', text: 'mørket' },
      { id: 'hunder', text: 'hunder' },
      { id: 'edderkopper', text: 'edderkopper' },
      { id: 'slanger', text: 'slanger' },
      { id: 'tordenvaer', text: 'tordenvær' },
      { id: 'tannlegen', text: 'tannlegen' },
    ],
  },
  {
    id: 'interessert-i',
    pattern: 'Han er veldig interessert ___ {emne}.',
    answer: 'i',
    options: ['i', 'for', 'på', 'om'],
    explanation: '«Interessert i» noe. Tysk «sich interessieren für» blir ikke «for».',
    topic: 'fast-uttrykk',
    level: 2,
    fillers: [
      { id: 'historie', text: 'historie' },
      { id: 'fotball', text: 'fotball' },
      { id: 'politikk', text: 'politikk' },
      { id: 'kunst', text: 'kunst' },
      { id: 'matlaging', text: 'matlaging' },
      { id: 'sprak', text: 'språk' },
      { id: 'film', text: 'film' },
      { id: 'fugler', text: 'fugler' },
    ],
  },

  // --- Middel -----------------------------------------------------------------
  {
    id: 'med-transport',
    pattern: 'Vi reiser ___ {transport} til Trondheim.',
    answer: 'med',
    options: ['med', 'av', 'ved', 'for'],
    explanation: 'Transportmiddel tar «med»: med toget, med fly, med bil.',
    topic: 'middel',
    level: 1,
    fillers: [
      { id: 'toget', text: 'toget' },
      { id: 'nattoget', text: 'nattoget' },
      { id: 'bussen', text: 'bussen' },
      { id: 'ekspressbussen', text: 'ekspressbussen' },
      { id: 'fly', text: 'fly' },
      { id: 'bil', text: 'bil' },
      { id: 'hurtigruten', text: 'Hurtigruten' },
    ],
  },
  {
    id: 'skrevet-av-forfatter',
    pattern: 'Denne romanen er skrevet ___ {forfatter}.',
    answer: 'av',
    options: ['av', 'fra', 'hos', 'ved'],
    explanation: 'Den som utfører handlingen i en passiv setning, tar «av»: skrevet av, malt av, laget av.',
    topic: 'middel',
    level: 1,
    fillers: [
      { id: 'knut-hamsun', text: 'Knut Hamsun' },
      { id: 'sigrid-undset', text: 'Sigrid Undset' },
      { id: 'jon-fosse', text: 'Jon Fosse' },
      { id: 'jo-nesbo', text: 'Jo Nesbø' },
      { id: 'karl-ove-knausgard', text: 'Karl Ove Knausgård' },
      { id: 'maja-lunde', text: 'Maja Lunde' },
      { id: 'jostein-gaarder', text: 'Jostein Gaarder' },
      { id: 'anne-b-ragde', text: 'Anne B. Ragde' },
    ],
  },
  {
    id: 'laget-av-materiale',
    pattern: 'Bordet er laget ___ {materiale}.',
    answer: 'av',
    options: ['av', 'fra', 'til', 'om'],
    explanation: 'Materiale tar «av»: laget av tre, bygd av stein. Tysk «aus» blir ikke «fra».',
    topic: 'middel',
    level: 2,
    fillers: [
      { id: 'tre', text: 'tre' },
      { id: 'eik', text: 'eik' },
      { id: 'glass', text: 'glass' },
      { id: 'stein', text: 'stein' },
      { id: 'marmor', text: 'marmor' },
      { id: 'plast', text: 'plast' },
      { id: 'metall', text: 'metall' },
    ],
  },
  {
    id: 'pa-sprak',
    pattern: 'Hun skrev brevet ___ {språk}.',
    answer: 'på',
    options: ['på', 'i', 'med', 'av'],
    explanation: 'Språk tar «på»: på norsk, på engelsk. Tysk «auf Norwegisch» stemmer her.',
    topic: 'middel',
    level: 1,
    fillers: [
      { id: 'norsk', text: 'norsk' },
      { id: 'nynorsk', text: 'nynorsk' },
      { id: 'engelsk', text: 'engelsk' },
      { id: 'tysk', text: 'tysk' },
      { id: 'svensk', text: 'svensk' },
      { id: 'fransk', text: 'fransk' },
      { id: 'spansk', text: 'spansk' },
    ],
  },
];

function toExercise(template: Template, filler: SlotFiller): Exercise {
  const answer = filler.answer ?? template.answer;
  const prompt = template.pattern.replace(SLOT, () => filler.text);
  const explanation =
    answer === template.answer
      ? template.explanation
      : (template.explanationByAnswer?.[answer] ?? template.explanation);

  return {
    kind: 'multiple-choice',
    id: `p-tpl-${template.id}-${filler.id}`,
    deckId: 'prepositions',
    prompt,
    solution: prompt.replace('___', answer),
    explanation,
    answer,
    options: template.options,
    level: filler.level ?? template.level,
    tags: [answer, `tema:${template.topic}`, 'kilde:mal'],
  };
}

export const TEMPLATE_EXERCISES: readonly Exercise[] = TEMPLATES.flatMap((template) =>
  template.fillers.map((filler) => toExercise(template, filler)),
);
