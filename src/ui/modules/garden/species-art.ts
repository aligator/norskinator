/**
 * Drawings per plant species, in the 64×64 box of `plant-sprite` with the
 * soil line at y = 58. Seed and sprout look the same for every species; from
 * the plant stage on each one grows its own way. Blooms are drawn as separate
 * `.bloom` groups so the sprite can pop them open one after another.
 */
import { svg, type SVGTemplateResult } from 'lit';

import type { PlantStage } from '../../../core/garden.ts';
import { SpeciesId } from '../../../core/species.ts';
import { LEAFY_PLANT, ROUND_BUSH } from './art/common.ts';
import { FLOWER_ART } from './art/flowers.ts';
import type { Point, SpeciesArt } from './art/shapes.ts';
import { TREE_ART } from './art/trees.ts';

/** The stages each species draws its own way; `blossom` adds blooms on top of `tree`. */
export type GrownStage = PlantStage.Plant | PlantStage.Bush | PlantStage.Tree;

/** The first species, drawn before the art was split into files. */
type ClassicId =
  | SpeciesId.Apple
  | SpeciesId.Sunflower
  | SpeciesId.Spruce
  | SpeciesId.Cactus
  | SpeciesId.Cherry
  | SpeciesId.Birch
  | SpeciesId.Lavender;

function blooms(points: readonly Point[], petals: string, core: string, radius = 2.8): SVGTemplateResult {
  return svg`${points.map(
    ([x, y]) => svg`<g class="bloom">
      <circle class=${petals} cx=${x} cy=${y} r=${radius} />
      <circle class=${core} cx=${x} cy=${y} r=${radius * 0.4} />
    </g>`,
  )}`;
}

const apple: Omit<SpeciesArt, 'blossom'> = {
  plant: LEAFY_PLANT,
  bush: ROUND_BUSH,
  tree: svg`
    <path class="trunk" d="M29.5 58 30.6 36h2.8l1.1 22z" />
    <path class="branch" d="M32 45l-6-5" />
    <circle class="leaf-dark" cx="20" cy="30" r="9" />
    <circle class="leaf-dark" cx="44" cy="30" r="9" />
    <circle class="leaf" cx="32" cy="24" r="13" />
    <circle class="leaf-light" cx="26" cy="18" r="7" />
    <circle class="leaf-light" cx="39" cy="17" r="5.5" />
  `,
};

const sunflower: Omit<SpeciesArt, 'blossom'> = {
  plant: svg`
    <path class="stem" d="M32 58V30" />
    <path class="leaf" d="M32 50c-4-5-11-5-13-1 4 4 9 4 13 1z" />
    <path class="leaf-light" d="M32 41c4-5 11-5 13-1-4 4-9 4-13 1z" />
    <circle class="leaf-dark" cx="32" cy="29" r="3" />
  `,
  bush: svg`
    <path class="stem" d="M32 58V22" />
    <path class="leaf" d="M32 52c-5-6-13-6-15-1 5 4 11 4 15 1z" />
    <path class="leaf-light" d="M32 43c5-6 13-6 15-1-5 4-11 4-15 1z" />
    <path class="leaf" d="M32 34c-4-5-10-5-12-1 4 3 8 4 12 1z" />
    <path class="sun" d="M32 13l2.4 4.2 4.6-1.6-1.6 4.6L41.6 22l-4.2 2.4 1.6 4.6-4.6-1.6L32 31.6l-2.4-4.2-4.6 1.6 1.6-4.6L22.4 22l4.2-2.4-1.6-4.6 4.6 1.6z" opacity="0.55" />
    <circle class="leaf-dark" cx="32" cy="22" r="5.5" />
  `,
  tree: svg`
    <path class="stem" d="M32 58V20" />
    <path class="leaf" d="M32 52c-6-7-15-7-17-1 6 5 12 5 17 1z" />
    <path class="leaf-light" d="M32 42c6-7 15-7 17-1-6 5-12 5-17 1z" />
    <path class="leaf" d="M32 32c-5-6-12-6-14-1 5 4 10 4 14 1z" />
    <g class="sun">
      ${[0, 45, 90, 135, 180, 225, 270, 315].map(
        (angle) => svg`<ellipse cx="32" cy="7" rx="3.4" ry="6.5" transform=${`rotate(${angle} 32 17)`} />`,
      )}
    </g>
    <circle class="sun-core" cx="32" cy="17" r="6.5" />
  `,
};

