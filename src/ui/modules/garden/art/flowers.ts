/** Flowers, herbs and small shrubs: they grow wider and bloom more instead of growing tall. */
import { svg } from 'lit';

import { SpeciesId } from '../../../../core/species.ts';
import {
  berry,
  bud,
  butterfly,
  each,
  eachBloom,
  petalFlower,
  stems,
  tulipHead,
  type Point,
  type SpeciesArt,
} from './shapes.ts';

const ROSETTE = svg`
  <path class="leaf" d="M32 57c-6-2-12-6-14-11 6 1 11 5 14 11z" />
  <path class="leaf-light" d="M32 57c6-2 12-6 14-11-6 1-11 5-14 11z" />
  <path class="leaf-dark" d="M32 57c-2-5-2-11 0-15 2 4 2 10 0 15z" />
`;

function puff([x, y]: Point): ReturnType<typeof svg> {
  return svg`
    <circle class="puff" cx=${x} cy=${y} r="5" />
    ${[0, 45, 90, 135].map(
      (angle) => svg`<path class="puff-line" d=${`M${x - 5} ${y}h10`} transform=${`rotate(${angle} ${x} ${y})`} />`,
    )}
  `;
}

const dandelion: SpeciesArt = {
  plant: svg`${ROSETTE}${stems([[32, 40]], false)}${bud([32, 39], 2.5)}`,
  bush: svg`${ROSETTE}${stems([[26, 32], [38, 36]], false)}
    ${petalFlower([26, 31], 6, 'sun', 'sun', 12)}${bud([38, 35], 2.5)}`,
  tree: svg`${ROSETTE}${stems([[22, 28], [32, 22], [42, 30]], false)}
    ${each([[22, 27], [32, 21], [42, 29]], (point) => petalFlower(point, 7, 'sun', 'sun', 12))}`,
  blossom: eachBloom([[22, 27], [42, 29]], puff),
};

function ear([x, y]: Point, colour: string): ReturnType<typeof svg> {
  return svg`${[0, 4, 8].map(
    (offset) => svg`
      <ellipse class=${colour} cx=${x - 1.4} cy=${y + offset} rx="1.5" ry="2.4" transform=${`rotate(-20 ${x - 1.4} ${y + offset})`} />
      <ellipse class=${colour} cx=${x + 1.4} cy=${y + offset} rx="1.5" ry="2.4" transform=${`rotate(20 ${x + 1.4} ${y + offset})`} />
    `,
  )}`;
}

const wheat: SpeciesArt = {
  plant: svg`<path class="stem" d="M32 58c-1-6-3-11-6-15M32 58V40M32 58c1-6 3-11 6-15" />`,
  bush: svg`${stems([[27, 30], [37, 30]], false)}${ear([27, 22], 'leaf')}${ear([37, 22], 'leaf')}`,
  tree: svg`${stems([[20, 24], [26, 18], [32, 14], [38, 18], [44, 24]], false)}
    ${each([[20, 15], [26, 9], [32, 5], [38, 9], [44, 15]], (point) => ear(point, 'wheat'))}`,
  blossom: eachBloom([[14, 26], [50, 26]], (point) => svg`${stems([point], false)}${ear([point[0], point[1] - 9], 'wheat')}`),
};

const daisy: SpeciesArt = {
  plant: svg`${stems([[32, 40]])}${bud([32, 39], 2.5, 'leaf')}`,
  bush: svg`${stems([[26, 34], [38, 30]])}${petalFlower([26, 33], 6, 'white', 'sun')}${petalFlower([38, 29], 6, 'white', 'sun')}`,
  tree: svg`${stems([[20, 30], [28, 22], [37, 20], [45, 28]])}
    ${each([[20, 29], [28, 21], [37, 19], [45, 27]], (point) => petalFlower(point, 7, 'white', 'sun'))}`,
  blossom: svg`${eachBloom([[14, 40], [50, 40], [32, 32]], (point) => petalFlower(point, 5, 'white', 'sun'))}
    ${eachBloom([[48, 12]], butterfly)}`,
};

const TULIP_LEAVES = svg`
  <path class="leaf" d="M32 58c-6-6-8-14-6-22 4 6 6 14 6 22z" />
  <path class="leaf-light" d="M32 58c6-6 8-14 6-22-4 6-6 14-6 22z" />
`;

