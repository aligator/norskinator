/** All badges by category: earned ones first, then locked ones with their hint. */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { BADGES, BADGE_CATEGORY_LABELS, badgeById, type Badge, type BadgeCategory } from '../../../core/badges.ts';
import { lockIcon } from '../../components/icons.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { StoreController, store } from '../shared/store.ts';

import './badge-medal.ts';

const BADGE_CATEGORIES: readonly BadgeCategory[] = ['garden', 'money', 'practice'];

/** UI-only memory of which badges the learner has already looked at. */
const SEEN_BADGES_KEY = 'norskinator.seenBadges';

function readSeenBadges(): Set<string> {
  try {
    const raw = globalThis.localStorage.getItem(SEEN_BADGES_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'));
  } catch {
    return new Set();
  }
}

/** Called on progress reset, so badges earned again show as new again. */
export function clearSeenBadges(): void {
  try {
    globalThis.localStorage.removeItem(SEEN_BADGES_KEY);
  } catch {
    // Nothing stored means nothing to clear.
  }
}

function writeSeenBadges(ids: readonly string[]): void {
  try {
    globalThis.localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify(ids));
  } catch {
    // A missed "seen" mark only means the NY label shows once more.
  }
}

/** Delay between two new medals popping in, in ms. */
const POP_STEP_MS = 150;

export class BadgeGrid extends LitElement {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        gap: var(--sp-6);
      }

      section {
        display: grid;
        gap: var(--sp-3);
      }

      h3 {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        font-size: var(--fs-md);
      }

      ul {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
        gap: var(--sp-3);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        position: relative;
        display: grid;
        justify-items: center;
        align-content: start;
        gap: var(--sp-2);
        padding: var(--sp-4) var(--sp-3);
        border-radius: var(--r-lg);
        background: var(--surface);
        text-align: center;
      }

      li.locked {
        background: var(--surface-2);
        color: var(--fg-muted);
      }

      .title {
        font-size: var(--fs-sm);
        font-weight: 600;
      }

      .description {
        font-size: var(--fs-xs);
        color: var(--fg-muted);
      }

      .corner {
        position: absolute;
        top: var(--sp-2);
        right: var(--sp-2);
      }

      .new {
        padding: 0 var(--sp-2);
        border-radius: var(--r-pill);
        background: var(--accent);
        color: var(--accent-fg);
        font-size: var(--fs-xs);
        font-weight: 700;
      }
    `,
  ];

  protected readonly storeController = new StoreController(this);

  /** Captured once per visit, so badges stay marked NY while the page is open. */
  readonly #seenAtOpen = readSeenBadges();

  /** Saved right away: the tab may be closed on this page without a disconnect. */
  protected override updated(): void {
    writeSeenBadges(store.state.progress.unlockedBadges);
  }

  protected override render(): TemplateResult {
    const unlocked = store.state.progress.unlockedBadges;
    const total = unlocked.filter((id) => badgeById(id) !== undefined).length;
    let popped = 0;

    return html`
      <h2 class="section-title">Merker <span class="tabular">${total} / ${BADGES.length}</span></h2>
      ${BADGE_CATEGORIES.map((category) => {
        const badges = BADGES.filter((badge) => badge.category === category);
        const earned = badges.filter((badge) => unlocked.includes(badge.id));
        const locked = badges.filter((badge) => !unlocked.includes(badge.id));

        return html`<section aria-labelledby=${`badges-${category}`}>
          <h3 id=${`badges-${category}`}>
            ${BADGE_CATEGORY_LABELS[category]}
            <span class="tabular description">${earned.length} / ${badges.length}</span>
          </h3>
          <ul>
            ${earned.map((badge) => {
              const isNew = !this.#seenAtOpen.has(badge.id);
              const delay = isNew ? popped++ * POP_STEP_MS : 0;

              return this.#renderBadge(badge, true, isNew, delay);
            })}
            ${locked.map((badge) => this.#renderBadge(badge, false, false, 0))}
          </ul>
        </section>`;
      })}
    `;
  }

  #renderBadge(badge: Badge, earned: boolean, isNew: boolean, delay: number): TemplateResult {
    return html`
      <li class=${earned ? '' : 'locked'}>
        ${earned ? nothing : html`<span class="corner" role="img" aria-label="Låst">${lockIcon()}</span>`}
        ${isNew ? html`<span class="corner new">NY</span>` : nothing}
        <badge-medal .badge=${badge} .earned=${earned} .pop=${isNew} .delay=${delay} .size=${60}></badge-medal>
        <span class="title">${badge.title}</span>
        <span class="description">${badge.description}</span>
      </li>
    `;
  }
}

customElements.define('badge-grid', BadgeGrid);

declare global {
  interface HTMLElementTagNameMap {
    'badge-grid': BadgeGrid;
  }
}
