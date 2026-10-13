/**
 * A gold krone coin, with the hole of the Norwegian one-krone piece. Sized by
 * the surrounding font unless `--coin-size` is set. `spin()` flips it
 * once; the `spin` attribute flips it as soon as it appears, and a tap
 * flips it with a little hop.
 */
import { LitElement, css, html, type TemplateResult } from 'lit';

const SPIN: Keyframe[] = [
  { transform: 'rotateY(0deg) scale(1)' },
  { transform: 'rotateY(180deg) scale(1.25)', offset: 0.5 },
  { transform: 'rotateY(360deg) scale(1)' },
];

const HOP: Keyframe[] = [
  { transform: 'translateY(0) rotateY(0deg)' },
  { transform: 'translateY(-60%) rotateY(180deg)', offset: 0.4 },
  { transform: 'translateY(0) rotateY(360deg) scale(1.12, 0.88)', offset: 0.78 },
  { transform: 'translateY(-8%) rotateY(360deg) scale(0.97, 1.03)', offset: 0.9 },
  { transform: 'translateY(0) rotateY(360deg) scale(1)' },
];

function reducedMotion(): boolean {
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class CoinIcon extends LitElement {
  static override properties = {
    spinOnLoad: { type: Boolean, attribute: 'spin' },
  };

  static override styles = css`
    :host {
      display: inline-block;
      flex: none;
      touch-action: manipulation;
      width: var(--coin-size, 1.1em);
      height: var(--coin-size, 1.1em);
      vertical-align: -0.2em;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    /* A coin in flight casts no shadow: set --coin-shadow: 0. */
    .shadow {
      fill: var(--scrim);
      opacity: var(--coin-shadow, 0.5);
    }

    .face-top {
      stop-color: var(--coin-light);
    }

    .face-middle {
      stop-color: var(--coin);
    }

    .face-bottom {
      stop-color: var(--coin-dark);
    }

    .edge {
      fill: var(--coin-dark);
    }

    .reeding {
      fill: none;
      stroke: var(--coin);
      stroke-width: 0.5;
      opacity: 0.7;
    }

    .wall {
      fill: var(--coin-dark);
    }

    .ring {
      fill: none;
      stroke: var(--coin-dark);
      stroke-width: 0.7;
      opacity: 0.55;
    }

    .shine {
      fill: none;
      stroke: var(--coin-light);
      stroke-width: 1.2;
      stroke-linecap: round;
      opacity: 0.9;
    }
  `;

  declare spinOnLoad: boolean;

  constructor() {
    super();
    this.spinOnLoad = false;
    this.addEventListener('pointerdown', () => this.hop());
  }

  protected override firstUpdated(): void {
    if (this.spinOnLoad) {
      this.spin();
    }
  }

  spin(): void {
    if (reducedMotion()) {
      return;
    }

    this.animate(SPIN, { duration: 650, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  }

  /** A tap: jumps, flips once and lands with a small bounce. */
  hop(): void {
    if (reducedMotion()) {
      return;
    }

    this.animate(HOP, { duration: 1100, easing: 'ease-in-out' });
  }

  /**
   * Seen from slightly above: an elliptic face over the lower half of its rim,
   * and through the hole the far inner wall.
   */
  protected override render(): TemplateResult {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="face" x1="0" y1="0" x2="0.6" y2="1">
          <stop class="face-top" offset="0" />
          <stop class="face-middle" offset="0.55" />
          <stop class="face-bottom" offset="1" />
        </linearGradient>
      </defs>
      <ellipse class="shadow" cx="12" cy="21" rx="8.5" ry="1.3" />
      <path class="edge" d="M2 10.5a10 7.6 0 0 0 20 0v2.2a10 7.6 0 0 1-20 0z" />
      <path
        class="reeding"
        d="M4.2 15.4v1.7M6.6 16.9v1.9M9.2 17.8v2M12 18.1v2.1M14.8 17.8v2M17.4 16.9v1.9M19.8 15.4v1.7"
      />
      <path
        fill="url(#face)"
        fill-rule="evenodd"
        d="M12 2.9a10 7.6 0 1 1 0 15.2 10 7.6 0 0 1 0-15.2zm0 5.6a2.7 2 0 1 0 0 4 2.7 2 0 0 0 0-4z"
      />
      <path class="wall" d="M9.3 10.5a2.7 2 0 0 1 5.4 0 2.7 1.2 0 0 0-5.4 0z" />
      <ellipse class="ring" cx="12" cy="10.5" rx="7" ry="5.2" />
      <path class="shine" d="M5.4 8.2a7.6 5.4 0 0 1 4.8-3.3" />
    </svg>`;
  }
}

customElements.define('ui-coin', CoinIcon);

declare global {
  interface HTMLElementTagNameMap {
    'ui-coin': CoinIcon;
  }
}
