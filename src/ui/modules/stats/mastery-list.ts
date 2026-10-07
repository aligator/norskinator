/** Mastery per tag, weakest first, grouped by deck. */
import { LitElement, css, html, type TemplateResult } from 'lit';

import { tagMastery, type TagMastery } from '../../../core/stats.ts';
import { deckById } from '../../../decks/registry.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { formatPercent } from '../shared/format.ts';
import { StoreController, store } from '../shared/store.ts';

function groupByDeck(entries: readonly TagMastery[]): Map<string, TagMastery[]> {
  const groups = new Map<string, TagMastery[]>();

  for (const entry of entries) {
    const group = groups.get(entry.deckId) ?? [];

    group.push(entry);
    groups.set(entry.deckId, group);
  }

  return groups;
}

export class MasteryList extends LitElement {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        gap: var(--sp-6);
      }

      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sp-4);
        margin-bottom: var(--sp-3);
        font-size: var(--fs-sm);
        color: var(--fg-muted);
      }

      .legend .note::before {
        content: none;
      }

      .legend span::before {
        content: '';
        display: inline-block;
        width: 10px;
        height: 10px;
        margin-right: var(--sp-1);
        border-radius: 50%;
        background: var(--swatch);
      }

      ul {
        display: grid;
        gap: var(--sp-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        display: grid;
        grid-template-columns: minmax(5rem, auto) 1fr 3.5rem;
        align-items: center;
        gap: var(--sp-3);
        min-height: 36px;
      }

      .tag {
        font: 600 var(--fs-md) var(--font-prompt);
      }

      .bar {
        display: flex;
        height: 10px;
        border-radius: var(--r-pill);
        background: var(--border);
        overflow: hidden;
      }

      .review {
        background: var(--correct);
      }

      .learning {
        background: var(--accent);
      }

      .pct {
        font: 500 var(--fs-sm) var(--font-num);
        text-align: right;
        color: var(--fg-muted);
      }

      .empty {
        color: var(--fg-muted);
      }
    `,
  ];

  protected readonly storeController = new StoreController(this);

  protected override render(): TemplateResult {
    if (store.state.status !== 'ready') {
      return html`<p class="empty">Laster …</p>`;
    }

    const groups = groupByDeck(tagMastery(store.state.items, store.state.cards));

    return html`${[...groups.entries()].map(([deckId, entries]) => this.#renderDeck(deckId, entries))}`;
  }

  #renderDeck(deckId: string, entries: readonly TagMastery[]): TemplateResult {
    const label = deckById(deckId)?.tagLabel.toLowerCase() ?? 'tema';

    return html`
      <section>
        <h2 class="section-title">Mestring per ${label}</h2>
        <div class="legend" aria-hidden="true">
          <span style="--swatch: var(--correct)">Lært</span>
          <span style="--swatch: var(--accent)">Øves</span>
          <span style="--swatch: var(--border-strong)">Ikke sett</span>
          <span class="note">% = andel riktige svar</span>
        </div>
        <ul>
          ${entries.map((entry) => this.#renderRow(entry))}
        </ul>
      </section>
    `;
  }

  #renderRow(entry: TagMastery): TemplateResult {
    const share = (count: number): string => `${((count / Math.max(entry.total, 1)) * 100).toFixed(1)}%`;
    const hitRate = entry.accuracy === null ? '–' : formatPercent(entry.accuracy);
    const description =
      `${entry.tag}: ${entry.review} lært, ${entry.learning} øves, ${entry.unseen} ikke sett` +
      (entry.accuracy === null ? '' : `, ${hitRate} riktig`);

    return html`
      <li>
        <span class="sr-only">${description}</span>
        <span class="tag" lang="nb" aria-hidden="true">${entry.tag}</span>
        <span class="bar" aria-hidden="true">
          <span class="review" style=${`width: ${share(entry.review)}`}></span>
          <span class="learning" style=${`width: ${share(entry.learning)}`}></span>
        </span>
        <span class="pct" aria-hidden="true">${hitRate}</span>
      </li>
    `;
  }
}

customElements.define('mastery-list', MasteryList);

declare global {
  interface HTMLElementTagNameMap {
    'mastery-list': MasteryList;
  }
}
