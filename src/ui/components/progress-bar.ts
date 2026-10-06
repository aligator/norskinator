/** Horizontal progress bar with an accessible value text. */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

export class ProgressBar extends LitElement {
  static override properties = {
    value: { type: Number },
    max: { type: Number },
    label: { type: String },
    valueText: { type: String, attribute: 'value-text' },
    thin: { type: Boolean, reflect: true },
  };

  static override styles = css`
    :host {
      display: block;
      min-width: 0;
    }

    .track {
      height: 8px;
      border-radius: var(--r-pill);
      background: var(--surface-2);
      overflow: hidden;
    }

    :host([thin]) .track {
      height: 6px;
    }

    .fill {
      height: 100%;
      border-radius: inherit;
      background: var(--accent);
      transition: width var(--dur-ring) var(--ease-in-out);
    }
  `;

  declare value: number;
  declare max: number;
  declare label: string;
  declare valueText: string;
  declare thin: boolean;

  constructor() {
    super();
    this.value = 0;
    this.max = 1;
    this.label = '';
    this.valueText = '';
    this.thin = false;
  }

  protected override render(): TemplateResult {
    const ratio = this.max <= 0 ? 0 : Math.min(1, Math.max(0, this.value / this.max));

    return html`
      <div
        class="track"
        role="progressbar"
        aria-label=${this.label === '' ? nothing : this.label}
        aria-valuemin="0"
        aria-valuemax=${this.max}
        aria-valuenow=${this.value}
        aria-valuetext=${this.valueText === '' ? `${this.value} / ${this.max}` : this.valueText}
      >
        <div class="fill" style=${`width: ${(ratio * 100).toFixed(1)}%`}></div>
      </div>
    `;
  }
}

customElements.define('ui-progress-bar', ProgressBar);

declare global {
  interface HTMLElementTagNameMap {
    'ui-progress-bar': ProgressBar;
  }
}
