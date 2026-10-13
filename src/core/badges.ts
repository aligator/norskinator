/**
 * Badges in three groups: practice, the garden and money. Each is a rule over
 * the learner's whole state, so garden and shop milestones count as much as
 * answers. Badge ids are stored in `progress.unlockedBadges` and are
 * permanent: rename the title, never the id.
 */
import type { Progress } from './gamification.ts';
import { plantOf, stageRank, type PlantStage } from './garden.ts';
import { SPECIES, spendableXp, type GardenState } from './species.ts';
import type { CardState } from './srs.ts';

export type BadgeCategory = 'practice' | 'garden' | 'money';

export const BADGE_CATEGORY_LABELS: Readonly<Record<BadgeCategory, string>> = {
  practice: 'Øving',
  garden: 'Hagen',
  money: 'Penger',
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
  return Object.values(cards).some((card) => card.lapses > 0 && card.phase === 'review');
}

function gardensPlanted({ cards }: BadgeState): number {
  return new Set(Object.values(cards).map((card) => card.deckId)).size;
}

export const BADGES: readonly Badge[] = [
  {
    id: 'first-steps',
    category: 'practice',
    title: 'Første steg',
    description: 'Svar riktig på din første oppgave.',
    icon: '👣',
    earned: ({ progress }) => progress.correctAnswers >= 1,
  },
  {
    id: 'fifty-answers',
    category: 'practice',
    title: 'Femti svar',
    description: 'Svar på 50 oppgaver.',
    icon: '📚',
    earned: ({ progress }) => progress.totalAnswers >= 50,
  },
  {
    id: 'five-hundred',
    category: 'practice',
    title: 'Fem hundre svar',
    description: 'Svar på 500 oppgaver.',
    icon: '🏔️',
    earned: ({ progress }) => progress.totalAnswers >= 500,
  },
  {
    id: 'thousand',
    category: 'practice',
    title: 'Tusen svar',
    description: 'Svar på 1 000 oppgaver.',
    icon: '🎉',
    earned: ({ progress }) => progress.totalAnswers >= 1000,
  },
  {
    id: 'combo-10',
    category: 'practice',
    title: 'Ti på rad',
    description: 'Ti riktige svar etter hverandre.',
    icon: '🔥',
    earned: ({ progress }) => progress.bestCombo >= 10,
  },
  {
    id: 'combo-25',
    category: 'practice',
    title: 'Tjuefem på rad',
    description: 'Tjuefem riktige svar etter hverandre.',
    icon: '⚡',
    earned: ({ progress }) => progress.bestCombo >= 25,
  },
  {
    id: 'combo-50',
    category: 'practice',
    title: 'Femti på rad',
    description: 'Femti riktige svar etter hverandre.',
    icon: '💥',
    earned: ({ progress }) => progress.bestCombo >= 50,
  },
  {
    id: 'sharpshooter',
    category: 'practice',
    title: 'Skarpskytter',
    description: '90 % riktige av minst 100 svar.',
    icon: '🎯',
    earned: ({ progress }) => progress.totalAnswers >= 100 && accuracy(progress) >= 0.9,
  },
  {
    id: 'streak-3',
    category: 'practice',
    title: 'Tre dager',
    description: 'Øv tre dager på rad.',
    icon: '🗓️',
    earned: ({ progress }) => progress.bestStreakDays >= 3,
  },
  {
    id: 'streak-7',
    category: 'practice',
    title: 'En uke',
    description: 'Øv sju dager på rad.',
    icon: '📅',
    earned: ({ progress }) => progress.bestStreakDays >= 7,
  },
  {
    id: 'streak-30',
    category: 'practice',
    title: 'En måned',
    description: 'Øv tretti dager på rad.',
    icon: '🏆',
    earned: ({ progress }) => progress.bestStreakDays >= 30,
  },
  {
    id: 'streak-100',
    category: 'practice',
    title: 'Hundre dager',
    description: 'Øv hundre dager på rad.',
    icon: '💯',
    earned: ({ progress }) => progress.bestStreakDays >= 100,
  },
  {
    id: 'goal-5',
    category: 'practice',
    title: 'Fem dagsmål',
    description: 'Nå dagsmålet fem ganger.',
    icon: '🥉',
    earned: ({ progress }) => progress.goalDaysReached >= 5,
  },
  {
    id: 'goal-30',
    category: 'practice',
    title: 'Tretti dagsmål',
    description: 'Nå dagsmålet tretti ganger.',
    icon: '🥇',
    earned: ({ progress }) => progress.goalDaysReached >= 30,
  },
  {
    id: 'first-sprout',
    category: 'garden',
    title: 'Første spire',
    description: 'Et frø har spirt i hagen din.',
    icon: '🌱',
    earned: (state) => plantsAtLeast(state, 'sprout') >= 1,
  },
  {
    id: 'first-bush',
    category: 'garden',
    title: 'Første busk',
    description: 'En plante har vokst seg til en busk.',
    icon: '🌿',
    earned: (state) => plantsAtLeast(state, 'bush') >= 1,
  },
  {
    id: 'first-tree',
    category: 'garden',
    title: 'Første tre',
    description: 'En plante har blitt et tre: du har husket den i tre uker.',
    icon: '🌳',
    earned: (state) => plantsAtLeast(state, 'tree') >= 1,
  },
  {
    id: 'first-blossom',
    category: 'garden',
    title: 'I full blomst',
    description: 'Et tre blomstrer: husket i to måneder.',
    icon: '🌸',
    earned: (state) => plantsAtLeast(state, 'blossom') >= 1,
  },
  {
    id: 'plant-doctor',
    category: 'garden',
    title: 'Plantelege',
    description: 'En vissen plante har vokst seg frisk igjen.',
    icon: '🩹',
    earned: hasRecovered,
  },
  {
    id: 'gardener-25',
    category: 'garden',
    title: 'Gartner',
    description: '25 planter er busker eller større.',
    icon: '🧑‍🌾',
    earned: (state) => plantsAtLeast(state, 'bush') >= 25,
  },
  {
    id: 'garden-100',
    category: 'garden',
    title: 'Hundre planter',
    description: 'Hundre planter vokser i hagen.',
    icon: '🏡',
    earned: (state) => plantsAtLeast(state, 'sprout') >= 100,
  },
  {
    id: 'forest-50',
    category: 'garden',
    title: 'Skog',
    description: '50 planter har blitt trær.',
    icon: '🌲',
    earned: (state) => plantsAtLeast(state, 'tree') >= 50,
  },
  {
    id: 'all-gardens',
    category: 'garden',
    title: 'Allsidig',
    description: 'Planter i tre ulike hager.',
    icon: '🧭',
    earned: (state) => gardensPlanted(state) >= 3,
  },
  {
    id: 'piggy-bank',
    category: 'money',
    title: 'Sparegris',
    description: 'Ha 1 000 kr å bruke på en gang.',
    icon: '🐷',
    earned: ({ progress, garden }) => spendableXp(progress.xp, garden) >= 1000,
  },
  {
    // Ids kept from the former levels 5 and 10, at the XP those levels needed.
    id: 'level-5',
    category: 'money',
    title: 'Godt spart',
    description: 'Tjen 6 400 kr til sammen.',
    icon: '💰',
    earned: ({ progress }) => progress.xp >= 6400,
  },
  {
    id: 'level-10',
    category: 'money',
    title: 'Gullgruve',
    description: 'Tjen 32 400 kr til sammen.',
    icon: '👑',
    earned: ({ progress }) => progress.xp >= 32_400,
  },
  {
    id: 'first-purchase',
    category: 'money',
    title: 'Første kjøp',
    description: 'Kjøp en ny planteart i frøbutikken.',
    icon: '🛍️',
    earned: ({ garden }) => garden.unlocked.length >= 2,
  },
  {
    id: 'collector-5',
    category: 'money',
    title: 'Samler',
    description: 'Ha fem plantearter.',
    icon: '🧺',
    earned: ({ garden }) => garden.unlocked.length >= 5,
  },
  {
    id: 'collector-15',
    category: 'money',
    title: 'Botaniker',
    description: 'Ha femten plantearter.',
    icon: '🔬',
    earned: ({ garden }) => garden.unlocked.length >= 15,
  },
  {
    id: 'collector-all',
    category: 'money',
    title: 'Hele katalogen',
    description: 'Ha alle plantearter.',
    icon: '🌍',
    earned: ({ garden }) => garden.unlocked.length >= SPECIES.length,
  },
  {
    id: 'aurora',
    category: 'money',
    title: 'Nordlys',
    description: 'Kjøp nordlystreet.',
    icon: '🌌',
    earned: ({ garden }) => garden.unlocked.includes('aurora'),
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
