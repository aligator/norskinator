/** Number input with − / + buttons. */
import { LitElement, css, html, type TemplateResult } from 'lit';

export class Stepper extends LitElement {
  static override properties = {
    label: { type: String },
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
  };

  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-4);
    }

    .controls {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
    }

    button {
      width: var(--hit);
      height: var(--hit);
      border: 1.5px solid var(--option-border);
      border-radius: var(--r-md);
      background: var(--surface);
      color: var(--fg);
      font: 700 var(--fs-lg) var(--font-ui);
      cursor: pointer;
    }

    button[aria-disabled='true'] {
      opacity: 0.4;
      cursor: default;
    }

    button:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }

    output {
      min-width: 2.5ch;
      text-align: center;
      font: 500 var(--fs-lg) var(--font-num);
    }
  `;

  declare label: string;
  declare value: number;
  declare min: number;
  declare max: number;
  declare step: number;

  constructor() {
    super();
    this.label = '';
    this.value = 0;
    this.min = 0;
    this.max = 10;
    this.step = 1;
  }

  protected override render(): TemplateResult {
    return html`
      <span id="label">${this.label}</span>
      <div class="controls" role="group" aria-labelledby="label">
        <button
          aria-label="Færre"
          aria-disabled=${this.value <= this.min ? 'true' : 'false'}
          @click=${() => this.#change(-this.step)}
        >
          −
        </button>
        <output aria-live="polite">${this.value}</output>
        <button
          aria-label="Flere"
          aria-disabled=${this.value >= this.max ? 'true' : 'false'}
          @click=${() => this.#change(this.step)}
        >
          +
        </button>
      </div>
    `;
  }

  /** `aria-disabled` instead of `disabled`: a disabled button drops keyboard focus to <body>. */
  #change(delta: number): void {
    const next = Math.min(this.max, Math.max(this.min, this.value + delta));

    if (next === this.value) {
      return;
    }

    this.value = next;
    this.dispatchEvent(new CustomEvent<number>('change', { detail: next, bubbles: true, composed: true }));
  }
}

customElements.define('ui-stepper', Stepper);

declare global {
  interface HTMLElementTagNameMap {
    'ui-stepper': Stepper;
  }
}