const spruce: Omit<SpeciesArt, 'blossom'> = {
  plant: svg`
    <path class="trunk" d="M31.2 58v-6h1.6v6z" />
    <path class="leaf-dark" d="M32 36l9 17H23z" />
    <path class="leaf" d="M32 32l6 11H26z" />
  `,
  bush: svg`
    <path class="trunk" d="M30.8 58v-6h2.4v6z" />
    <path class="leaf-dark" d="M32 28l14 25H18z" />
    <path class="leaf" d="M32 22l10 17H22z" />
    <path class="leaf-light" d="M32 17l6 10H26z" />
  `,
  tree: svg`
    <path class="trunk" d="M30.2 58v-8h3.6v8z" />
    <path class="leaf-dark" d="M32 30l17 21H15z" />
    <path class="leaf" d="M32 20l13 17H19z" />
    <path class="leaf-dark" d="M32 11l10 14H22z" />
    <path class="leaf-light" d="M32 4l6 10H26z" />
  `,
};

const cactus: Omit<SpeciesArt, 'blossom'> = {
  plant: svg`
    <rect class="cactus" x="28.5" y="42" width="7" height="16" rx="3.5" />
    <path class="cactus-rib" d="M32 44v13" />
  `,
  bush: svg`
    <rect class="cactus" x="28" y="30" width="8" height="28" rx="4" />
    <path class="cactus" d="M28 46h-4a3 3 0 0 1-3-3v-6a2.5 2.5 0 0 1 5 0v4h2z" />
    <path class="cactus-rib" d="M32 32v25" />
  `,
  tree: svg`
    <rect class="cactus" x="27" y="16" width="10" height="42" rx="5" />
    <path class="cactus" d="M27 42h-6a4 4 0 0 1-4-4V28a3 3 0 0 1 6 0v8h4z" />
    <path class="cactus" d="M37 36h6a4 4 0 0 0 4-4v-8a3 3 0 0 0-6 0v6h-4z" />
    <path class="cactus-rib" d="M32 19v38M20 28v10M44 24v8" />
  `,
};

const cherry: Omit<SpeciesArt, 'blossom'> = {
  plant: LEAFY_PLANT,
  bush: svg`
    <path class="trunk dark" d="M30.6 58 31 46h2l.4 12z" />
    <ellipse class="leaf-dark" cx="32" cy="42" rx="15" ry="8" />
    <ellipse class="leaf" cx="32" cy="37" rx="11" ry="7" />
    <ellipse class="leaf-light" cx="28" cy="34" rx="5" ry="3" />
  `,
  tree: svg`
    <path class="trunk dark" d="M30 58l.8-18h2.4l.8 18z" />
    <path class="branch dark" d="M32 42l-9-8M32 40l8-9" />
    <ellipse class="leaf-dark" cx="32" cy="28" rx="22" ry="10" />
    <ellipse class="leaf" cx="32" cy="22" rx="16" ry="9" />
    <ellipse class="leaf-light" cx="26" cy="19" rx="7" ry="4" />
  `,
};

const birch: Omit<SpeciesArt, 'blossom'> = {
  plant: svg`
    <path class="bark" d="M31 58V34h2v24z" />
    <path class="leaf-light" d="M33 40c3-3 7-3 8 0-3 2-6 2-8 0z" />
    <path class="leaf" d="M31 46c-3-3-7-3-8 0 3 2 6 2 8 0z" />
    <path class="leaf-light" d="M32 35c-1-3 0-5 0-5s1 2 0 5z" />
  `,
  bush: svg`
    <path class="bark" d="M30.8 58V28h2.4v30z" />
    <path class="bark-mark" d="M30.8 50h1.4M32 44h1.2M30.8 38h1.4" />
    <ellipse class="leaf" cx="32" cy="27" rx="9" ry="12" />
    <ellipse class="leaf-light" cx="29" cy="23" rx="4" ry="6" />
  `,
  tree: svg`
    <path class="bark" d="M30.2 58 30.8 20h2.4l.6 38z" />
    <path class="bark-mark" d="M30.4 52h1.6M32 46h1.6M30.6 40h1.4M32.2 34h1.2M30.8 28h1.4" />
    <ellipse class="leaf-dark" cx="32" cy="24" rx="12" ry="18" />
    <ellipse class="leaf" cx="31" cy="19" rx="9" ry="13" />
    <ellipse class="leaf-light" cx="28" cy="14" rx="4" ry="6" />
  `,
};

