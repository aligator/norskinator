/** List of topics: start a deck-only session or switch a deck on and off. */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { deckCounts, type DeckCounts } from '../../../core/stats.ts';
import type { Deck } from '../../../core/types.ts';
import { DECKS } from '../../../decks/registry.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { formatNumber } from '../shared/format.ts';
import { startSession } from '../shared/session-start.ts';
import { StoreController, store } from '../shared/store.ts';

import '../../components/toggle-switch.ts';

export class DeckList extends LitElement {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      ul {
        margin: var(--sp-2) 0 0;
        padding: 0;
        list-style: none;
      }

      li {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: var(--sp-2);
        border-bottom: 1px solid var(--border);
      }

      .deck {
        display: grid;
        grid-template-columns: 40px 1fr auto;
        align-items: center;
        gap: var(--sp-3);
        min-height: 64px;
        padding: var(--sp-2) 0;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .deck:disabled {
        cursor: default;
        opacity: 0.6;
      }

      .icon {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--surface-2);
        font-size: 24px;
      }

      .text {
        display: grid;
        min-width: 0;
      }

      .title {
        font-weight: 600;
      }

      .description {
        overflow: hidden;
        font-size: var(--fs-sm);
        color: var(--fg-muted);
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .due {
        padding: 2px var(--sp-2);
        border-radius: var(--r-pill);
        background: var(--accent-soft);
        color: var(--accent);
        font: 500 var(--fs-sm) var(--font-num);
      }

      .skeleton {
        height: 64px;
        border-radius: var(--r-md);
        background: var(--surface-2);
      }
    `,
  ];

  protected readonly storeController = new StoreController(this);

  protected override render(): TemplateResult {
    const counts = deckCounts(store.state.items, store.state.cards, Date.now());
    const disabled = store.state.settings.disabledDeckIds;

    return html`
      <h2 class="eyebrow" id="decks-title">Temaer</h2>
      <ul aria-labelledby="decks-title">
        ${DECKS.map((deck) => this.#renderDeck(deck, counts.get(deck.id), disabled.includes(deck.id)))}
      </ul>
    `;
  }

  #renderDeck(deck: Deck, counts: DeckCounts | undefined, disabled: boolean): TemplateResult {
    // Only the very first load shows skeletons; a reload after a toggle keeps the rows (and focus).
    if (store.state.items.length === 0 && store.state.status !== 'ready' && !disabled) {
      return html`<li><div class="skeleton" aria-hidden="true"></div></li>`;
    }

    const nothingToDo = counts === undefined || (counts.due === 0 && counts.unseen === 0);

    return html`
      <li>
        <button
          class="deck"
          ?disabled=${disabled || nothingToDo}
          @click=${() => startSession(this, [deck.id])}
        >
          <span class="icon" aria-hidden="true">${deck.icon}</span>
          <span class="text">
            <span class="title">${deck.title}</span>
            <span class="description">${deck.description}</span>
          </span>
          ${counts !== undefined && counts.due > 0
            ? html`<span class="due">${formatNumber(counts.due)}<span class="sr-only"> til repetisjon</span></span>`
            : nothing}
        </button>
        <ui-switch
          .checked=${!disabled}
          label=${`${deck.title} aktivt`}
          @change=${() => this.#toggle(deck.id)}
        ></ui-switch>
      </li>
    `;
  }

  #toggle(deckId: string): void {
    const disabled = store.state.settings.disabledDeckIds;
    const next = disabled.includes(deckId) ? disabled.filter((id) => id !== deckId) : [...disabled, deckId];

    store.updateSettings({ disabledDeckIds: next });
  }
}

customElements.define('deck-list', DeckList);

declare global {
  interface HTMLElementTagNameMap {
    'deck-list': DeckList;
  }
}
