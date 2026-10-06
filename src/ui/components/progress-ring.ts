/** Circular progress indicator with free content in the middle. */
import { LitElement, css, html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';

const RADIUS = 56;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type ProgressTone = 'accent' | 'success';

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export class ProgressRing extends LitElement {
  static override properties = {
    value: { type: Number },
    from: { type: Number },
    tone: { type: String },
    label: { type: String },
    drawn: { state: true },
  };

  static override styles = css`
    :host {
      display: inline-grid;
      place-items: center;
      position: relative;
      width: 132px;
      height: 132px;
    }

    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .track {
      stroke: var(--surface-2);
    }

    .progress {
      stroke: var(--accent);
      transition:
        stroke-dashoffset var(--dur-ring) var(--ease-in-out),
        stroke var(--dur-base) var(--ease-out);
    }

    .progress.success {
      stroke: var(--correct);
    }

    .content {
      position: relative;
      text-align: center;
      line-height: var(--lh-tight);
    }
  `;

  /** 0..1, clamped. */
  declare value: number;
  /** Ratio drawn first so the change animates; defaults to `value` (no animation). */
  declare from: number | undefined;
  declare tone: ProgressTone;
  declare label: string;
  declare drawn: number;

  constructor() {
    super();
    this.value = 0;
    this.from = undefined;
    this.tone = 'accent';
    this.label = '';
    this.drawn = 0;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.drawn = clampRatio(this.from ?? this.value);
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has('value')) {
      return;
    }

    // Two frames: the first paints the start value, the second sets the target,
    // otherwise both land in one style pass and no transition runs.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.drawn = clampRatio(this.value);
      });
    });
  }

  protected override render(): TemplateResult {
    const offset = CIRCUMFERENCE * (1 - this.drawn);

    return html`
      <div role=${this.label === '' ? nothing : 'img'} aria-label=${this.label === '' ? nothing : this.label}>
        ${svg`<svg viewBox="0 0 132 132" aria-hidden="true">
          <circle class="track" cx="66" cy="66" r=${RADIUS} fill="none" stroke-width="12" />
          <circle
            class=${`progress ${this.tone}`}
            cx="66"
            cy="66"
            r=${RADIUS}
            fill="none"
            stroke-width="12"
            stroke-linecap="round"
            stroke-dasharray=${CIRCUMFERENCE}
            stroke-dashoffset=${offset}
          />
        </svg>`}
        <div class="content" aria-hidden="true"><slot></slot></div>
      </div>
    `;
  }
}

customElements.define('ui-progress-ring', ProgressRing);

declare global {
  interface HTMLElementTagNameMap {
    'ui-progress-ring': ProgressRing;
  }
}
