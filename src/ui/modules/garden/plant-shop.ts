/**
 * The seed shop: plant species bought with XP. A bought species grows in
 * front of the learner, and from then on new seeds may come up as it.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';

import { SEED } from '../../../core/garden.ts';
import { badgeById, type Badge } from '../../../core/badges.ts';
import { SPECIES, canBuy, spendableXp, type Species } from '../../../core/species.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { playSound } from '../audio/sound-effects.ts';
import { announce } from '../shared/announce.ts';
import { formatNumber } from '../shared/format.ts';
import { StoreController, store } from '../shared/store.ts';

import '../../components/coin-icon.ts';
import '../gamification/badge-medal.ts';
import '../gamification/money-amount.ts';
import './plant-sprite.ts';

/** Directions the coins of a purchase fly off in, as x/y offsets in px. */
const BURST: readonly (readonly [number, number])[] = [
  [-46, -60],
  [-24, -84],
  [0, -96],
  [24, -84],
  [46, -60],
  [-34, -30],
  [34, -30],
];

const BLOSSOM = { stage: 'blossom', wilted: false, growth: 1 } as const;

export class PlantShop extends LitElement {
  static override properties = {
    justBought: { state: true },
    newBadges: { state: true },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        gap: var(--sp-5);
      }

      .wallet {
        display: grid;
        gap: var(--sp-1);
        padding: var(--sp-4) var(--sp-5);
        border-radius: var(--r-xl);
        background: var(--gold-bg);
        color: var(--gold);
      }

      .wallet strong {
        font: 700 var(--fs-xl) / 1 var(--font-num);
      }

      .wallet small {
        font-size: var(--fs-sm);
      }

      ul {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr));
        gap: var(--sp-3);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        position: relative;
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        justify-items: center;
        gap: var(--sp-1);
        padding: var(--sp-4) var(--sp-3);
        border: 1.5px solid var(--border);
        border-radius: var(--r-lg);
        background: var(--surface);
        text-align: center;
      }

      li.owned {
        border-color: var(--correct-border);
      }

      h2 {
        font-size: var(--fs-md);
      }

      p {
        font-size: var(--fs-sm);
        color: var(--fg-muted);
      }

      .buy {
        width: 100%;
        min-height: 44px;
        margin-top: var(--sp-2);
        padding: 0 var(--sp-3);
        font-size: var(--fs-sm);
      }

      .buy {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.3em;
      }

      .burst {
        position: absolute;
        bottom: var(--sp-6);
        left: 50%;
        pointer-events: none;
      }

      .burst ui-coin {
        position: absolute;
        --coin-size: 20px;
        --coin-shadow: 0;
        animation: burst 900ms var(--ease-out) both;
      }

      .burst ui-coin:nth-child(even) {
        animation-delay: 60ms;
      }

      @keyframes burst {
        0% {
          opacity: 1;
          transform: translate(-50%, 0) rotate(0deg) scale(0.6);
        }

        70% {
          opacity: 1;
        }

        100% {
          opacity: 0;
          transform: translate(calc(-50% + var(--dx)), var(--dy)) rotate(540deg) scale(1);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .burst {
          display: none;
        }
      }

      .badges {
        display: grid;
        gap: var(--sp-2);
      }

      .badges p {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        padding: var(--sp-2) var(--sp-4);
        border-radius: var(--r-lg);
        background: var(--surface);
        color: var(--fg);
        font-weight: 600;
      }

      .have {
        margin-top: var(--sp-2);
        color: var(--correct);
        font-weight: 700;
      }
    `,
  ];

  protected readonly storeController = new StoreController(this);

  declare justBought: string | null;
  declare newBadges: readonly Badge[];

  constructor() {
    super();
    this.justBought = null;
    this.newBadges = [];
  }

  protected override render(): TemplateResult {
    const { progress, garden } = store.state;
    const available = spendableXp(progress.xp, garden);

    return html`
      <div class="wallet" role="status">
        <strong><money-amount .value=${available} memory="balance"></money-amount></strong>
        <small>å bruke · tjent totalt: ${formatNumber(progress.xp)} kr</small>
      </div>
      ${this.newBadges.length === 0
        ? nothing
        : html`<div class="badges" role="status">
            ${this.newBadges.map(
              (badge) => html`<p>
                <badge-medal .badge=${badge} pop .delay=${500} .size=${40}></badge-medal>Nytt merke: ${badge.title}
              </p>`,
            )}
          </div>`}
      <p>Nye frø spirer som en tilfeldig art av dem du har.</p>
      <ul>
        ${SPECIES.map((species) => this.#renderSpecies(species, available))}
      </ul>
    `;
  }

  #renderSpecies(species: Species, available: number): TemplateResult {
    const { progress, garden } = store.state;
    const owned = garden.unlocked.includes(species.id);
    const bought = this.justBought === species.id;
    const affordable = canBuy(progress.xp, garden, species.id);

    // Re-keyed on purchase, so the new species grows from a seed in front of the learner.
    const sprite = keyed(
      `${species.id}-${owned}`,
      html`<plant-sprite
        .from=${bought ? SEED : null}
        .plant=${BLOSSOM}
        .species=${species.id}
        .size=${72}
      ></plant-sprite>`,
    );

    return html`<li class=${owned ? 'owned' : ''}>
      ${sprite}
      ${bought
        ? html`<span class="burst" aria-hidden="true">
            ${BURST.map(([dx, dy]) => html`<ui-coin style=${`--dx: ${dx}px; --dy: ${dy}px`}></ui-coin>`)}
          </span>`
        : nothing}
      <h2>${species.name}</h2>
      <p>${species.description}</p>
      ${owned
        ? html`<span class="have">✓ I hagen</span>`
        : html`<button
            class=${affordable ? 'button primary buy' : 'button secondary buy'}
            ?disabled=${!affordable}
            @click=${() => this.#buy(species)}
          >
            ${species.price <= available
              ? html`Kjøp · <ui-coin></ui-coin> ${formatNumber(species.price)}`
              : html`<ui-coin></ui-coin> ${formatNumber(species.price)} · mangler ${formatNumber(species.price - available)}`}
          </button>`}
    </li>`;
  }

  #buy(species: Species): void {
    const earned = store.buySpecies(species.id);

    this.newBadges = earned.map((id) => badgeById(id)).filter((badge) => badge !== undefined);

    if (store.state.garden.unlocked.includes(species.id)) {
      this.justBought = species.id;
      announce(this, `${species.name} er nå i hagen din.`);

      if (store.state.settings.soundEffects) {
        playSound('coin');
      }
    }
  }
}

customElements.define('plant-shop', PlantShop);

declare global {
  interface HTMLElementTagNameMap {
    'plant-shop': PlantShop;
  }
}
