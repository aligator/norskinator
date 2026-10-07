/**
 * Task types: the ways a data item can be shown to the learner.
 *
 * Every task type names the data kind it presents. A deck source lists the
 * task types it is practised with, and `presentItem` picks one of them per
 * presentation according to the learner's weights.
 *
 * Adding a task type: extend `ExerciseKind`, add an entry to `TASK_TYPES`.
 */
import type { TaskWeights } from './task-weights.ts';
import type {
  ClozeItem,
  DataItem,
  DataKind,
  Deck,
  DeckSource,
  Exercise,
  ExerciseKind,
  MultipleChoiceExercise,
  PlayableItem,
  TypeInExercise,
} from './types.ts';

export interface TaskType {
  readonly kind: ExerciseKind;
  readonly dataKind: DataKind;
  /** Name shown in the settings. */
  readonly label: string;
  /** Null when this item cannot be shown this way. */
  build(item: DataItem): Exercise | null;
}

/** With fewer wrong choices than this, multiple choice turns into guessing. */
const MIN_DISTRACTORS = 2;

/** The fields every presentation of a cloze item carries over unchanged. */
function clozeContent(item: ClozeItem): Omit<MultipleChoiceExercise, 'kind' | 'answer' | 'options'> {
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

function buildChoice(item: ClozeItem): MultipleChoiceExercise | null {
  const accepted = new Set([item.answer, ...(item.alternatives ?? [])]);
  const distractors = [...new Set(item.distractors)].filter((distractor) => !accepted.has(distractor));

  if (distractors.length < MIN_DISTRACTORS) {
    return null;
  }

  return { ...clozeContent(item), kind: 'multiple-choice', answer: item.answer, options: [item.answer, ...distractors] };
}

function buildTypeIn(item: ClozeItem): TypeInExercise {
  return {
    ...clozeContent(item),
    kind: 'type-in',
    answer: item.answer,
    ...(item.alternatives === undefined ? {} : { alternatives: item.alternatives }),
  };
}

export const TASK_TYPES: Readonly<Record<ExerciseKind, TaskType>> = {
  'multiple-choice': { kind: 'multiple-choice', dataKind: 'cloze', label: 'Flervalg', build: buildChoice },
  'type-in': { kind: 'type-in', dataKind: 'cloze', label: 'Skriv inn', build: buildTypeIn },
};

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
