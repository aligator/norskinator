/** Trees, palms and the bonsai: they grow tall, and blossom with fruit, cones or light. */
import { svg } from 'lit';

import { SpeciesId } from '../../../../core/species.ts';
import { LEAFY_PLANT } from './common.ts';
import { berry, crown, each, eachBloom, trunk, type Point, type SpeciesArt } from './shapes.ts';

function needles([x, y]: Point, size: number, colour: string): ReturnType<typeof svg> {
  return svg`<ellipse class=${colour} cx=${x} cy=${y} rx=${size * 1.6} ry=${size * 0.7} />`;
}

function cone([x, y]: Point): ReturnType<typeof svg> {
  return svg`<ellipse class="cone" cx=${x} cy=${y} rx="1.8" ry="3" />`;
}

const pine: SpeciesArt = {
  plant: svg`<path class="stem" d="M32 58V42" />${needles([32, 42], 4, 'leaf-dark')}${needles([32, 48], 3, 'leaf')}`,
  bush: svg`${trunk(34, 2.4, 'pine-bark')}${needles([32, 30], 6, 'leaf-dark')}${needles([32, 38], 8, 'leaf')}${needles([32, 46], 7, 'leaf-dark')}`,
  tree: svg`
    <path class="pine-bark" d="M30.5 58 31 20h2.6l.9 38z" />
    <path class="branch pine" d="M32 30l-9-4M33 26l9-5" />
    ${needles([20, 22], 7, 'leaf-dark')}${needles([43, 18], 7, 'leaf-dark')}
    ${needles([32, 12], 9, 'leaf')}${needles([26, 16], 5, 'leaf-light')}
  `,
  blossom: eachBloom([[20, 27], [44, 23], [30, 17], [37, 14]], cone),
};

function oakCrown(scale: number, top: number): ReturnType<typeof svg> {
  const point = (x: number, y: number, radius: number, colour: string): readonly [number, number, number, string] => [
    32 + (x - 32) * scale,
    top + (y - 14) * scale,
    radius * scale,
    colour,
  ];

  return crown([
    point(16, 26, 10, 'leaf-dark'),
    point(48, 26, 10, 'leaf-dark'),
    point(24, 14, 10, 'oak'),
    point(40, 14, 10, 'oak'),
    point(32, 22, 13, 'oak'),
    point(26, 12, 5, 'leaf'),
  ]);
}

function acorn([x, y]: Point): ReturnType<typeof svg> {
  return svg`<ellipse class="cone" cx=${x} cy=${y + 1.5} rx="1.8" ry="2.4" /><path class="trunk dark" d=${`M${x - 2.2} ${y}a2.2 1.6 0 0 1 4.4 0z`} />`;
}

const oak: SpeciesArt = {
  plant: LEAFY_PLANT,
  bush: svg`${trunk(44, 3)}${oakCrown(0.55, 34)}`,
  tree: svg`
    <path class="trunk" d="M28 58l1.5-22h5l1.5 22z" />
    <path class="branch" d="M31 40l-8-6M33 38l8-7" />
    ${oakCrown(1, 14)}
  `,
  blossom: eachBloom([[18, 30], [30, 34], [42, 28], [46, 36], [24, 20]], acorn),
};

function leaflets([x, y]: Point, colour: string): ReturnType<typeof svg> {
  return svg`${[-2, -1, 0, 1, 2].map(
    (step) => svg`<ellipse class=${colour} cx=${x + step * 3} cy=${y + Math.abs(step) * 1.2} rx="1.6" ry="3" transform=${`rotate(${step * 18} ${x + step * 3} ${y + Math.abs(step) * 1.2})`} />`,
  )}`;
}

const CLUSTER: readonly Point[] = [
  [0, 0],
  [2.6, 1],
  [-2.6, 1],
  [1.3, 3.2],
  [-1.3, 3.2],
  [0, 5.4],
];

function berryCluster([x, y]: Point): ReturnType<typeof svg> {
  return svg`${CLUSTER.map(([dx, dy]) => berry([x + dx, y + dy], 1.4, 'flower-red'))}`;
}