const tulip: SpeciesArt = {
  plant: svg`${TULIP_LEAVES}${stems([[32, 34]], false)}${bud([32, 33], 3, 'leaf-dark')}`,
  bush: svg`${TULIP_LEAVES}${stems([[27, 28], [38, 32]], false)}${tulipHead([27, 26], 4, 'flower-red')}${tulipHead([38, 30], 4, 'sun')}`,
  tree: svg`${TULIP_LEAVES}${stems([[20, 26], [28, 18], [37, 16], [45, 24]], false)}
    ${tulipHead([20, 24], 5, 'flower-red')}${tulipHead([28, 16], 5, 'sun')}
    ${tulipHead([37, 14], 5, 'petals')}${tulipHead([45, 22], 5, 'flower-red')}`,
  blossom: svg`${eachBloom([[14, 36], [50, 36]], (point) => tulipHead(point, 4, 'heather'))}${eachBloom([[32, 6]], butterfly)}`,
};

function heatherMound(width: number, height: number): ReturnType<typeof svg> {
  return svg`
    <ellipse class="leaf-dark" cx="32" cy=${58 - height / 2} rx=${width} ry=${height / 2} />
    <ellipse class="leaf" cx="30" cy=${58 - height * 0.6} rx=${width * 0.6} ry=${height * 0.32} />
  `;
}

function dots(points: readonly Point[], colour: string, radius = 1.6): ReturnType<typeof svg> {
  return each(points, ([x, y]) => svg`<circle class=${colour} cx=${x} cy=${y} r=${radius} />`);
}

const heather: SpeciesArt = {
  plant: heatherMound(8, 10),
  bush: svg`${heatherMound(14, 18)}${dots([[24, 46], [30, 42], [37, 44], [41, 49], [27, 51]], 'heather')}`,
  tree: svg`${heatherMound(22, 28)}
    ${dots([[14, 48], [19, 40], [25, 34], [31, 31], [38, 33], [44, 38], [49, 46], [22, 50], [33, 44], [41, 50], [28, 40], [37, 41]], 'heather', 1.9)}`,
  blossom: svg`${eachBloom([[17, 44], [26, 37], [35, 36], [46, 42], [30, 48]], ([x, y]) => dots([[x, y], [x + 2, y - 2], [x - 2, y - 1]], 'heather light', 1.5))}`,
};

function frond([x, y]: Point, colour: string): ReturnType<typeof svg> {
  return svg`<path class=${colour} d=${`M32 58Q${(32 + x) / 2 + (x < 32 ? 4 : -4)} ${(58 + y) / 2} ${x} ${y}q${x < 32 ? 6 : -6} 6 ${x < 32 ? 2 : -2} 14z`} />`;
}

const fern: SpeciesArt = {
  plant: svg`${frond([24, 40], 'leaf')}${frond([40, 42], 'leaf-light')}`,
  bush: svg`${frond([16, 36], 'leaf-dark')}${frond([26, 28], 'leaf')}${frond([38, 28], 'leaf-light')}${frond([48, 36], 'leaf')}`,
  tree: svg`${frond([8, 34], 'leaf-dark')}${frond([16, 22], 'leaf')}${frond([28, 12], 'leaf-light')}
    ${frond([36, 12], 'leaf')}${frond([48, 22], 'leaf-light')}${frond([56, 34], 'leaf-dark')}`,
  blossom: eachBloom(
    [[22, 44], [42, 44], [32, 36]],
    ([x, y]) => svg`<path class="fiddle" d=${`M${x} ${y + 8}v-6a3 3 0 1 1 3 3`} />`,
  ),
};

const poppy: SpeciesArt = {
  plant: svg`${stems([[32, 38]])}${bud([32, 37], 3, 'leaf')}`,
  bush: svg`${stems([[26, 30], [38, 34]])}${petalFlower([26, 29], 7, 'poppy', 'bark-mark', 5)}${bud([38, 33], 3, 'leaf')}`,
  tree: svg`${stems([[19, 28], [29, 18], [39, 22], [46, 32]])}
    ${each([[19, 27], [29, 17], [39, 21], [46, 31]], (point) => petalFlower(point, 8, 'poppy', 'bark-mark', 5))}`,
  blossom: svg`${eachBloom([[12, 40], [52, 42]], (point) => petalFlower(point, 6, 'poppy', 'bark-mark', 5))}${eachBloom([[34, 6]], butterfly)}`,
};