function lavenderSpike(x: number, top: number): SVGTemplateResult {
  return svg`
    <path class="lavender-stem" d=${`M32 56 Q${(32 + x) / 2} ${(56 + top) / 2} ${x} ${top}`} />
    <ellipse class="lavender" cx=${x} cy=${top - 3} rx="2" ry="4" />
  `;
}

const lavender: Omit<SpeciesArt, 'blossom'> = {
  plant: svg`
    <path class="lavender-stem" d="M32 58c-1-5-3-9-6-12M32 58c0-6 0-10 0-14M32 58c1-5 3-9 6-12" />
  `,
  bush: svg`
    <path class="lavender-stem" d="M32 58c-2-5-5-9-9-11M32 58c2-5 5-9 9-11" />
    ${lavenderSpike(26, 34)} ${lavenderSpike(32, 30)} ${lavenderSpike(38, 34)}
  `,
  tree: svg`
    <path class="lavender-stem" d="M32 58c-3-5-7-8-12-9M32 58c3-5 7-8 12-9" />
    ${lavenderSpike(18, 30)} ${lavenderSpike(24, 24)} ${lavenderSpike(29, 18)}
    ${lavenderSpike(35, 18)} ${lavenderSpike(40, 24)} ${lavenderSpike(46, 30)}
  `,
};

/** What appears when the plant blossoms, on top of its tree drawing. */
const BLOSSOMS: Readonly<Record<ClassicId, SVGTemplateResult>> = {
  [SpeciesId.Apple]: blooms(
    [
      [24, 22],
      [37, 14],
      [44, 28],
      [29, 31],
      [18, 31],
      [33, 22],
    ],
    'petals',
    'bloom-core',
  ),
  [SpeciesId.Sunflower]: blooms(
    [
      [20, 40],
      [44, 34],
    ],
    'sun',
    'sun-core',
    3.6,
  ),
  [SpeciesId.Spruce]: svg`${[
    [24, 44],
    [40, 46],
    [27, 31],
    [38, 30],
    [32, 18],
  ].map(([x, y]) => svg`<g class="bloom"><ellipse class="cone" cx=${x} cy=${y} rx="1.8" ry="3" /></g>`)}`,
  [SpeciesId.Cactus]: blooms(
    [
      [32, 15],
      [20, 25],
      [44, 21],
    ],
    'flower-red',
    'bloom-core',
    3.4,
  ),
  [SpeciesId.Cherry]: blooms(
    [
      [14, 28],
      [21, 22],
      [28, 16],
      [36, 15],
      [43, 21],
      [50, 28],
      [25, 30],
      [32, 25],
      [40, 31],
    ],
    'petals light',
    'bloom-core',
    3,
  ),
  [SpeciesId.Birch]: svg`${[
    [24, 22],
    [40, 26],
    [30, 32],
    [36, 14],
  ].map(([x, y]) => svg`<g class="bloom"><path class="catkin" d=${`M${x} ${y}q1 3 0 6`} /></g>`)}`,
  [SpeciesId.Lavender]: blooms(
    [
      [21, 16],
      [43, 16],
      [32, 10],
    ],
    'lavender light',
    'bloom-core',
    2.4,
  ),
};

const ART: Readonly<Record<SpeciesId, SpeciesArt>> = {
  [SpeciesId.Apple]: { ...apple, blossom: BLOSSOMS[SpeciesId.Apple] },
  [SpeciesId.Sunflower]: { ...sunflower, blossom: BLOSSOMS[SpeciesId.Sunflower] },
  [SpeciesId.Spruce]: { ...spruce, blossom: BLOSSOMS[SpeciesId.Spruce] },
  [SpeciesId.Cactus]: { ...cactus, blossom: BLOSSOMS[SpeciesId.Cactus] },
  [SpeciesId.Cherry]: { ...cherry, blossom: BLOSSOMS[SpeciesId.Cherry] },
  [SpeciesId.Birch]: { ...birch, blossom: BLOSSOMS[SpeciesId.Birch] },
  [SpeciesId.Lavender]: { ...lavender, blossom: BLOSSOMS[SpeciesId.Lavender] },
  ...FLOWER_ART,
  ...TREE_ART,
};

export function stageArt(species: SpeciesId, stage: GrownStage): SVGTemplateResult {
  return ART[species][stage];
}

export function blossomArt(species: SpeciesId): SVGTemplateResult {
  return ART[species].blossom;
}
