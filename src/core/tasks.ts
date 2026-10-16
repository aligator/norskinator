/**
 * Task types: the ways a data item can be shown to the learner.
 *
 * Every task type names the data kind it presents. A deck source lists the
 * task types it is practised with, and `presentItem` picks one of them per
 * presentation according to the learner's weights.
 *
 * Adding a task type: extend `ExerciseKind`, add an entry to `TASK_TYPES`.
 */
import type { CardPhase, Grade } from './srs.ts';
import type { TaskWeights } from './task-weights.ts';
import type {
  DataItem,
  DataKind,
  Deck,
  DeckSource,
  Exercise,
  ExerciseKind,
  MultipleChoiceExercise,
  PlayableItem,
  TypeInExercise,
  WordOrderExercise,
} from './types.ts';

/**
 * How fast a right answer has to come to count as easy or hard. What is quick
 * depends on the work: picking a choice takes seconds, typing or building a
 * sentence takes longer.
 */
export interface AnswerTiming {
  /** At most this long (ms) is `easy`. */
  readonly easyWithinMs: number;
  /** At least this long (ms) is `hard`. */
  readonly hardAfterMs: number;
}

export interface TaskType {
  readonly kind: ExerciseKind;
  readonly dataKind: DataKind;
  /** Name shown in the settings. */
  readonly label: string;
  readonly timing: AnswerTiming;
  /** Null when this item cannot be shown this way. */
  build(item: DataItem): Exercise | null;
}

/** With fewer wrong choices than this, multiple choice turns into guessing. */
const MIN_DISTRACTORS = 2;

/** The fields every presentation of an item carries over unchanged. */
function sharedContent(item: DataItem): Omit<MultipleChoiceExercise, 'kind' | 'answer' | 'options'> {
  return {
    id: item.id,
    deckId: item.deckId,
    prompt: item.prompt,
    level: item.level,
    tags: item.tags,
    ...(item.hint === undefined ? {} : { hint: item.hint }),
    ...(item.solution === undefined ? {} : { solution: item.solution }),
    ...(item.explanation === undefined ? {} : { explanation: item.explanation }),
    ...(item.translations === undefined ? {} : { translations: item.translations }),
    ...(item.source === undefined ? {} : { source: item.source }),
  };
}

function buildChoice(item: DataItem): MultipleChoiceExercise | null {
  if (item.dataKind !== 'cloze') {
    return null;
  }

  const accepted = new Set([item.answer, ...(item.alternatives ?? [])]);
  const distractors = [...new Set(item.distractors)].filter((distractor) => !accepted.has(distractor));

  if (distractors.length < MIN_DISTRACTORS) {
    return null;
  }

  return { ...sharedContent(item), kind: 'multiple-choice', answer: item.answer, options: [item.answer, ...distractors] };
}

function buildTypeIn(item: DataItem): TypeInExercise | null {
  if (item.dataKind !== 'cloze') {
    return null;
  }

  return {
    ...sharedContent(item),
    kind: 'type-in',
    answer: item.answer,
    ...(item.alternatives === undefined ? {} : { alternatives: item.alternatives }),
  };
}

/** A single word leaves nothing to order. */
const MIN_TILES = 3;

function buildWordOrder(item: DataItem): WordOrderExercise | null {
  if (item.dataKind !== 'sentence' || item.tiles.length < MIN_TILES) {
    return null;
  }

  return {
    ...sharedContent(item),
    kind: 'word-order',
    answer: item.answer,
    tiles: item.tiles,
    ...(item.alternatives === undefined ? {} : { alternatives: item.alternatives }),
  };
}

