/**
 * Building blocks for species drawings, in the 64×64 box of `plant-sprite`
 * with the soil line at y = 58. Class names map to colour tokens in the
 * sprite's styles.
 */
import { svg, type SVGTemplateResult } from 'lit';

export type Point = readonly [number, number];

/** Drawings of one species from the plant stage on; seed and sprout are shared. */
export interface SpeciesArt {
  readonly plant: SVGTemplateResult;
  readonly bush: SVGTemplateResult;
  readonly tree: SVGTemplateResult;
  /** Shown on top of `tree` once the plant blossoms; every `.bloom` pops open in turn. */
  readonly blossom: SVGTemplateResult;
}

export function bloom(content: SVGTemplateResult): SVGTemplateResult {
  return svg`<g class="bloom">${content}</g>`;
}

export function each(points: readonly Point[], draw: (point: Point) => SVGTemplateResult): SVGTemplateResult {
  return svg`${points.map((point) => draw(point))}`;
}

export function eachBloom(points: readonly Point[], draw: (point: Point) => SVGTemplateResult): SVGTemplateResult {
  return svg`${points.map((point) => bloom(draw(point)))}`;
}

/** Curved stems from the soil to each point, with a pair of leaves at the base. */
export function stems(tops: readonly Point[], leaves = true): SVGTemplateResult {
  return svg`
    ${tops.map(([x, y]) => svg`<path class="stem" d=${`M32 58Q${(32 + x) / 2} ${(58 + y) / 2 + 4} ${x} ${y}`} />`)}
    ${leaves
      ? svg`<path class="leaf" d="M32 56c-5-4-11-4-13 0 5 3 9 3 13 0z" />
          <path class="leaf-light" d="M32 56c5-4 11-4 13 0-5 3-9 3-13 0z" />`
      : svg``}
  `;
}

/** A flower of `count` oval petals around a round centre. */
export function petalFlower(
  [x, y]: Point,
  radius: number,
  petals: string,
  core: string,
  count = 8,
): SVGTemplateResult {
  const angles = Array.from({ length: count }, (_unused, index) => (360 / count) * index);

  return svg`
    <g class=${petals}>
      ${angles.map(
        (angle) => svg`<ellipse
          cx=${x}
          cy=${y - radius * 0.6}
          rx=${radius * 0.38}
          ry=${radius * 0.6}
          transform=${`rotate(${angle} ${x} ${y})`}
        />`,
      )}
    </g>
    <circle class=${core} cx=${x} cy=${y} r=${radius * 0.36} />
  `;
}

export function bud([x, y]: Point, radius: number, colour = 'leaf-dark'): SVGTemplateResult {
  return svg`<ellipse class=${colour} cx=${x} cy=${y} rx=${radius * 0.8} ry=${radius} />`;
}

/** A cup-shaped tulip head with three points. */
export function tulipHead([x, y]: Point, size: number, colour: string): SVGTemplateResult {
  return svg`<path
    class=${colour}
    d=${`M${x - size} ${y - size}q0 ${size * 1.7} ${size} ${size * 1.7}q${size} 0 ${size} ${-size * 1.7}l${-size * 0.5} ${size * 0.6}-${size * 0.5}-${size}-${size * 0.5} ${size}z`}
  />`;
}

export function berry([x, y]: Point, radius: number, colour: string): SVGTemplateResult {
  return svg`<circle class=${colour} cx=${x} cy=${y} r=${radius} /><circle class="shine" cx=${x - radius * 0.35} cy=${y - radius * 0.35} r=${radius * 0.3} />`;
}

/** A crown of overlapping circles: dark ones first, light highlights last. */
export function crown(circles: readonly (readonly [number, number, number, string])[]): SVGTemplateResult {
  return svg`${circles.map(([x, y, radius, colour]) => svg`<circle class=${colour} cx=${x} cy=${y} r=${radius} />`)}`;
}

export function trunk(top: number, width: number, colour = 'trunk'): SVGTemplateResult {
  const half = width / 2;

  return svg`<path class=${colour} d=${`M${32 - half - 1} 58 ${32 - half} ${top}h${width}l1 ${58 - top}z`} />`;
}

export function butterfly([x, y]: Point): SVGTemplateResult {
  return svg`
    <ellipse class="petals" cx=${x - 2} cy=${y} rx="2.2" ry="3" transform=${`rotate(-25 ${x - 2} ${y})`} />
    <ellipse class="petals light" cx=${x + 2} cy=${y} rx="2.2" ry="3" transform=${`rotate(25 ${x + 2} ${y})`} />
    <path class="bark-mark" d=${`M${x} ${y - 2.5}v5`} />
  `;
}
