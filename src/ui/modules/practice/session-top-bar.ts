/** Practice top bar: quit button, session progress and combo. */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { closeIcon, flameIcon } from '../../components/icons.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import '../../components/progress-bar.ts';

/** Hidden for short runs so beginners aren't nagged by it. */
export const COMBO_VISIBLE_FROM = 3;

/** From here the pill switches to the solid "hot" look. */
const COMBO_HOT_FROM = 5;

export class SessionTopBar extends LitElement {
  static override properties = {
    answered: { type: Number },
    total: { type: Number },
    combo: { type: Number },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        grid-template-columns: var(--hit) 1fr auto 3.5rem;
        align-items: center;
        gap: var(--sp-3);
        height: var(--topbar-h);
        padding: 0 var(--sp-2);
      }

      .count {
        font: 500 var(--fs-sm) var(--font-num);
        color: var(--fg-muted);
      }

      .combo-slot {
        display: flex;
        justify-content: flex-end;
      }

      .combo {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        height: 28px;
        padding: 0 var(--sp-2);
        border-radius: var(--r-pill);
        background: var(--flame-bg);
        color: var(--flame);
        font: 700 var(--fs-sm) var(--font-num);
        animation: bump var(--dur-base) var(--ease-spring);
      }

      .combo.hot {
        background: var(--flame);
        color: var(--surface);
      }

      @keyframes bump {
        50% {
          transform: scale(1.15);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .combo {
          animation: none;
        }
      }
    `,
  ];

  declare answered: number;
  declare total: number;
  declare combo: number;

  constructor() {
    super();
    this.answered = 0;
    this.total = 0;
    this.combo = 0;
  }

  protected override render(): TemplateResult {
    return html`
      <button class="icon-button" aria-label="Avslutt økta" @click=${this.#quit}>${closeIcon()}</button>
      <ui-progress-bar
        thin
        .value=${this.answered}
        .max=${this.total}
        label="Fremdrift i økta"
        value-text=${`${this.answered} av ${this.total}`}
      ></ui-progress-bar>
      <span class="count" aria-hidden="true">${this.answered}/${this.total}</span>
      <span class="combo-slot">
        ${this.combo >= COMBO_VISIBLE_FROM
          ? html`<span class=${this.combo >= COMBO_HOT_FROM ? 'combo hot' : 'combo'} role="img" aria-label=${`Kombo ${this.combo}`}>
              ${flameIcon(16)}<span aria-hidden="true">×${this.combo}</span>
            </span>`
          : nothing}
      </span>
    `;
  }

  #quit = (): void => {
    this.dispatchEvent(new CustomEvent('quit', { bubbles: true, composed: true }));
  };
}

customElements.define('session-top-bar', SessionTopBar);

declare global {
  interface HTMLElementTagNameMap {
    'session-top-bar': SessionTopBar;
  }
}