function strawberry([x, y]: Point): ReturnType<typeof svg> {
  return svg`
    <path class="flower-red" d=${`M${x - 3.5} ${y - 2}q0 6 3.5 7q3.5-1 3.5-7z`} />
    <path class="leaf" d=${`M${x - 3} ${y - 2}l3-2 3 2z`} />
    <circle class="sun" cx=${x - 1} cy=${y + 1} r="0.5" /><circle class="sun" cx=${x + 1} cy=${y + 2.5} r="0.5" />
  `;
}

function trefoil([x, y]: Point, colour: string): ReturnType<typeof svg> {
  return svg`${[-40, 0, 40].map(
    (angle) => svg`<ellipse class=${colour} cx=${x} cy=${y - 4} rx="3.4" ry="4.6" transform=${`rotate(${angle} ${x} ${y})`} />`,
  )}`;
}

const strawberryArt: SpeciesArt = {
  plant: svg`${stems([[32, 44]], false)}${trefoil([32, 44], 'leaf')}`,
  bush: svg`${stems([[24, 42], [40, 40]], false)}${trefoil([24, 42], 'leaf-dark')}${trefoil([40, 40], 'leaf')}
    ${petalFlower([32, 48], 4, 'white', 'sun', 5)}`,
  tree: svg`${stems([[16, 40], [28, 34], [40, 34], [50, 42]], false)}
    ${trefoil([16, 40], 'leaf-dark')}${trefoil([28, 34], 'leaf')}${trefoil([40, 34], 'leaf-light')}${trefoil([50, 42], 'leaf')}
    ${strawberry([24, 46])}${strawberry([42, 47])}`,
  blossom: eachBloom([[33, 48], [14, 50], [50, 52]], strawberry),
};

function blueberryBush(width: number, top: number): ReturnType<typeof svg> {
  return svg`
    <path class="trunk" d="M31 58v-8h2v8z" />
    <ellipse class="leaf-dark" cx="32" cy=${(58 + top) / 2} rx=${width} ry=${(58 - top) / 2 - 2} />
    <ellipse class="leaf" cx="29" cy=${top + 8} rx=${width * 0.6} ry=${(58 - top) / 4} />
  `;
}

const blueberry: SpeciesArt = {
  plant: blueberryBush(7, 42),
  bush: svg`${blueberryBush(13, 32)}${dots([[26, 44], [37, 40], [33, 49]], 'white', 1.3)}`,
  tree: svg`${blueberryBush(20, 20)}${each([[20, 38], [30, 30], [41, 34], [46, 44], [25, 47], [36, 46]], (point) => berry(point, 2.4, 'berry'))}`,
  blossom: eachBloom([[16, 46], [34, 38], [44, 26], [26, 24], [52, 38]], (point) => berry(point, 2.4, 'berry')),
};

function vineLeaf([x, y]: Point, size: number, colour: string): ReturnType<typeof svg> {
  return svg`<path class=${colour} d=${`M${x} ${y}c${-size} ${-size * 0.4} ${-size} ${-size * 1.4} 0 ${-size * 1.6}c${size} ${size * 0.2} ${size} ${size * 1.2} 0 ${size * 1.6}z`} />`;
}

function pumpkin([x, y]: Point, size: number): ReturnType<typeof svg> {
  return svg`
    <ellipse class="pumpkin" cx=${x} cy=${y} rx=${size} ry=${size * 0.75} />
    <ellipse class="pumpkin-line" cx=${x} cy=${y} rx=${size * 0.45} ry=${size * 0.75} />
    <path class="stem" d=${`M${x} ${y - size * 0.75}l1.5-3`} />
  `;
}

const pumpkinArt: SpeciesArt = {
  plant: svg`<path class="stem" d="M32 58c-4-4-10-4-14-2" />${vineLeaf([20, 56], 6, 'leaf')}${vineLeaf([34, 56], 7, 'leaf-light')}`,
  bush: svg`<path class="stem" d="M32 58c-6-6-16-6-24-2M32 58c6-4 14-4 22 0" />
    ${vineLeaf([14, 56], 7, 'leaf')}${vineLeaf([30, 56], 9, 'leaf-dark')}${vineLeaf([48, 57], 7, 'leaf-light')}
    ${petalFlower([40, 46], 4, 'sun', 'pumpkin', 5)}`,
  tree: svg`<path class="stem" d="M32 58c-8-6-20-6-28-1M32 58c8-5 18-5 28-1" />
    ${vineLeaf([10, 57], 8, 'leaf')}${vineLeaf([50, 57], 8, 'leaf-light')}${vineLeaf([22, 50], 7, 'leaf-dark')}
    ${pumpkin([33, 49], 12)}`,
  blossom: svg`${eachBloom([[12, 52]], (point) => pumpkin(point, 6))}${eachBloom([[50, 50]], (point) => pumpkin(point, 7))}`,
};

