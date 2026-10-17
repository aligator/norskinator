/**
 * One animated plant. Every stage is drawn up front; a stage change lets the
 * old one shrink away while the new one springs up from the soil, so growth
 * reads as growth. Set `from` to replay the change from an earlier plant.
 */
import { LitElement, css, html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';

import { PlantStage, SEED, stageRank, type Plant } from '../../../core/garden.ts';
import { DEFAULT_SPECIES, type SpeciesId } from '../../../core/species.ts';
import { blossomArt, stageArt } from './species-art.ts';

/** How long sparkles or falling leaves stay after a change. */
const EFFECT_MS = 1400;

/** `water` plays on every right answer, `grow` when that also reached a new stage. */
/** `poke` plays when the plant is tapped. */
type Effect = 'water' | 'grow' | 'wilt' | 'poke' | null;

const SPARKLES: readonly (readonly [number, number])[] = [
  [14, 22],
  [50, 18],
  [22, 6],
  [44, 4],
  [32, 12],
];

const FALLING_LEAVES: readonly (readonly [number, number])[] = [
  [24, 34],
  [40, 30],
  [31, 26],
];

const RAIN: readonly (readonly [number, number])[] = [
  [25, -4],
  [33, -10],
  [40, -2],
];

/** A plant fills out within its stage: from this share of its full size to all of it. */
const MIN_GROWTH_SCALE = 0.8;

function sparkle([x, y]: readonly [number, number]): SVGTemplateResult {
  return svg`<g transform=${`translate(${x} ${y})`}>
    <path class="sparkle" d="M0-3.2.9-.9 3.2 0 .9.9 0 3.2-.9.9-3.2 0-.9-.9z" />
  </g>`;
}

function fallingLeaf([x, y]: readonly [number, number]): SVGTemplateResult {
  return svg`<g transform=${`translate(${x} ${y})`}>
    <path class="falling" d="M0 0c-2-2.5-1.5-5 1-6 1.5 2.5 1 5-1 6z" />
  </g>`;
}

function raindrop([x, y]: readonly [number, number]): SVGTemplateResult {
  return svg`<g transform=${`translate(${x} ${y})`}>
    <path class="rain" d="M0 0c1.6 2.2 2.4 3.4 2.4 4.4a2.4 2.4 0 0 1-4.8 0c0-1 .8-2.2 2.4-4.4z" />
  </g>`;
}

function growthScale(plant: Plant): number {
  if (plant.stage === PlantStage.Seed) {
    return 1;
  }

  return MIN_GROWTH_SCALE + (1 - MIN_GROWTH_SCALE) * plant.growth;
}

export class PlantSprite extends LitElement {
  static override properties = {
    plant: { attribute: false },
    from: { attribute: false },
    size: { type: Number },
    thirsty: { type: Boolean },
    species: { attribute: false },
    delay: { type: Number },
    shown: { state: true },
    effect: { state: true },
  };

  static override styles = css`
    :host {
      display: inline-block;
      line-height: 0;
    }

    svg {
      overflow: visible;
      --leaf: var(--plant-leaf);
      --leaf-dark: var(--plant-leaf-dark);
      --leaf-light: var(--plant-leaf-light);
    }

    svg.wilted {
      --leaf: var(--plant-wilted);
      --leaf-dark: var(--plant-wilted-dark);
      --leaf-light: var(--plant-wilted);
    }

    .soil {
      fill: var(--plant-soil);
    }

    .seed {
      fill: var(--plant-seed);
    }

    .seed-line {
      fill: none;
      stroke: var(--plant-soil);
      stroke-width: 1;
      stroke-linecap: round;
    }

    .stem {
      fill: none;
      stroke: var(--leaf-dark);
      stroke-width: 2.2;
      stroke-linecap: round;
      transition: stroke 600ms ease;
    }

    .leaf,
    .leaf-dark,
    .leaf-light {
      transition: fill 600ms ease;
    }

    .leaf {
      fill: var(--leaf);
    }

    .leaf-dark {
      fill: var(--leaf-dark);
    }

    .leaf-light {
      fill: var(--leaf-light);
    }

    .trunk {
      fill: var(--plant-trunk);
    }

    .branch {
      fill: none;
      stroke: var(--plant-trunk);
      stroke-width: 2;
      stroke-linecap: round;
    }

    .stage,
    .sway,
    .growth,
    .bounce {
      transform-box: view-box;
      transform-origin: 32px 58px;
    }

    .growth {
      transition: transform 1100ms var(--ease-spring);
    }

    .effect-poke .bounce {
      animation: wiggle 650ms var(--ease-out);
    }

    .effect-water .bounce,
    .effect-grow .bounce {
      animation: bounce 700ms var(--ease-out) 450ms;
    }

    .rain {
      fill: var(--water);
      animation: rain 650ms var(--ease-in) both;
    }

    g:nth-child(2) > .rain {
      animation-delay: 120ms;
    }

    g:nth-child(3) > .rain {
      animation-delay: 240ms;
    }

    .stage {
      opacity: 0;
      transform: scale(0.2);
      transition:
        transform 900ms var(--ease-spring),
        opacity 300ms ease;
    }

    .stage.on {
      opacity: 1;
      transform: scale(1);
    }

    .wilted .stage.on {
      transform: rotate(-10deg) scale(0.94, 0.8);
    }

    /* A parent can set --sway-state: paused, e.g. for a bed of hundreds of plants. */
    .sway {
      animation: sway 5s ease-in-out infinite;
      animation-delay: var(--sway-delay, 0s);
      animation-play-state: var(--sway-state, running);
    }

    .wilted .sway {
      animation: none;
    }

    .bloom {
      transform-box: fill-box;
      transform-origin: center;
      transform: scale(0);
      transition: transform 500ms var(--ease-spring);
    }

    .blooms.open .bloom {
      transform: scale(1);
    }

    .blooms.open .bloom:nth-child(2) {
      transition-delay: 90ms;
    }

    .blooms.open .bloom:nth-child(3) {
      transition-delay: 180ms;
    }

    .blooms.open .bloom:nth-child(4) {
      transition-delay: 270ms;
    }

    .blooms.open .bloom:nth-child(5) {
      transition-delay: 360ms;
    }

    .blooms.open .bloom:nth-child(6) {
      transition-delay: 450ms;
    }

    .petals {
      fill: var(--plant-blossom);
    }

    .petals.light {
      fill: var(--plant-blossom-light);
    }

    .trunk.dark {
      fill: var(--plant-trunk-dark);
    }

    .branch.dark {
      stroke: var(--plant-trunk-dark);
    }

    .sun {
      fill: var(--plant-sun);
    }

    .sun-core {
      fill: var(--plant-sun-core);
    }

    .cone {
      fill: var(--plant-cone);
    }

    .cactus {
      fill: var(--plant-cactus);
    }

    .cactus-rib {
      fill: none;
      stroke: var(--plant-cactus-rib);
      stroke-width: 1;
      stroke-linecap: round;
    }

    .flower-red {
      fill: var(--plant-flower-red);
    }

    .bark {
      fill: var(--plant-bark);
    }

    .bark-mark {
      fill: none;
      stroke: var(--plant-bark-mark);
      stroke-width: 1.2;
      stroke-linecap: round;
    }

    .catkin {
      fill: none;
      stroke: var(--plant-sun);
      stroke-width: 1.6;
      stroke-linecap: round;
    }

    .lavender {
      fill: var(--plant-lavender);
    }

    .lavender.light {
      fill: var(--plant-lavender-light);
    }

    .shine {
      fill: var(--plant-white);
      opacity: 0.55;
    }

    .white {
      fill: var(--plant-white);
    }

    .puff {
      fill: var(--plant-white);
      opacity: 0.35;
    }

    .puff-line {
      fill: none;
      stroke: var(--plant-white);
      stroke-width: 0.8;
    }

    .wheat {
      fill: var(--plant-wheat);
    }

    .heather {
      fill: var(--plant-heather);
    }

    .heather.light {
      fill: var(--plant-heather-light);
    }

    .fiddle,
    .frond {
      fill: none;
      stroke: var(--leaf);
      stroke-linecap: round;
    }

    .fiddle {
      stroke-width: 1.8;
    }

    .frond {
      stroke-width: 3.2;
    }

    .poppy {
      fill: var(--plant-poppy);
    }

    .berry {
      fill: var(--plant-berry);
    }

    .pumpkin {
      fill: var(--plant-pumpkin);
    }

    .pumpkin-line {
      fill: none;
      stroke: var(--plant-pumpkin-line);
      stroke-width: 1;
    }

    .rose {
      fill: var(--plant-rose);
    }

    .rose-line {
      fill: none;
      stroke: var(--plant-rose-line);
      stroke-width: 1;
      stroke-linecap: round;
    }

    .hydrangea {
      fill: var(--plant-hydrangea);
    }

    .hydrangea.light {
      fill: var(--plant-hydrangea-light);
    }

    .pine-bark {
      fill: var(--plant-pine-bark);
    }

    .branch.pine {
      stroke: var(--plant-pine-bark);
    }

    .oak {
      fill: var(--plant-oak);
    }

    .bark-grey {
      fill: var(--plant-bark-grey);
    }

    .branch.grey {
      stroke: var(--plant-bark-grey);
    }

    .maple {
      fill: var(--plant-maple);
    }

    .maple-dark {
      fill: var(--plant-maple-dark);
    }

    .maple-light {
      fill: var(--plant-maple-light);
    }

    .bamboo {
      fill: var(--plant-bamboo);
    }

    .bamboo-node {
      fill: none;
      stroke: var(--plant-bamboo-node);
      stroke-width: 1;
    }

    .palm-trunk {
      fill: var(--plant-palm-trunk);
    }

    .coconut {
      fill: var(--plant-coconut);
    }

    .pot {
      fill: var(--plant-pot);
    }

    .bonsai-trunk {
      fill: none;
      stroke: var(--plant-trunk-dark);
      stroke-width: 3;
      stroke-linecap: round;
    }

    .aurora {
      fill: var(--plant-aurora);
    }

    .aurora-2 {
      fill: var(--plant-aurora-2);
    }

    .aurora-light {
      fill: var(--plant-aurora-light);
    }

    .aurora-trunk {
      fill: var(--plant-aurora-2);
    }

    .aurora-stem {
      stroke: var(--plant-aurora);
    }

    .aurora-star {
      fill: var(--plant-aurora-light);
      transform-box: fill-box;
      transform-origin: center;
      animation: twinkle 2.2s ease-in-out infinite;
    }

    /* The legendary tree shimmers like the northern lights. */
    .aurora-glow {
      animation: aurora 6s ease-in-out infinite;
    }

    @keyframes twinkle {
      0%,
      100% {
        opacity: 1;
        transform: scale(1);
      }

      50% {
        opacity: 0.4;
        transform: scale(0.7);
      }
    }

    @keyframes aurora {
      0%,
      100% {
        filter: hue-rotate(0deg);
      }

      50% {
        filter: hue-rotate(50deg);
      }
    }

    .lavender-stem {
      fill: none;
      stroke: var(--plant-lavender-leaf);
      stroke-width: 1.6;
      stroke-linecap: round;
    }

    .bloom-core {
      fill: var(--plant-blossom-core);
    }

    .sparkle {
      fill: var(--plant-blossom-core);
      transform-box: fill-box;
      transform-origin: center;
      animation: sparkle 900ms var(--ease-out) both;
    }

    g:nth-child(2) > .sparkle {
      animation-delay: 120ms;
    }

    g:nth-child(3) > .sparkle {
      animation-delay: 240ms;
    }

    g:nth-child(4) > .sparkle {
      animation-delay: 360ms;
    }

    g:nth-child(5) > .sparkle {
      animation-delay: 480ms;
    }

    .falling {
      fill: var(--plant-wilted);
      animation: fall 1200ms var(--ease-in) both;
    }

    g:nth-child(2) > .falling {
      animation-delay: 150ms;
    }

    g:nth-child(3) > .falling {
      animation-delay: 300ms;
    }

    .drop {
      fill: var(--water);
      animation: bob 2.4s ease-in-out infinite;
      animation-play-state: var(--sway-state, running);
    }

    @keyframes sway {
      0%,
      100% {
        transform: rotate(-1.5deg);
      }

      50% {
        transform: rotate(1.5deg);
      }
    }

    @keyframes wiggle {
      0%,
      100% {
        transform: rotate(0deg) scale(1);
      }

      15% {
        transform: rotate(-9deg) scale(1.06, 0.94);
      }

      35% {
        transform: rotate(7deg) scale(0.97, 1.05);
      }

      55% {
        transform: rotate(-4deg);
      }

      75% {
        transform: rotate(2deg);
      }
    }

    @keyframes bounce {
      0%,
      100% {
        transform: scale(1);
      }

      30% {
        transform: scale(1.08, 0.9);
      }

      60% {
        transform: scale(0.96, 1.06);
      }
    }

    @keyframes rain {
      0% {
        opacity: 0;
        transform: translateY(0);
      }

      20% {
        opacity: 1;
      }

      100% {
        opacity: 0;
        transform: translateY(40px);
      }
    }

    @keyframes sparkle {
      0% {
        opacity: 0;
        transform: translateY(4px) scale(0);
      }

      40% {
        opacity: 1;
        transform: translateY(0) scale(1.2);
      }

      100% {
        opacity: 0;
        transform: translateY(-6px) scale(0.4);
      }
    }

    @keyframes fall {
      0% {
        opacity: 0;
        transform: translate(0, 0) rotate(0deg);
      }

      15% {
        opacity: 1;
      }

      100% {
        opacity: 0;
        transform: translate(6px, 22px) rotate(120deg);
      }
    }

    @keyframes bob {
      0%,
      100% {
        transform: translateY(0);
      }

      50% {
        transform: translateY(-2px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .stage,
      .bloom,
      .stem,
      .leaf,
      .leaf-dark,
      .leaf-light {
        transition: none;
      }

      .sway,
      .drop,
      .aurora-star,
      .aurora-glow {
        animation: none;
      }

      .growth {
        transition: none;
      }

      .bounce {
        animation: none !important;
      }

      .sparkle,
      .falling,
      .rain {
        display: none;
      }
    }
  `;

  declare plant: Plant;
  /** Earlier plant to animate from on first render, e.g. before an answer. */
  declare from: Plant | null;
  declare size: number;
  /** Due for review: shows a water drop. */
  declare thirsty: boolean;
  declare species: SpeciesId;
  /** Milliseconds to wait before playing the change from `from`, to stagger a row of plants. */
  declare delay: number;
  declare shown: Plant;
  declare effect: Effect;

  #frame = 0;
  #effectTimer: ReturnType<typeof setTimeout> | undefined;
  #delayTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.plant = SEED;
    this.from = null;
    this.size = 48;
    this.thirsty = false;
    this.species = DEFAULT_SPECIES;
    this.delay = 0;
    this.shown = SEED;
    this.effect = null;
    this.addEventListener('pointerdown', () => this.poke());
  }

  /** A tap: the plant wiggles and sparkles; a wilted one only shakes. */
  poke(): void {
    this.#play('poke');
  }

  override disconnectedCallback(): void {
    cancelAnimationFrame(this.#frame);
    clearTimeout(this.#effectTimer);
    clearTimeout(this.#delayTimer);
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!this.hasUpdated) {
      this.shown = this.from ?? this.plant;

      return;
    }

    if (changed.has('plant')) {
      this.#show(this.plant);
    }
  }

  protected override firstUpdated(): void {
    if (this.from === null) {
      return;
    }

    // The first frame paints the earlier plant, the second starts the transition from it.
    this.#delayTimer = setTimeout(() => {
      this.#frame = requestAnimationFrame(() => {
        this.#frame = requestAnimationFrame(() => this.#show(this.plant));
      });
    }, this.delay);
  }

  #show(next: Plant): void {
    const previous = this.shown;

    if (next.wilted && !previous.wilted) {
      this.#play('wilt');
    } else if (!next.wilted && stageRank(next.stage) > stageRank(previous.stage)) {
      this.#play('grow');
    } else if (!next.wilted && (previous.wilted || next.growth > previous.growth)) {
      this.#play('water');
    }

    this.shown = next;
  }

  #play(effect: Effect): void {
    clearTimeout(this.#effectTimer);

    // Setting the same class again would not restart its animation, so drop it for a frame.
    if (effect !== null && this.effect === effect) {
      this.effect = null;
      void this.updateComplete.then(() => {
        this.#frame = requestAnimationFrame(() => this.#play(effect));
      });

      return;
    }

    this.effect = effect;
    this.#effectTimer = setTimeout(() => {
      this.effect = null;
    }, EFFECT_MS);
  }

  #part(...stages: readonly PlantStage[]): string {
    return stages.includes(this.shown.stage) ? 'stage on' : 'stage';
  }

  protected override render(): TemplateResult {
    const stage = this.shown.stage;

    return html`
      <svg
        class=${`${this.shown.wilted ? 'wilted' : ''} ${this.effect === null ? '' : `effect-${this.effect}`}`}
        viewBox="0 0 64 64"
        width=${this.size}
        height=${this.size}
        aria-hidden="true"
        focusable="false"
      >
        <ellipse class="soil" cx="32" cy="58.5" rx="17" ry="3.8" />
        <g class="growth" style=${`transform: scale(${growthScale(this.shown)})`}>
          <g class="bounce">
            <g class="sway">
              <g class=${this.#part(PlantStage.Seed)}>
                <ellipse class="seed" cx="32" cy="55.2" rx="4.6" ry="3.2" />
                <path class="seed-line" d="M30.4 54.6q1.6-1.6 3.2 0" />
              </g>
              <g class=${this.#part(PlantStage.Sprout)}>
                <path class="stem" d="M32 58V46" />
                <path class="leaf" d="M32 47c-2-5-8-6-11-4 2 4 7 6 11 4z" />
                <path class="leaf-light" d="M32 47c2-5 8-6 11-4-2 4-7 6-11 4z" />
              </g>
              <g class=${this.#part(PlantStage.Plant)}>
                ${stageArt(this.species, PlantStage.Plant)}
              </g>
              <g class=${this.#part(PlantStage.Bush)}>
                ${stageArt(this.species, PlantStage.Bush)}
              </g>
              <g class=${this.#part(PlantStage.Tree, PlantStage.Blossom)}>
                ${stageArt(this.species, PlantStage.Tree)}
                <g class=${stage === PlantStage.Blossom ? 'blooms open' : 'blooms'}>${blossomArt(this.species)}</g>
              </g>
            </g>
          </g>
        </g>
        ${this.effect === 'water' || this.effect === 'grow' ? svg`<g>${RAIN.map(raindrop)}</g>` : nothing}
        ${this.effect === 'grow' || (this.effect === 'poke' && !this.shown.wilted)
          ? svg`<g>${SPARKLES.map(sparkle)}</g>`
          : nothing}
        ${this.effect === 'wilt' ? svg`<g>${FALLING_LEAVES.map(fallingLeaf)}</g>` : nothing}
        ${this.thirsty
          ? svg`<path class="drop" d="M54 2c3 4 4.5 6.3 4.5 8.2a4.5 4.5 0 0 1-9 0c0-1.9 1.5-4.2 4.5-8.2z" />`
          : nothing}
      </svg>
    `;
  }
}

customElements.define('plant-sprite', PlantSprite);

declare global {
  interface HTMLElementTagNameMap {
    'plant-sprite': PlantSprite;
  }
}