export const TASK_TYPES: Readonly<Record<ExerciseKind, TaskType>> = {
  'multiple-choice': {
    kind: 'multiple-choice',
    dataKind: 'cloze',
    label: 'Flervalg',
    timing: { easyWithinMs: 4000, hardAfterMs: 15_000 },
    build: buildChoice,
  },
  'type-in': {
    kind: 'type-in',
    dataKind: 'cloze',
    label: 'Skriv inn',
    timing: { easyWithinMs: 8000, hardAfterMs: 25_000 },
    build: buildTypeIn,
  },
  'word-order': {
    kind: 'word-order',
    dataKind: 'sentence',
    label: 'Ordstilling',
    timing: { easyWithinMs: 12_000, hardAfterMs: 35_000 },
    build: buildWordOrder,
  },
};

/**
 * Beyond this the learner most likely switched tabs or walked away, so the
 * time says nothing about difficulty and must not force `hard`. A negative
 * span (clock moved backwards) is just as meaningless; both grade as `good`.
 */
const UNMEASURED_AFTER_MS = 60_000;

/**
 * Grades an answer without asking the learner: response time stands in for
 * self-assessment. Fast and right means easy, slow and right keeps the
 * interval short. The time thresholds depend on the task type.
 *
 * A card failed moments ago is answered from short-term memory, so a quick
 * right answer must not earn the long `easy` head start.
 */
export function gradeFromAnswer(
  kind: ExerciseKind,
  correct: boolean,
  elapsedMs: number,
  phase: CardPhase,
): Grade {
  if (!correct) {
    return 'again';
  }

  if (elapsedMs < 0 || elapsedMs > UNMEASURED_AFTER_MS) {
    return 'good';
  }

  const { easyWithinMs, hardAfterMs } = TASK_TYPES[kind].timing;

  if (elapsedMs <= easyWithinMs) {
    return phase === 'learning' || phase === 'relearning' ? 'good' : 'easy';
  }

  if (elapsedMs >= hardAfterMs) {
    return 'hard';
  }

  return 'good';
}

function assertSourceFits(deck: Deck, source: DeckSource): void {
  for (const kind of source.tasks) {
    const accepts = TASK_TYPES[kind].dataKind;

    if (accepts !== source.dataKind) {
      throw new Error(`Deck "${deck.id}": task "${kind}" shows ${accepts} items, not ${source.dataKind}`);
    }
  }
}

/** Loads every pool of a deck and tags each item with the task types its pool allows. */
export async function loadDeck(deck: Deck): Promise<PlayableItem[]> {
  const pools = await Promise.all(
    deck.sources.map(async (source) => {
      assertSourceFits(deck, source);

      const items = await source.load();

      return items.map((item): PlayableItem => {
        if (item.dataKind !== source.dataKind) {
          throw new Error(`Deck "${deck.id}": item "${item.id}" is ${item.dataKind}, not ${source.dataKind}`);
        }

        return { ...item, tasks: source.tasks };
      });
    }),
  );

  return pools.flat();
}

/** Shows an item as one specific task type, or null when its pool does not allow it or it does not fit. */
export function presentAs(item: PlayableItem, kind: ExerciseKind): Exercise | null {
  return item.tasks.includes(kind) ? TASK_TYPES[kind].build(item) : null;
}

/**
 * Picks a task type for one presentation, weighted by the learner's shares.
 * Task types set to 0 % are skipped unless nothing else can show the item,
 * so no item silently drops out of the learner's reviews.
 */
export function presentItem(item: PlayableItem, weights: TaskWeights, random: () => number): Exercise | null {
  const candidates = item.tasks.flatMap((kind) => {
    const exercise = TASK_TYPES[kind].build(item);

    return exercise === null ? [] : [exercise];
  });

  const weighted = candidates.filter((exercise) => weights[exercise.kind] > 0);

  if (weighted.length === 0) {
    return candidates[Math.floor(random() * candidates.length)] ?? null;
  }

  const total = weighted.reduce((sum, exercise) => sum + weights[exercise.kind], 0);
  let roll = random() * total;

  for (const exercise of weighted) {
    roll -= weights[exercise.kind];

    if (roll < 0) {
      return exercise;
    }
  }

  return weighted[weighted.length - 1] ?? null;
}
