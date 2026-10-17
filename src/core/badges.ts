/**
 * Badges in three groups: practice, the garden and money. Each is a rule over
 * the learner's whole state, so garden and shop milestones count as much as
 * answers. Badge ids are stored in `progress.unlockedBadges` and are
 * permanent: rename the title, never the id.
 */
import type { Progress } from './gamification.ts';
import { PlantStage, plantOf, stageRank } from './garden.ts';
import { SPECIES, SpeciesId, spendableXp, type GardenState } from './species.ts';
import { CardPhase, type CardState } from './srs.ts';

export enum BadgeCategory {
  Practice = 'practice',
  Garden = 'garden',
  Money = 'money',
}

export const BADGE_CATEGORY_LABELS: Readonly<Record<BadgeCategory, string>> = {
  [BadgeCategory.Practice]: 'Øving',
  [BadgeCategory.Garden]: 'Hagen',
  [BadgeCategory.Money]: 'Penger',
};

/** Everything a badge rule may look at. */
export interface BadgeState {
  readonly progress: Progress;
  readonly cards: Readonly<Record<string, CardState>>;
  readonly garden: GardenState;
}

/** The parts of `BadgeState` outside the progress record. */
export type BadgeWorld = Omit<BadgeState, 'progress'>;

export interface Badge {
  readonly id: string;
  readonly category: BadgeCategory;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly earned: (state: BadgeState) => boolean;
}

function accuracy(progress: Progress): number {
  return progress.totalAnswers === 0 ? 0 : progress.correctAnswers / progress.totalAnswers;
}

/** Plants that reached at least `stage` and are not wilted. */
function plantsAtLeast({ cards }: BadgeState, stage: PlantStage): number {
  const rank = stageRank(stage);

  return Object.values(cards).filter((card) => {
    const plant = plantOf(card);

    return !plant.wilted && stageRank(plant.stage) >= rank;
  }).length;
}

/** A plant that wilted once and has grown back since. */
function hasRecovered({ cards }: BadgeState): boolean {
  return Object.values(cards).some((card) => card.lapses > 0 && card.phase === CardPhase.Review);
}

function gardensPlanted({ cards }: BadgeState): number {
  return new Set(Object.values(cards).map((card) => card.deckId)).size;
}