const rowan: SpeciesArt = {
  plant: svg`<path class="stem" d="M32 58V38" />${leaflets([32, 40], 'leaf')}${leaflets([32, 48], 'leaf-light')}`,
  bush: svg`${trunk(36, 2.4, 'bark-grey')}${leaflets([26, 34], 'leaf')}${leaflets([38, 32], 'leaf-dark')}${leaflets([32, 26], 'leaf-light')}${leaflets([30, 42], 'leaf')}`,
  tree: svg`
    ${trunk(26, 3, 'bark-grey')}
    <path class="branch grey" d="M32 36l-10-8M32 32l10-9" />
    ${crown([
      [20, 26, 10, 'leaf-dark'],
      [44, 24, 10, 'leaf-dark'],
      [32, 16, 12, 'leaf'],
    ])}
    ${each([[18, 24], [30, 12], [42, 20], [26, 26], [38, 28]], (point) => leaflets(point, 'leaf-light'))}
  `,
  blossom: eachBloom([[18, 28], [30, 20], [42, 26], [36, 10]], berryCluster),
};

const maple: SpeciesArt = {
  plant: svg`<path class="stem" d="M32 58V40" />
    <path class="maple" d="M32 46l-6-3 2-2-4-3 4-1v-3l4 3 1-4 1 4 4-3v3l4 1-4 3 2 2z" />`,
  bush: svg`${trunk(42, 3)}${crown([
    [22, 42, 9, 'maple-dark'],
    [42, 42, 9, 'maple-dark'],
    [32, 34, 12, 'maple'],
    [27, 30, 5, 'maple-light'],
  ])}`,
  tree: svg`
    <path class="trunk" d="M29 58l1.5-24h3l1.5 24z" />
    <path class="branch" d="M32 40l-9-7M32 38l9-8" />
    ${crown([
      [17, 28, 11, 'maple-dark'],
      [47, 28, 11, 'maple-dark'],
      [32, 20, 15, 'maple'],
      [24, 14, 7, 'maple-light'],
      [40, 14, 6, 'maple-light'],
    ])}
  `,
  blossom: eachBloom(
    [[12, 50], [52, 46], [22, 54], [44, 54]],
    ([x, y]) => svg`<path class="maple-light" d=${`M${x} ${y}l-3-1.5 1-1-2-1.5 2-.5v-1.5l2 1.5.5-2 1 2 2-1.5v1.5l2 .5-2 1.5 1 1z`} />`,
  ),
};

function culm(x: number, top: number): ReturnType<typeof svg> {
  const nodes = Array.from({ length: Math.floor((58 - top) / 8) }, (_unused, index) => 58 - (index + 1) * 8);

  return svg`
    <rect class="bamboo" x=${x - 1.6} y=${top} width="3.2" height=${58 - top} rx="1.2" />
    ${nodes.map((y) => svg`<path class="bamboo-node" d=${`M${x - 1.6} ${y}h3.2`} />`)}
  `;
}

function bambooLeaf([x, y]: Point, flip: boolean): ReturnType<typeof svg> {
  const direction = flip ? -1 : 1;

  return svg`<path class="leaf" d=${`M${x} ${y}q${6 * direction} -3 ${10 * direction} 1q${-6 * direction} 2 ${-10 * direction} -1z`} />`;
}

const bamboo: SpeciesArt = {
  plant: svg`${culm(32, 42)}${bambooLeaf([33, 44], false)}${bambooLeaf([31, 48], true)}`,
  bush: svg`${culm(28, 30)}${culm(36, 36)}${bambooLeaf([29, 32], true)}${bambooLeaf([37, 38], false)}${bambooLeaf([29, 42], false)}`,
  tree: svg`${culm(22, 12)}${culm(31, 6)}${culm(40, 16)}
    ${bambooLeaf([23, 14], true)}${bambooLeaf([32, 8], false)}${bambooLeaf([41, 18], false)}
    ${bambooLeaf([23, 30], false)}${bambooLeaf([40, 34], true)}${bambooLeaf([31, 24], true)}`,
  blossom: svg`${culm(14, 30)}${culm(50, 26)}${eachBloom([[15, 32], [51, 28], [32, 18]], ([x, y]) => bambooLeaf([x, y], x > 32))}`,
};