function roseHead([x, y]: Point, radius: number): ReturnType<typeof svg> {
  return svg`
    <circle class="rose" cx=${x} cy=${y} r=${radius} />
    <path class="rose-line" d=${`M${x - radius * 0.5} ${y}a${radius * 0.5} ${radius * 0.5} 0 1 1 ${radius * 0.5} ${radius * 0.5}`} />
  `;
}

const ROSE_BUSH = svg`
  <path class="trunk dark" d="M31 58v-10h2v10z" />
  <circle class="leaf-dark" cx="22" cy="44" r="9" /><circle class="leaf-dark" cx="42" cy="44" r="9" />
  <circle class="leaf" cx="32" cy="38" r="11" /><circle class="leaf-light" cx="27" cy="33" r="5" />
`;

const rose: SpeciesArt = {
  plant: svg`${stems([[32, 36]])}${bud([32, 35], 2.6, 'rose')}`,
  bush: svg`${ROSE_BUSH}${roseHead([27, 38], 3.5)}${roseHead([39, 42], 3)}`,
  tree: svg`
    <path class="trunk dark" d="M31 58v-14h2v14z" />
    <circle class="leaf-dark" cx="18" cy="40" r="11" /><circle class="leaf-dark" cx="46" cy="40" r="11" />
    <circle class="leaf" cx="32" cy="30" r="15" /><circle class="leaf-light" cx="25" cy="23" r="6" />
    ${each([[22, 34], [36, 24], [44, 40], [30, 42]], (point) => roseHead(point, 4))}
  `,
  blossom: svg`${eachBloom([[14, 44], [28, 22], [48, 30], [38, 46]], (point) => roseHead(point, 3.4))}${eachBloom([[52, 12]], butterfly)}`,
};

function hydrangeaGlobe([x, y]: Point, radius: number, colour: string): ReturnType<typeof svg> {
  return svg`
    <circle class=${colour} cx=${x} cy=${y} r=${radius} />
    ${dots([[x - radius * 0.4, y - radius * 0.3], [x + radius * 0.4, y - radius * 0.2], [x, y + radius * 0.4]], `${colour} light`, radius * 0.35)}
  `;
}

const hydrangea: SpeciesArt = {
  plant: svg`${stems([[30, 40], [36, 42]])}${vineLeaf([28, 44], 5, 'leaf')}${vineLeaf([38, 46], 5, 'leaf-light')}`,
  bush: svg`${ROSE_BUSH}${hydrangeaGlobe([27, 37], 5, 'hydrangea')}${hydrangeaGlobe([40, 42], 4, 'hydrangea')}`,
  tree: svg`
    <circle class="leaf-dark" cx="16" cy="44" r="12" /><circle class="leaf-dark" cx="48" cy="44" r="12" />
    <circle class="leaf" cx="32" cy="36" r="17" />
    ${each([[18, 40], [32, 26], [46, 40], [32, 44]], (point) => hydrangeaGlobe(point, 6.5, 'hydrangea'))}
  `,
  blossom: eachBloom([[22, 30], [42, 30], [12, 48], [52, 48]], (point) => hydrangeaGlobe(point, 5, 'petals')),
};

export const FLOWER_ART = {
  [SpeciesId.Dandelion]: dandelion,
  [SpeciesId.Wheat]: wheat,
  [SpeciesId.Daisy]: daisy,
  [SpeciesId.Tulip]: tulip,
  [SpeciesId.Heather]: heather,
  [SpeciesId.Fern]: fern,
  [SpeciesId.Poppy]: poppy,
  [SpeciesId.Strawberry]: strawberryArt,
  [SpeciesId.Blueberry]: blueberry,
  [SpeciesId.Pumpkin]: pumpkinArt,
  [SpeciesId.Rose]: rose,
  [SpeciesId.Hydrangea]: hydrangea,
} as const satisfies Partial<Record<SpeciesId, SpeciesArt>>;