export const BADGES: readonly Badge[] = [
  {
    id: 'first-steps',
    category: BadgeCategory.Practice,
    title: 'Første steg',
    description: 'Svar riktig på din første oppgave.',
    icon: '👣',
    earned: ({ progress }) => progress.correctAnswers >= 1,
  },
  {
    id: 'fifty-answers',
    category: BadgeCategory.Practice,
    title: 'Femti svar',
    description: 'Svar på 50 oppgaver.',
    icon: '📚',
    earned: ({ progress }) => progress.totalAnswers >= 50,
  },
  {
    id: 'five-hundred',
    category: BadgeCategory.Practice,
    title: 'Fem hundre svar',
    description: 'Svar på 500 oppgaver.',
    icon: '🏔️',
    earned: ({ progress }) => progress.totalAnswers >= 500,
  },
  {
    id: 'thousand',
    category: BadgeCategory.Practice,
    title: 'Tusen svar',
    description: 'Svar på 1 000 oppgaver.',
    icon: '🎉',
    earned: ({ progress }) => progress.totalAnswers >= 1000,
  },
  {
    id: 'combo-10',
    category: BadgeCategory.Practice,
    title: 'Ti på rad',
    description: 'Ti riktige svar etter hverandre.',
    icon: '🔥',
    earned: ({ progress }) => progress.bestCombo >= 10,
  },
  {
    id: 'combo-25',
    category: BadgeCategory.Practice,
    title: 'Tjuefem på rad',
    description: 'Tjuefem riktige svar etter hverandre.',
    icon: '⚡',
    earned: ({ progress }) => progress.bestCombo >= 25,
  },
  {
    id: 'combo-50',
    category: BadgeCategory.Practice,
    title: 'Femti på rad',
    description: 'Femti riktige svar etter hverandre.',
    icon: '💥',
    earned: ({ progress }) => progress.bestCombo >= 50,
  },
  {
    id: 'sharpshooter',
    category: BadgeCategory.Practice,
    title: 'Skarpskytter',
    description: '90 % riktige av minst 100 svar.',
    icon: '🎯',
    earned: ({ progress }) => progress.totalAnswers >= 100 && accuracy(progress) >= 0.9,
  },
  {
    id: 'streak-3',
    category: BadgeCategory.Practice,
    title: 'Tre dager',
    description: 'Øv tre dager på rad.',
    icon: '🗓️',
    earned: ({ progress }) => progress.bestStreakDays >= 3,
  },
  {
    id: 'streak-7',
    category: BadgeCategory.Practice,
    title: 'En uke',
    description: 'Øv sju dager på rad.',
    icon: '📅',
    earned: ({ progress }) => progress.bestStreakDays >= 7,
  },
  {
    id: 'streak-30',
    category: BadgeCategory.Practice,
    title: 'En måned',
    description: 'Øv tretti dager på rad.',
    icon: '🏆',
    earned: ({ progress }) => progress.bestStreakDays >= 30,
  },
  {
    id: 'streak-100',
    category: BadgeCategory.Practice,
    title: 'Hundre dager',
    description: 'Øv hundre dager på rad.',
    icon: '💯',
    earned: ({ progress }) => progress.bestStreakDays >= 100,
  },
  {
    id: 'goal-5',
    category: BadgeCategory.Practice,
    title: 'Fem dagsmål',
    description: 'Nå dagsmålet fem ganger.',
    icon: '🥉',
    earned: ({ progress }) => progress.goalDaysReached >= 5,
  },
  {
    id: 'goal-30',
    category: BadgeCategory.Practice,
    title: 'Tretti dagsmål',
    description: 'Nå dagsmålet tretti ganger.',
    icon: '🥇',
    earned: ({ progress }) => progress.goalDaysReached >= 30,
  },
  {
    id: 'first-sprout',
    category: BadgeCategory.Garden,
    title: 'Første spire',
    description: 'Et frø har spirt i hagen din.',
    icon: '🌱',
    earned: (state) => plantsAtLeast(state, PlantStage.Sprout) >= 1,
  },
  {
    id: 'first-bush',
    category: BadgeCategory.Garden,
    title: 'Første busk',
    description: 'En plante har vokst seg til en busk.',
    icon: '🌿',
    earned: (state) => plantsAtLeast(state, PlantStage.Bush) >= 1,
  },
  {
    id: 'first-tree',
    category: BadgeCategory.Garden,
    title: 'Første tre',
    description: 'En plante har blitt et tre: du har husket den i tre uker.',
    icon: '🌳',
    earned: (state) => plantsAtLeast(state, PlantStage.Tree) >= 1,
  },
  {
    id: 'first-blossom',
    category: BadgeCategory.Garden,
    title: 'I full blomst',
    description: 'Et tre blomstrer: husket i to måneder.',
    icon: '🌸',
    earned: (state) => plantsAtLeast(state, PlantStage.Blossom) >= 1,
  },
  {
    id: 'plant-doctor',
    category: BadgeCategory.Garden,
    title: 'Plantelege',
    description: 'En vissen plante har vokst seg frisk igjen.',
    icon: '🩹',
    earned: hasRecovered,
  },
  {
    id: 'gardener-25',
    category: BadgeCategory.Garden,
    title: 'Gartner',
    description: '25 planter er busker eller større.',
    icon: '🧑‍🌾',
    earned: (state) => plantsAtLeast(state, PlantStage.Bush) >= 25,
  },
  {
    id: 'garden-100',
    category: BadgeCategory.Garden,
    title: 'Hundre planter',
    description: 'Hundre planter vokser i hagen.',
    icon: '🏡',
    earned: (state) => plantsAtLeast(state, PlantStage.Sprout) >= 100,
  },
  {
    id: 'forest-50',
    category: BadgeCategory.Garden,
    title: 'Skog',
    description: '50 planter har blitt trær.',
    icon: '🌲',
    earned: (state) => plantsAtLeast(state, PlantStage.Tree) >= 50,
  },
  {
    id: 'all-gardens',
    category: BadgeCategory.Garden,
    title: 'Allsidig',
    description: 'Planter i tre ulike hager.',
    icon: '🧭',
    earned: (state) => gardensPlanted(state) >= 3,
  },
  {
    id: 'piggy-bank',
    category: BadgeCategory.Money,
    title: 'Sparegris',
    description: 'Ha 1 000 kr å bruke på en gang.',
    icon: '🐷',
    earned: ({ progress, garden }) => spendableXp(progress.xp, garden) >= 1000,
  },
  {
    // Ids kept from the former levels 5 and 10, at the XP those levels needed.
    id: 'level-5',
    category: BadgeCategory.Money,
    title: 'Godt spart',
    description: 'Tjen 6 400 kr til sammen.',
    icon: '💰',
    earned: ({ progress }) => progress.xp >= 6400,
  },
  {
    id: 'level-10',
    category: BadgeCategory.Money,
    title: 'Gullgruve',
    description: 'Tjen 32 400 kr til sammen.',
    icon: '👑',
    earned: ({ progress }) => progress.xp >= 32_400,
  },
  {
    id: 'first-purchase',
    category: BadgeCategory.Money,
    title: 'Første kjøp',
    description: 'Kjøp en ny planteart i frøbutikken.',
    icon: '🛍️',
    earned: ({ garden }) => garden.unlocked.length >= 2,
  },
  {
    id: 'collector-5',
    category: BadgeCategory.Money,
    title: 'Samler',
    description: 'Ha fem plantearter.',
    icon: '🧺',
    earned: ({ garden }) => garden.unlocked.length >= 5,
  },
  {
    id: 'collector-15',
    category: BadgeCategory.Money,
    title: 'Botaniker',
    description: 'Ha femten plantearter.',
    icon: '🔬',
    earned: ({ garden }) => garden.unlocked.length >= 15,
  },
  {
    id: 'collector-all',
    category: BadgeCategory.Money,
    title: 'Hele katalogen',
    description: 'Ha alle plantearter.',
    icon: '🌍',
    earned: ({ garden }) => garden.unlocked.length >= SPECIES.length,
  },
  {
    id: 'aurora',
    category: BadgeCategory.Money,
    title: 'Nordlys',
    description: 'Kjøp nordlystreet.',
    icon: '🌌',
    earned: ({ garden }) => garden.unlocked.includes(SpeciesId.Aurora),
  },
];

export function badgesFor(state: BadgeState): string[] {
  return BADGES.filter((badge) => badge.earned(state)).map((badge) => badge.id);
}

export function badgeById(id: string): Badge | undefined {
  return BADGES.find((badge) => badge.id === id);
}

/** Adds every badge `state` now earns to its progress; `newBadges` lists those that were not there yet. */
export function unlockBadges(state: BadgeState): { progress: Progress; newBadges: string[] } {
  const owned = state.progress.unlockedBadges;
  const newBadges = badgesFor(state).filter((badge) => !owned.includes(badge));

  if (newBadges.length === 0) {
    return { progress: state.progress, newBadges };
  }

  return { progress: { ...state.progress, unlockedBadges: [...owned, ...newBadges] }, newBadges };
}
