/** Single-choice control rendered as segments; built from real radio inputs. */
import { LitElement, css, html, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';

import { sharedStyles } from './styles/shared.ts';

export interface SegmentOption {
  readonly value: string;
  readonly label: string;
}

export class SegmentedControl extends LitElement {
  static override properties = {
    label: { type: String },
    options: { attribute: false },
    value: { type: String },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      fieldset {
        margin: 0;
        padding: 0;
        border: 0;
      }

      legend {
        margin-bottom: var(--sp-3);
        padding: 0;
      }

      .segments {
        display: grid;
        grid-auto-columns: 1fr;
        grid-auto-flow: column;
        gap: 2px;
        padding: 2px;
        border-radius: var(--r-md);
        background: var(--surface-2);
      }

      label {
        position: relative;
        display: grid;
        place-items: center;
        min-height: 44px;
        border-radius: calc(var(--r-md) - 2px);
        font: 600 var(--fs-md) var(--font-ui);
        color: var(--fg-muted);
        cursor: pointer;
      }

      input {
        position: absolute;
        inset: 0;
        margin: 0;
        opacity: 0;
        cursor: pointer;
      }

      label:has(input:checked) {
        background: var(--surface);
        color: var(--fg);
        box-shadow: var(--shadow-1);
      }

      label:has(input:focus-visible) {
        outline: 3px solid var(--focus);
        outline-offset: 2px;
      }
    `,
  ];

  declare label: string;
  declare options: readonly SegmentOption[];
  declare value: string;

  constructor() {
    super();
    this.label = '';
    this.options = [];
    this.value = '';
  }

  protected override render(): TemplateResult {
    return html`
      <fieldset>
        <legend class="eyebrow">${this.label}</legend>
        <div class="segments">
          ${this.options.map(
            (option) => html`
              <label>
                <input
                  type="radio"
                  name="segment"
                  .checked=${live(option.value === this.value)}
                  @change=${() => this.#select(option.value)}
                />
                ${option.label}
              </label>
            `,
          )}
        </div>
      </fieldset>
    `;
  }

  #select(value: string): void {
    this.value = value;
    this.dispatchEvent(new CustomEvent<string>('change', { detail: value, bubbles: true, composed: true }));
  }
}

customElements.define('ui-segmented', SegmentedControl);

declare global {
  interface HTMLElementTagNameMap {
    'ui-segmented': SegmentedControl;
  }
}
