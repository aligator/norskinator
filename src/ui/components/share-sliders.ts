/**
 * One slider per share of a whole, e.g. how a session splits between task
 * types. The component only reports which slider moved; the owner decides how
 * the other shares follow and passes the new values back in.
 */
import { LitElement, css, html, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';

import { sharedStyles } from './styles/shared.ts';

export interface Share {
  readonly id: string;
  readonly label: string;
  /** Percent, 0–100. */
  readonly value: number;
}

export interface ShareMove {
  readonly id: string;
  readonly value: number;
}

const STEP = 5;

export class ShareSliders extends LitElement {
  static override properties = {
    label: { type: String },
    shares: { attribute: false },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      fieldset {
        display: grid;
        gap: var(--sp-4);
        margin: 0;
        padding: 0;
        border: 0;
      }

      legend {
        margin-bottom: var(--sp-3);
        padding: 0;
      }

      .row {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: var(--sp-1) var(--sp-3);
      }

      .value {
        min-width: 4ch;
        font: 600 var(--fs-md) var(--font-num);
        text-align: right;
      }

      input {
        grid-column: 1 / -1;
        width: 100%;
        min-height: 32px;
        margin: 0;
        accent-color: var(--accent);
        cursor: pointer;
      }

      input:focus-visible {
        outline: 3px solid var(--focus);
        outline-offset: 2px;
      }
    `,
  ];

  declare label: string;
  declare shares: readonly Share[];

  constructor() {
    super();
    this.label = '';
    this.shares = [];
  }

  protected override render(): TemplateResult {
    return html`
      <fieldset>
        <legend class="eyebrow">${this.label}</legend>
        ${this.shares.map(
          (share) => html`
            <label class="row">
              <span>${share.label}</span>
              <span class="value" aria-hidden="true">${share.value} %</span>
              <input
                type="range"
                min="0"
                max="100"
                step=${STEP}
                aria-valuetext=${`${share.value} prosent`}
                .value=${live(String(share.value))}
                @input=${(event: Event) => this.#emit('share-input', share.id, event)}
                @change=${(event: Event) => this.#emit('share-change', share.id, event)}
              />
            </label>
          `,
        )}
      </fieldset>
    `;
  }

  /** `share-input` fires while dragging, `share-change` once the slider is released. */
  #emit(type: 'share-input' | 'share-change', id: string, event: Event): void {
    if (!(event.currentTarget instanceof HTMLInputElement)) {
      return;
    }

    const value = Number(event.currentTarget.value);

    this.dispatchEvent(new CustomEvent<ShareMove>(type, { detail: { id, value }, bubbles: true, composed: true }));
  }
}

customElements.define('ui-share-sliders', ShareSliders);

declare global {
  interface HTMLElementTagNameMap {
    'ui-share-sliders': ShareSliders;
  }
}
