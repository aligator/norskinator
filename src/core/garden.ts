/**
 * The garden: every item is a plant whose stage follows its SRS card.
 *
 * Nothing here is stored. A plant is read from the card's stability, so it
 * grows exactly as fast as the learner remembers and wilts when they forget.
 */
import { DEFAULT_SPECIES, type SpeciesId } from './species.ts';
import { Grade, isDue, type CardState } from './srs.ts';
import type { ItemMeta } from './types.ts';

/** In growth order; a stage's position is its rank. */
export enum PlantStage {
  Seed = 'seed',
  Sprout = 'sprout',
  Plant = 'plant',
  Bush = 'bush',
  Tree = 'tree',
  Blossom = 'blossom',
}

export const PLANT_STAGES: readonly PlantStage[] = Object.values(PlantStage);

export const PLANT_STAGE_LABELS: Readonly<Record<PlantStage, string>> = {
  [PlantStage.Seed]: 'Frø',
  [PlantStage.Sprout]: 'Spire',
  [PlantStage.Plant]: 'Plante',
  [PlantStage.Bush]: 'Busk',
  [PlantStage.Tree]: 'Tre',
  [PlantStage.Blossom]: 'Blomstrende tre',
};

export interface Plant {
  readonly stage: PlantStage;
  /** The last answer was wrong; the plant stays wilted until the next right one. */
  readonly wilted: boolean;
  /** 0..1 on the way to the next stage, so a plant visibly grows within its stage too. */
  readonly growth: number;
}

export const SEED: Plant = { stage: PlantStage.Seed, wilted: false, growth: 0 };

/**
 * Stability in days at which a reviewed card reaches each stage, in growth
 * order. Stability is the interval at 90 % retention, so these are also the
 * days a plant can go without water.
 */
export const STAGE_START_DAYS: Readonly<Record<Exclude<PlantStage, PlantStage.Seed>, number>> = {
  [PlantStage.Sprout]: 1,
  [PlantStage.Plant]: 3,
  [PlantStage.Bush]: 7,
  [PlantStage.Tree]: 21,
  [PlantStage.Blossom]: 60,
};

/** A blossoming tree keeps filling out until this stability. */
export const FULL_GROWN_DAYS = 180;

const GROWN_STAGES = [PlantStage.Sprout, PlantStage.Plant, PlantStage.Bush, PlantStage.Tree, PlantStage.Blossom] as const;

export function plantOf(card: CardState | undefined): Plant {
  if (card === undefined || card.reps === 0) {
    return SEED;
  }

  if (card.lastGrade === Grade.Again) {
    return { stage: PlantStage.Sprout, wilted: true, growth: 0 };
  }

  let position = 0;

  for (const [index, candidate] of GROWN_STAGES.entries()) {
    if (card.stability >= STAGE_START_DAYS[candidate]) {
      position = index;
    }
  }

  const stage = GROWN_STAGES[position]!;
  const next = GROWN_STAGES[position + 1];

  const start = STAGE_START_DAYS[stage];
  const end = next === undefined ? FULL_GROWN_DAYS : STAGE_START_DAYS[next];
  const growth = Math.min(1, Math.max(0, (card.stability - start) / (end - start)));

  return { stage, wilted: false, growth };
}

/** The stage a plant grows into next, or null once it blossoms. */
export function nextStage(stage: PlantStage): PlantStage | null {
  return PLANT_STAGES[stageRank(stage) + 1] ?? null;
}

export function stageRank(stage: PlantStage): number {
  return PLANT_STAGES.indexOf(stage);
}

export enum PlantChange {
  Sown = 'sown',
  Grown = 'grown',
  Wilted = 'wilted',
  Recovered = 'recovered',
  Unchanged = 'unchanged',
}

/** What one answer did to a plant, for feedback and the session summary. */
export function plantChange(before: Plant, after: Plant): PlantChange {
  if (after.wilted) {
    return before.wilted ? PlantChange.Unchanged : PlantChange.Wilted;
  }

  if (before.stage === PlantStage.Seed) {
    return PlantChange.Sown;
  }

  if (before.wilted) {
    return PlantChange.Recovered;
  }

  return stageRank(after.stage) > stageRank(before.stage) ? PlantChange.Grown : PlantChange.Unchanged;
}

export type StageCounts = Record<PlantStage, number>;

export interface GardenPlant<Item extends ItemMeta> {
  readonly item: Item;
  readonly plant: Plant;
  readonly species: SpeciesId;
  /** Due for review: the plant needs water. */
  readonly thirsty: boolean;
  /** Epoch ms of the next review. */
  readonly due: number;
  /** Times the item was answered. */
  readonly reps: number;
}

export interface GardenBed<Item extends ItemMeta> {
  readonly deckId: string;
  /** Planted items, i.e. every item answered at least once; seeds are only counted. */
  readonly plants: readonly GardenPlant<Item>[];
  readonly counts: StageCounts;
  readonly wilted: number;
  readonly thirsty: number;
}

function emptyCounts(): StageCounts {
  return {
    [PlantStage.Seed]: 0,
    [PlantStage.Sprout]: 0,
    [PlantStage.Plant]: 0,
    [PlantStage.Bush]: 0,
    [PlantStage.Tree]: 0,
    [PlantStage.Blossom]: 0,
  };
}

/** Wilted and thirsty plants first, they are the ones to look after; then the tallest. */
function compareForBed<Item extends ItemMeta>(left: GardenPlant<Item>, right: GardenPlant<Item>): number {
  const needsCare = Number(right.plant.wilted || right.thirsty) - Number(left.plant.wilted || left.thirsty);

  if (needsCare !== 0) {
    return needsCare;
  }

  return stageRank(right.plant.stage) - stageRank(left.plant.stage) || left.due - right.due;
}

/** One bed per deck, in the order the decks first appear among `items`. */
export function gardenBeds<Item extends ItemMeta>(
  items: readonly Item[],
  cards: Readonly<Record<string, CardState>>,
  now: number,
  species: Readonly<Record<string, SpeciesId>> = {},
): GardenBed<Item>[] {
  const beds = new Map<string, { plants: GardenPlant<Item>[]; counts: StageCounts; wilted: number; thirsty: number }>();

  for (const item of items) {
    let bed = beds.get(item.deckId);

    if (bed === undefined) {
      bed = { plants: [], counts: emptyCounts(), wilted: 0, thirsty: 0 };
      beds.set(item.deckId, bed);
    }

    const card = cards[item.id];
    const plant = plantOf(card);

    bed.counts[plant.stage] += 1;

    if (card === undefined || plant.stage === PlantStage.Seed) {
      continue;
    }

    const thirsty = isDue(card, now);

    bed.wilted += plant.wilted ? 1 : 0;
    bed.thirsty += thirsty ? 1 : 0;
    bed.plants.push({
      item,
      plant,
      species: species[item.id] ?? DEFAULT_SPECIES,
      thirsty,
      due: card.due,
      reps: card.reps,
    });
  }

  return [...beds.entries()].map(([deckId, bed]) => ({ deckId, ...bed, plants: bed.plants.sort(compareForBed) }));
}

export function totalCounts(beds: readonly GardenBed<ItemMeta>[]): StageCounts {
  const total = emptyCounts();

  for (const bed of beds) {
    for (const stage of PLANT_STAGES) {
      total[stage] += bed.counts[stage];
    }
  }

  return total;
}