function palmFronds([x, y]: Point, length: number): ReturnType<typeof svg> {
  return svg`${[-150, -115, -65, -30, -90].map((angle) => {
    const radians = (angle * Math.PI) / 180;
    const endX = x + Math.cos(radians) * length;
    const endY = y + Math.sin(radians) * length * 0.6 + length * 0.35;

    return svg`<path class="frond" d=${`M${x} ${y}Q${(x + endX) / 2} ${y - length * 0.3} ${endX} ${endY}`} />`;
  })}`;
}

const palm: SpeciesArt = {
  plant: palmFronds([32, 52], 9),
  bush: svg`<path class="palm-trunk" d="M30.5 58l.8-14h2.4l.8 14z" />${palmFronds([32, 44], 13)}`,
  tree: svg`<path class="palm-trunk" d="M29 58c1-14 3-26 6-38h3c-3 12-4 24-4 38z" />${palmFronds([36, 20], 18)}`,
  blossom: eachBloom([[33, 23], [38, 24], [35, 26]], ([x, y]) => svg`<circle class="coconut" cx=${x} cy=${y} r="2.6" />`),
};

const POT = svg`<path class="pot" d="M18 50h28l-3 8H21z" /><rect class="pot" x="16" y="48" width="32" height="3" rx="1" />`;

function pad([x, y]: Point, width: number): ReturnType<typeof svg> {
  return svg`<ellipse class="leaf-dark" cx=${x} cy=${y} rx=${width} ry=${width * 0.42} /><ellipse class="leaf" cx=${x - 1} cy=${y - 1.4} rx=${width * 0.7} ry=${width * 0.28} />`;
}

const bonsai: SpeciesArt = {
  plant: svg`${POT}<path class="stem" d="M32 48v-8" />${pad([32, 40], 4)}`,
  bush: svg`${POT}<path class="bonsai-trunk" d="M30 48c0-6 6-8 2-14" />${pad([32, 33], 8)}`,
  tree: svg`${POT}
    <path class="bonsai-trunk" d="M29 48c-1-8 9-9 4-17-2-3 2-6 6-7M31 36c-4-1-8 0-11-3" />
    ${pad([20, 31], 8)}${pad([40, 22], 10)}${pad([30, 14], 7)}`,
  blossom: eachBloom(
    [[16, 29], [24, 30], [36, 20], [44, 21], [28, 12], [33, 13]],
    ([x, y]) => svg`<circle class="petals light" cx=${x} cy=${y} r="1.8" />`,
  ),
};

const STARS: readonly Point[] = [
  [12, 10],
  [52, 8],
  [20, 4],
  [44, 2],
  [32, 32],
  [8, 26],
  [56, 24],
];

function star([x, y]: Point): ReturnType<typeof svg> {
  return svg`<path class="aurora-star" d=${`M${x} ${y - 2.6}l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z`} />`;
}

const aurora: SpeciesArt = {
  plant: svg`<path class="stem aurora-stem" d="M32 58V40" />${crown([[32, 38, 5, 'aurora'], [30, 36, 2, 'aurora-2']])}`,
  bush: svg`${trunk(40, 2.6, 'aurora-trunk')}${crown([
    [24, 38, 8, 'aurora-2'],
    [40, 38, 8, 'aurora-2'],
    [32, 30, 10, 'aurora'],
    [28, 26, 4, 'aurora-light'],
  ])}`,
  tree: svg`
    <path class="aurora-trunk" d="M29.5 58l1-24h3l1 24z" />
    <g class="aurora-glow">
      ${crown([
        [18, 30, 10, 'aurora-2'],
        [46, 30, 10, 'aurora-2'],
        [32, 20, 15, 'aurora'],
        [24, 14, 6, 'aurora-light'],
        [40, 12, 5, 'aurora-light'],
      ])}
    </g>
  `,
  blossom: eachBloom(STARS, star),
};

export const TREE_ART = {
  [SpeciesId.Pine]: pine,
  [SpeciesId.Oak]: oak,
  [SpeciesId.Rowan]: rowan,
  [SpeciesId.Maple]: maple,
  [SpeciesId.Bamboo]: bamboo,
  [SpeciesId.Palm]: palm,
  [SpeciesId.Bonsai]: bonsai,
  [SpeciesId.Aurora]: aurora,
} as const satisfies Partial<Record<SpeciesId, SpeciesArt>>;
