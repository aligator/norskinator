/**
 * Shown once, the first time the learner can afford a species: how money is
 * earned and what the seed shop does. Emits `shop-tour-closed` with
 * `{ openShop: boolean }`.
 */
import { LitElement, css, html, type TemplateResult } from 'lit';

import { BASE_XP_CORRECT, XP_GOAL_BONUS } from '../../../core/gamification.ts';
import { PlantStage, SEED } from '../../../core/garden.ts';
import type { Species } from '../../../core/species.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { formatMoney } from '../shared/format.ts';

import '../gamification/money-amount.ts';

import './plant-sprite.ts';

const STEP_COUNT = 3;

const BLOSSOM = { stage: PlantStage.Blossom, wilted: false, growth: 1 } as const;

export interface ShopTourClosedDetail {
  readonly openShop: boolean;
}

export class ShopTour extends LitElement {
  static override properties = {
    species: { attribute: false },
    money: { attribute: false },
    step: { state: true },
  };

  static override styles = [
    sharedStyles,
    css`
      dialog {
        width: min(calc(100% - 2 * var(--sp-4)), 26rem);
        padding: 0;
        border: 0;
        border-radius: var(--r-xl);
        background: var(--surface);
        color: var(--fg);
        box-shadow: var(--shadow-2);
      }

      dialog::backdrop {
        background: var(--scrim);
      }

      .frame {
        display: grid;
        gap: var(--sp-5);
        padding: var(--sp-6) var(--sp-5) var(--sp-5);
      }

      .body {
        display: grid;
        justify-items: center;
        gap: var(--sp-3);
        min-height: 15rem;
        align-content: center;
        text-align: center;
      }

      h2 {
        font-size: var(--fs-xl);
        line-height: var(--lh-tight);
      }

      p,
      li {
        line-height: var(--lh-body);
      }

      ul {
        display: grid;
        gap: var(--sp-2);
        justify-self: stretch;
        margin: 0;
        padding: 0;
        list-style: none;
        text-align: left;
      }

      li {
        display: flex;
        gap: var(--sp-3);
        padding: var(--sp-2) var(--sp-3);
        border-radius: var(--r-md);
        background: var(--surface-2);
      }

      .money {
        color: var(--gold);
        font-weight: 700;
      }

      .dots {
        display: flex;
        justify-content: center;
        gap: var(--sp-2);
      }

      .dots span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--border-strong);
      }

      .dots span.active {
        width: 24px;
        border-radius: var(--r-pill);
        background: var(--accent);
      }

      .actions {
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: var(--sp-3);
      }
    `,
  ];

  declare species: Species;
  /** Money available to spend. */
  declare money: number;
  declare step: number;

  constructor() {
    super();
    this.money = 0;
    this.step = 0;
  }

  protected override firstUpdated(): void {
    this.renderRoot.querySelector('dialog')?.showModal();
  }

  protected override updated(): void {
    this.renderRoot.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }

  protected override render(): TemplateResult {
    return html`
      <dialog aria-labelledby="shop-tour-title" @cancel=${this.#onCancel}>
        <div class="frame">
          <div class="body">${this.#renderStep()}</div>
          <div class="dots" role="img" aria-label=${`Steg ${this.step + 1} av ${STEP_COUNT}`}>
            ${Array.from({ length: STEP_COUNT }, (_unused, index) => html`<span class=${index === this.step ? 'active' : ''}></span>`)}
          </div>
          ${this.#renderActions()}
        </div>
      </dialog>
    `;
  }

  #renderStep(): TemplateResult {
    switch (this.step) {
      case 0: {
        return html`
          <plant-sprite .from=${SEED} .plant=${BLOSSOM} .species=${this.species.id} .size=${120} .delay=${300}></plant-sprite>
          <h2 id="shop-tour-title" tabindex="-1">Du har nok penger!</h2>
          <p>
            Du har <span class="money"><money-amount .value=${this.money} .from=${0}></money-amount></span> – nok
            til å kjøpe <strong>${this.species.name}</strong> (${formatMoney(this.species.price)}) i frøbutikken.
          </p>
        `;
      }

      case 1: {
        return html`
          <h2 id="shop-tour-title" tabindex="-1">Slik tjener du penger</h2>
          <ul>
            <li><span aria-hidden="true">✅</span><span>Hvert riktige svar gir <span class="money">${formatMoney(BASE_XP_CORRECT)}</span>.</span></li>
            <li><span aria-hidden="true">🔥</span><span>Mange riktige på rad gir litt ekstra.</span></li>
            <li><span aria-hidden="true">🎯</span><span>Dagsmålet gir <span class="money">${formatMoney(XP_GOAL_BONUS)}</span> i bonus.</span></li>
          </ul>
        `;
      }

      default: {
        return html`
          <h2 id="shop-tour-title" tabindex="-1">Slik fungerer frøbutikken</h2>
          <ul>
            <li><span aria-hidden="true">🌱</span><span>Trykk på <strong>Frøbutikk</strong> øverst i hagen og kjøp nye plantearter.</span></li>
            <li><span aria-hidden="true">🎲</span><span>Hvert nye ord spirer som en tilfeldig art av dem du har.</span></li>
            <li><span aria-hidden="true">🌳</span><span>Planter du allerede har, beholder arten sin.</span></li>
          </ul>
        `;
      }
    }
  }

  #renderActions(): TemplateResult {
    const last = this.step === STEP_COUNT - 1;

    return html`<div class="actions">
      ${this.step === 0
        ? html`<button class="button secondary" @click=${() => this.#close(false)}>Senere</button>`
        : html`<button class="button secondary" @click=${this.#back}>Tilbake</button>`}
      ${last
        ? html`<button class="button primary" @click=${() => this.#close(true)}>Til frøbutikken</button>`
        : html`<button class="button primary" @click=${this.#next}>Neste</button>`}
    </div>`;
  }

  #next = (): void => {
    this.step = Math.min(this.step + 1, STEP_COUNT - 1);
  };

  #back = (): void => {
    this.step = Math.max(this.step - 1, 0);
  };

  #onCancel = (event: Event): void => {
    event.preventDefault();
    this.#close(false);
  };

  #close(openShop: boolean): void {
    this.renderRoot.querySelector('dialog')?.close();

    const detail: ShopTourClosedDetail = { openShop };

    this.dispatchEvent(new CustomEvent('shop-tour-closed', { detail, bubbles: true, composed: true }));
  }
}

customElements.define('shop-tour', ShopTour);

declare global {
  interface HTMLElementTagNameMap {
    'shop-tour': ShopTour;
  }
}
