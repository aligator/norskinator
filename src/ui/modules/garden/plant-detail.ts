/**
 * One plant on its own page: how far it grew and how far it has to go, its
 * sentence with translation and explanation, and its review history.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { solutionText } from '../../../core/checker.ts';
import {
  FULL_GROWN_DAYS,
  PLANT_STAGE_LABELS,
  STAGE_START_DAYS,
  nextStage,
  plantOf,
  type Plant,
} from '../../../core/garden.ts';
import { speciesById, speciesOf } from '../../../core/species.ts';
import { isDue, type CardState } from '../../../core/srs.ts';
import { DECKS } from '../../../decks/registry.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { pickTranslation } from '../practice/translation.ts';
import { formatComesBack, formatDate, formatNumber, pluralDays, pluralTimes } from '../shared/format.ts';
import { GARDEN_HREF } from '../shared/links.ts';
import { StoreController, store } from '../shared/store.ts';
import { plantLabel } from './garden-bed.ts';

import '../../components/progress-bar.ts';
import './plant-sprite.ts';

function growthText(plant: Plant, card: CardState): string {
  const next = nextStage(plant.stage);
  const days = Math.floor(card.stability);

  if (next === null) {
    return days >= FULL_GROWN_DAYS
      ? 'Fullt utvokst'
      : `Fyller kronen · ${formatNumber(days)} av ${pluralDays(FULL_GROWN_DAYS)}`;
  }

  const target = next === 'seed' ? 0 : STAGE_START_DAYS[next];

  return `Vokser mot ${PLANT_STAGE_LABELS[next].toLocaleLowerCase('nb-NO')} · ${formatNumber(days)} av ${pluralDays(target)}`;
}

export class PlantDetail extends LitElement {
  static override properties = {
    itemId: { attribute: false },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        gap: var(--sp-5);
      }

      .back {
        display: inline-flex;
        align-items: center;
        min-height: var(--hit);
        font-weight: 600;
        text-decoration: none;
      }

      .hero {
        display: grid;
        justify-items: center;
        gap: var(--sp-2);
        text-align: center;
      }

      h1 {
        font-size: var(--fs-xl);
      }

      .growth {
        display: grid;
        gap: var(--sp-2);
        width: min(100%, 20rem);
        font-size: var(--fs-sm);
        color: var(--fg-muted);
      }

      .wilted-hint {
        color: var(--gold);
        font-weight: 600;
      }

      .card {
        display: grid;
        gap: var(--sp-2);
        padding: var(--sp-5);
        border-radius: var(--r-xl);
        background: var(--surface);
        box-shadow: var(--shadow-1);
      }

      .sentence {
        font: var(--fs-lg) / var(--lh-prompt) var(--font-prompt);
      }

      .translation,
      .explanation {
        color: var(--fg-muted);
      }

      .lang {
        margin-right: var(--sp-2);
        font-size: var(--fs-xs);
        font-weight: 700;
      }

      dl {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--sp-3);
        margin: 0;
      }

      dl div {
        padding: var(--sp-3) var(--sp-4);
        border-radius: var(--r-lg);
        background: var(--surface);
      }

      dd {
        margin: 0;
        font-weight: 700;
      }

      .thirsty {
        color: var(--water);
      }

      .missing {
        color: var(--fg-muted);
      }
    `,
  ];

  protected readonly storeController = new StoreController(this);

  declare itemId: string | null;

  constructor() {
    super();
    this.itemId = null;
  }

  protected override render(): TemplateResult | typeof nothing {
    const state = store.state;

    if (state.status !== 'ready') {
      return nothing;
    }

    const item = state.items.find((candidate) => candidate.id === this.itemId);
    const card = item === undefined ? undefined : state.cards[item.id];
    const back = html`<a class="back" href=${GARDEN_HREF}>‹ Hagen</a>`;

    if (item === undefined || card === undefined) {
      return html`${back}<p class="missing">Denne planten finnes ikke i hagen din.</p>`;
    }

    const now = Date.now();
    const plant = plantOf(card);
    const deck = DECKS.find((candidate) => candidate.id === item.deckId);
    const translation = pickTranslation(item, state.settings.translationLanguage);
    const thirsty = isDue(card, now);
    const species = speciesOf(state.garden, item.id);

    return html`
      ${back}
      <section class="hero">
        <plant-sprite .plant=${plant} .species=${species} .size=${150} .thirsty=${thirsty}></plant-sprite>
        <p class="eyebrow">${speciesById(species).name}${deck === undefined ? '' : ` · ${deck.icon} ${deck.shortTitle}`}</p>
        <h1>${plantLabel(plant)}</h1>
        ${this.#renderGrowth(plant, card)}
      </section>

      <section class="card">
        <p class="sentence" lang="nb">${solutionText(item)}</p>
        ${translation === null
          ? nothing
          : html`<p class="translation" lang=${translation.lang}><span class="lang">${translation.lang.toUpperCase()}</span>${translation.text}</p>`}
        ${item.explanation === undefined ? nothing : html`<p class="explanation" lang="nb">${item.explanation}</p>`}
      </section>

      <dl>
        <div>
          <dt class="eyebrow">Neste gang</dt>
          <dd class=${thirsty ? 'thirsty' : ''}>${thirsty ? '💧 Nå' : formatComesBack(card.due, now)}</dd>
          ${thirsty ? nothing : html`<dd>${formatDate(card.due)}</dd>`}
        </div>
        <div>
          <dt class="eyebrow">Husker i</dt>
          <dd>${pluralDays(Math.max(1, Math.round(card.stability)))}</dd>
        </div>
        <div>
          <dt class="eyebrow">Øvd</dt>
          <dd>${pluralTimes(card.reps)}</dd>
        </div>
        <div>
          <dt class="eyebrow">Feil</dt>
          <dd>${pluralTimes(card.failures)}</dd>
        </div>
      </dl>
    `;
  }

  #renderGrowth(plant: Plant, card: CardState): TemplateResult {
    if (plant.wilted) {
      return html`<p class="wilted-hint">Svar riktig neste gang, så spirer den igjen.</p>`;
    }

    const text = growthText(plant, card);

    return html`<div class="growth">
      <ui-progress-bar .value=${plant.growth} .max=${1} label="Vekst" value-text=${text}></ui-progress-bar>
      <span>${text}</span>
    </div>`;
  }
}

customElements.define('plant-detail', PlantDetail);

declare global {
  interface HTMLElementTagNameMap {
    'plant-detail': PlantDetail;
  }
}
