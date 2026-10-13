/**
 * One garden per deck, laid out to fit the screen: deck picker, stage counts,
 * the bed (which pages sideways instead of the page scrolling) and the button
 * to water it.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';

import { gardenBeds, type GardenBed } from '../../../core/garden.ts';
import { sessionOptions, sessionPreview, type SessionPreview } from '../../../core/session.ts';
import type { Deck, PlayableItem } from '../../../core/types.ts';
import { DECKS } from '../../../decks/registry.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { formatNumber } from '../shared/format.ts';
import { PRACTICE_NOTE, startSession } from '../shared/session-start.ts';
import { StoreController, store } from '../shared/store.ts';
import { gardenMemory } from './garden-memory.ts';

import './garden-bed.ts';
import './garden-strip.ts';

function plural(count: number, one: string, many: string): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

function seedText({ seedRoom, unseen }: SessionPreview): string {
  if (unseen === 0) {
    return 'Alle frøene er sådd.';
  }

  if (seedRoom === 0) {
    return 'Nye frø kommer når spirene har vokst.';
  }

  return `Plass til ${plural(seedRoom, 'nytt frø', 'nye frø')}.`;
}

export class GardenView extends LitElement {
  static override properties = {
    deckId: { state: true },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
        min-height: 0;
      }

      .picker {
        display: flex;
        flex: none;
        gap: var(--sp-2);
        margin: 0 calc(-1 * var(--gutter));
        padding: 2px var(--gutter);
        overflow-x: auto;
        scrollbar-width: none;
      }

      .deck {
        display: inline-flex;
        flex: none;
        align-items: center;
        gap: var(--sp-2);
        min-height: 40px;
        padding: 0 var(--sp-3);
        border: 1.5px solid var(--border);
        border-radius: var(--r-pill);
        background: var(--surface);
        color: var(--fg);
        font: 600 var(--fs-sm) var(--font-ui);
        cursor: pointer;
      }

      .deck[aria-pressed='true'] {
        border-color: var(--accent);
        background: var(--accent-soft);
      }

      .drops {
        color: var(--water);
        font: 700 var(--fs-xs) var(--font-num);
      }

      garden-strip {
        flex: none;
      }

      garden-bed {
        flex: 1;
      }

      .meta {
        flex: none;
        font-size: var(--fs-sm);
        text-align: center;
        color: var(--fg-muted);
      }

      .wilted {
        color: var(--gold);
        font-weight: 600;
      }

      .action {
        flex: none;
        display: grid;
        gap: var(--sp-1);
      }

      .action .button {
        min-height: 52px;
      }

      .action small {
        font-size: var(--fs-xs);
        text-align: center;
        color: var(--fg-muted);
      }

      @media (min-width: 900px) {
        .action {
          justify-self: center;
          width: min(100%, 22rem);
          margin: 0 auto;
        }
      }
    `,
  ];

  protected readonly storeController = new StoreController(this);

  declare deckId: string | null;

  constructor() {
    super();
    this.deckId = gardenMemory.deckId;
  }

  protected override render(): TemplateResult | typeof nothing {
    const state = store.state;

    if (state.status !== 'ready') {
      return nothing;
    }

    const now = Date.now();
    const beds = gardenBeds(state.items, state.cards, now, state.garden.species);
    const decks = beds.flatMap((bed) => DECKS.filter((deck) => deck.id === bed.deckId));
    const deck = decks.find((candidate) => candidate.id === this.deckId) ?? decks[0];
    const bed = beds.find((candidate) => candidate.deckId === deck?.id);

    if (deck === undefined || bed === undefined) {
      return nothing;
    }

    const items = state.items.filter((item) => item.deckId === deck.id);
    const preview = sessionPreview(items, state.cards, sessionOptions(state.settings), now);

    return html`
      ${decks.length > 1
        ? html`<div class="picker" role="group" aria-label="Velg hage">
            ${decks.map((candidate) => this.#renderDeckButton(candidate, candidate === deck, beds))}
          </div>`
        : nothing}
      <garden-strip .counts=${bed.counts}></garden-strip>
      ${keyed(deck.id, html`<garden-bed .bed=${bed}></garden-bed>`)}
      ${bed.wilted > 0
        ? html`<p class="meta"><span class="wilted">🥀 ${plural(bed.wilted, 'vissen plante', 'visne planter')}</span></p>`
        : nothing}
      ${this.#renderAction(deck, bed, preview)}
    `;
  }

  #renderDeckButton(deck: Deck, selected: boolean, beds: readonly GardenBed<PlayableItem>[]): TemplateResult {
    const thirsty = beds.find((bed) => bed.deckId === deck.id)?.thirsty ?? 0;

    return html`<button class="deck" aria-pressed=${selected ? 'true' : 'false'} @click=${() => this.#choose(deck.id)}>
      <span aria-hidden="true">${deck.icon}</span>${deck.shortTitle}
      ${thirsty > 0
        ? html`<span class="drops" aria-label=${`${formatNumber(thirsty)} tørste`}>💧${formatNumber(thirsty)}</span>`
        : nothing}
    </button>`;
  }

  #renderAction(deck: Deck, bed: GardenBed<PlayableItem>, preview: SessionPreview): TemplateResult {
    const canPractise = preview.due > 0 || preview.fresh > 0;
    const label = preview.due > 0 ? `Vann hagen · 💧 ${formatNumber(bed.thirsty)}` : 'Så nye frø';

    return html`<div class="action">
      ${canPractise
        ? html`<button class="button primary block" @click=${() => startSession(this, [deck.id])}>${label}</button>
            <small>${seedText(preview)}</small>`
        : html`<p class="meta">🌤️ Hagen har det fint. ${seedText(preview)}</p>
            <button class="button secondary block" @click=${() => startSession(this, [deck.id])}>Øv fritt</button>
            <small>${PRACTICE_NOTE}</small>`}
    </div>`;
  }

  #choose(deckId: string): void {
    this.deckId = deckId;
    gardenMemory.deckId = deckId;
  }
}

customElements.define('garden-view', GardenView);

declare global {
  interface HTMLElementTagNameMap {
    'garden-view': GardenView;
  }
}
