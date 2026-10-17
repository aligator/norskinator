/**
 * Plant species and the shop. Every plant grows as one species, picked at
 * random from the learner's species when the item is first answered. New
 * species are bought with XP (shown as money); total XP never drops, the shop
 * keeps its own tally of what was spent.
 */

export enum SpeciesId {
  Apple = 'apple',
  Dandelion = 'dandelion',
  Sunflower = 'sunflower',
  Wheat = 'wheat',
  Daisy = 'daisy',
  Tulip = 'tulip',
  Heather = 'heather',
  Fern = 'fern',
  Poppy = 'poppy',
  Spruce = 'spruce',
  Strawberry = 'strawberry',
  Blueberry = 'blueberry',
  Rose = 'rose',
  Pumpkin = 'pumpkin',
  Cactus = 'cactus',
  Pine = 'pine',
  Rowan = 'rowan',
  Oak = 'oak',
  Cherry = 'cherry',
  Bamboo = 'bamboo',
  Maple = 'maple',
  Palm = 'palm',
  Birch = 'birch',
  Hydrangea = 'hydrangea',
  Lavender = 'lavender',
  Bonsai = 'bonsai',
  Aurora = 'aurora',
}

export interface Species {
  readonly id: SpeciesId;
  readonly name: string;
  readonly description: string;
  /** Price in the shop; 0 for the species every garden starts with. */
  readonly price: number;
}

/** Cheapest first, the order the shop shows them in. */
export const SPECIES: readonly Species[] = [
  { id: SpeciesId.Apple, name: 'Epletre', description: 'Rund krone og rosa blomster.', price: 0 },
  { id: SpeciesId.Dandelion, name: 'Løvetann', description: 'Gul blomst som blir til en luftig fnokk.', price: 200 },
  { id: SpeciesId.Sunflower, name: 'Solsikke', description: 'Vender ansiktet mot sola.', price: 300 },
  { id: SpeciesId.Wheat, name: 'Hvete', description: 'Gylne aks som vaier i vinden.', price: 350 },
  { id: SpeciesId.Daisy, name: 'Prestekrage', description: 'Hvite kronblader rundt en gul midte.', price: 400 },
  { id: SpeciesId.Tulip, name: 'Tulipan', description: 'Røde, gule og rosa begre om våren.', price: 500 },
  { id: SpeciesId.Heather, name: 'Røsslyng', description: 'Lilla lyng fra de norske heiene.', price: 600 },
  { id: SpeciesId.Fern, name: 'Bregne', description: 'Grønne blader som ruller seg ut.', price: 700 },
  { id: SpeciesId.Poppy, name: 'Valmue', description: 'Knallrøde kronblader.', price: 750 },
  { id: SpeciesId.Spruce, name: 'Gran', description: 'Grønn hele året, med kongler.', price: 800 },
  { id: SpeciesId.Strawberry, name: 'Jordbær', description: 'Først hvite blomster, så søte bær.', price: 900 },
  { id: SpeciesId.Blueberry, name: 'Blåbær', description: 'Blå bær fra skogen.', price: 1000 },
  { id: SpeciesId.Rose, name: 'Rose', description: 'Den klassiske røde rosen.', price: 1200 },
  { id: SpeciesId.Pumpkin, name: 'Gresskar', description: 'Store, oransje gresskar på ranker.', price: 1400 },
  { id: SpeciesId.Cactus, name: 'Kaktus', description: 'Tåler alt og blomstrer rødt.', price: 1500 },
  { id: SpeciesId.Pine, name: 'Furu', description: 'Høy stamme med kronen på toppen.', price: 1700 },
  { id: SpeciesId.Rowan, name: 'Rogn', description: 'Klaser med røde bær om høsten.', price: 2000 },
  { id: SpeciesId.Oak, name: 'Eik', description: 'Bred krone som bærer eikenøtter.', price: 2200 },
  { id: SpeciesId.Cherry, name: 'Kirsebærtre', description: 'Et hav av lyserosa blomster.', price: 2500 },
  { id: SpeciesId.Bamboo, name: 'Bambus', description: 'Vokser i høyden, ledd for ledd.', price: 2800 },
  { id: SpeciesId.Maple, name: 'Lønn', description: 'Brenner i rødt og oransje.', price: 3200 },
  { id: SpeciesId.Palm, name: 'Palme', description: 'Kokosnøtter under bladene.', price: 3800 },
  { id: SpeciesId.Birch, name: 'Bjørk', description: 'Hvit stamme, lett krone. Norges nasjonaltre.', price: 4000 },
  { id: SpeciesId.Hydrangea, name: 'Hortensia', description: 'Store kuler av blå blomster.', price: 4500 },
  { id: SpeciesId.Lavender, name: 'Lavendel', description: 'Lilla aks som dufter.', price: 6000 },
  { id: SpeciesId.Bonsai, name: 'Bonsai', description: 'Et lite tre i potte, formet med tålmodighet.', price: 7000 },
  { id: SpeciesId.Aurora, name: 'Nordlystre', description: 'Lyser som nordlyset. Bare for de flittigste.', price: 10_000 },
];

/** Plants sown before species existed grow as this one. */
export const DEFAULT_SPECIES: SpeciesId = SpeciesId.Apple;

export interface GardenState {
  readonly unlocked: readonly SpeciesId[];
  /** XP spent in the shop so far. */
  readonly spentXp: number;
  /** Species per item id, fixed when the item is sown. */
  readonly species: Readonly<Record<string, SpeciesId>>;
}

export const INITIAL_GARDEN: GardenState = {
  unlocked: [DEFAULT_SPECIES],
  spentXp: 0,
  species: {},
};

export function speciesById(id: SpeciesId): Species {
  return SPECIES.find((species) => species.id === id) ?? SPECIES[0]!;
}

export function speciesOf(garden: GardenState, itemId: string): SpeciesId {
  return garden.species[itemId] ?? DEFAULT_SPECIES;
}

export function spendableXp(xp: number, garden: GardenState): number {
  return Math.max(0, xp - garden.spentXp);
}

export function canBuy(xp: number, garden: GardenState, id: SpeciesId): boolean {
  return !garden.unlocked.includes(id) && speciesById(id).price <= spendableXp(xp, garden);
}

/** The cheapest species the learner can buy right now, if any. */
export function firstAffordable(xp: number, garden: GardenState): Species | null {
  return SPECIES.find((species) => canBuy(xp, garden, species.id)) ?? null;
}

/** The garden after buying `id`, or null when it is owned already or too expensive. */
export function buySpecies(xp: number, garden: GardenState, id: SpeciesId): GardenState | null {
  if (!canBuy(xp, garden, id)) {
    return null;
  }

  return {
    ...garden,
    unlocked: [...garden.unlocked, id],
    spentXp: garden.spentXp + speciesById(id).price,
  };
}

/** Gives a newly sown item a random species of those unlocked; a sown item keeps its own. */
export function sow(garden: GardenState, itemId: string, random: () => number): GardenState {
  if (garden.species[itemId] !== undefined) {
    return garden;
  }

  const index = Math.min(Math.floor(random() * garden.unlocked.length), garden.unlocked.length - 1);
  const picked = garden.unlocked[index] ?? DEFAULT_SPECIES;

  return { ...garden, species: { ...garden.species, [itemId]: picked } };
}
