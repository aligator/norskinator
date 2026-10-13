/**
 * A badge as a medal: its emoji on a ring in the colour of its category.
 * `pop` lets it spring in with a burst of sparkles (for a badge just earned),
 * a tap spins it, and earned medals catch the light now and then.
 */
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';

import type { Badge } from '../../../core/badges.ts';

const SPIN: Keyframe[] = [
  { transform: 'rotateY(0deg) scale(1)' },
  { transform: 'rotateY(180deg) scale(1.15)', offset: 0.5 },
  { transform: 'rotateY(360deg) scale(1)' },
];

const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

function reducedMotion(): boolean {
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class BadgeMedal extends LitElement {
  static override properties = {
    badge: { attribute: false },
    earned: { type: Boolean },
    pop: { type: Boolean },
    delay: { type: Number },
    size: { type: Number },
  };

  static override styles = css`
    :host {
      position: relative;
      display: inline-grid;
      place-items: center;
      width: var(--medal-size);
      height: var(--medal-size);
      touch-action: manipulation;
    }

    .wrap {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .medal {
      position: relative;
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      overflow: hidden;
      border-radius: 50%;
      background: var(--ring);
      box-shadow: var(--shadow-1);
    }

    .practice {
      --ring: linear-gradient(145deg, var(--accent-soft), var(--accent));
    }

    .garden {
      --ring: linear-gradient(145deg, var(--plant-leaf-light), var(--plant-leaf-dark));
    }

    .money {
      --ring: linear-gradient(145deg, var(--coin-light), var(--coin-dark));
    }

    .face {
      display: grid;
      place-items: center;
      width: 78%;
      height: 78%;
      border-radius: 50%;
      background: var(--surface);
      font-size: calc(var(--medal-size) * 0.46);
      line-height: 1;
    }

    .locked .medal {
      background: var(--surface-2);
      box-shadow: none;
    }

    .locked .face {
      filter: grayscale(1);
      opacity: 0.35;
    }

    /* A band of light sweeps across earned medals every few seconds. */
    .medal::after {
      content: '';
      position: absolute;
      inset: -20%;
      background: linear-gradient(115deg, transparent 40%, var(--shine) 50%, transparent 60%);
      transform: translateX(-120%);
      animation: shine 5s ease-in-out infinite;
      animation-delay: var(--shine-delay, 0s);
      pointer-events: none;
    }

    .locked .medal::after {
      display: none;
    }

    .pop .medal {
      animation: pop 700ms var(--ease-spring) both;
      animation-delay: var(--pop-delay, 0ms);
    }

    .spark {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 6px;
      height: 6px;
      margin: -3px;
      border-radius: 50%;
      background: var(--coin-light);
      animation: spark 800ms var(--ease-out) both;
      animation-delay: calc(var(--pop-delay, 0ms) + 250ms);
      pointer-events: none;
    }

    @keyframes shine {
      0%,
      70% {
        transform: translateX(-120%);
      }

      100% {
        transform: translateX(120%);
      }
    }

    @keyframes pop {
      0% {
        transform: scale(0) rotate(-30deg);
      }

      60% {
        transform: scale(1.2) rotate(8deg);
      }

      100% {
        transform: scale(1) rotate(0deg);
      }
    }

    @keyframes spark {
      0% {
        opacity: 1;
        transform: rotate(var(--angle)) translateY(0) scale(1);
      }

      100% {
        opacity: 0;
        transform: rotate(var(--angle)) translateY(calc(var(--medal-size) * -0.9)) scale(0.3);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .medal::after,
      .pop .medal,
      .spark {
        animation: none;
      }

      .spark {
        display: none;
      }
    }
  `;

  declare badge: Badge;
  declare earned: boolean;
  /** Springs in with sparkles, for a badge just earned. */
  declare pop: boolean;
  /** Milliseconds before popping, to stagger a row of medals. */
  declare delay: number;
  declare size: number;

  constructor() {
    super();
    this.earned = true;
    this.pop = false;
    this.delay = 0;
    this.size = 56;
    this.addEventListener('pointerdown', () => this.spin());
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('size')) {
      this.style.setProperty('--medal-size', `${this.size}px`);
    }
  }

  spin(): void {
    if (reducedMotion() || !this.earned) {
      return;
    }

    this.renderRoot.querySelector('.medal')?.animate(SPIN, { duration: 800, easing: 'ease-in-out' });
  }

  protected override render(): TemplateResult {
    const classes = [this.badge.category, this.earned ? '' : 'locked', this.pop && this.earned ? 'pop' : ''].join(' ');
    // Spread the shine so a grid of medals does not flash all at once.
    const shineDelay = (this.badge.id.length * 0.37) % 5;

    return html`
      <div class=${`wrap ${classes}`} style=${`--pop-delay: ${this.delay}ms; --shine-delay: ${shineDelay}s`}>
        <div class="medal"><span class="face" aria-hidden="true">${this.badge.icon}</span></div>
        ${this.pop && this.earned
          ? SPARKS.map((angle) => html`<span class="spark" style=${`--angle: ${angle}deg`}></span>`)
          : nothing}
      </div>
    `;
  }
}

customElements.define('badge-medal', BadgeMedal);

declare global {
  interface HTMLElementTagNameMap {
    'badge-medal': BadgeMedal;
  }
}
