/**
 * One deck as a garden bed that pages sideways: it fills the space it is
 * given, splits the plants into pages of exactly that size and snaps from
 * page to page. The page itself never scrolls. A plot links to its plant's
 * own page; coming back restores the page that was open.
 */
import { LitElement, css, html, type PropertyValues, type TemplateResult } from 'lit';

import { solutionText } from '../../../core/checker.ts';
import { PLANT_STAGE_LABELS, type GardenBed, type GardenPlant, type Plant } from '../../../core/garden.ts';
import type { PlayableItem } from '../../../core/types.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { plantHref } from '../shared/links.ts';
import { gardenMemory } from './garden-memory.ts';

import './plant-sprite.ts';

/** Size of one plot including its gap, in CSS pixels. */
const PLOT_PX = 52;

/** Pages further away than this from the visible one are rendered empty. */
const PAGES_AROUND = 1;

export function plantLabel(plant: Plant): string {
  return plant.wilted ? 'Visnet' : PLANT_STAGE_LABELS[plant.stage];
}

/** Spreads the idle sway so plants do not move in lockstep. */
function swayDelay(id: string): string {
  let hash = 0;

  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }

  return `--sway-delay: -${(hash % 50) / 10}s`;
}

function chunk<T>(entries: readonly T[], size: number): T[][] {
  const pages: T[][] = [];

  for (let start = 0; start < entries.length; start += size) {
    pages.push(entries.slice(start, start + size));
  }

  return pages;
}

export class GardenBedView extends LitElement {
  static override properties = {
    bed: { attribute: false },
    perPage: { state: true },
    page: { state: true },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        min-height: 0;
      }

      .pager {
        flex: 1;
        display: grid;
        grid-auto-columns: 100%;
        grid-auto-flow: column;
        min-height: 0;
        border-radius: var(--r-lg);
        background:
          radial-gradient(circle at 20% 30%, rgb(140 106 79 / 0.08) 0 2px, transparent 3px) 0 0 / 18px 18px,
          var(--surface-2);
        overflow-x: auto;
        overflow-y: hidden;
        overscroll-behavior-x: contain;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
      }

      .pager::-webkit-scrollbar {
        display: none;
      }

      .page {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(${PLOT_PX - 4}px, 1fr));
        grid-auto-rows: ${PLOT_PX - 4}px;
        align-content: start;
        gap: 4px;
        margin: 0;
        padding: var(--sp-2);
        list-style: none;
        scroll-snap-align: start;
      }

      .plot {
        display: grid;
        place-items: center;
        height: 100%;
        border: 1.5px solid transparent;
        border-radius: var(--r-md);
        -webkit-tap-highlight-color: transparent;
        transition: background var(--dur-fast) var(--ease-out);
      }

      /* Hundreds of swaying plants make paging stutter; only the last visited one moves. */
      .plot plant-sprite {
        --sway-state: paused;
      }

      .plot:hover,
      .plot:focus-visible {
        background: var(--surface);
      }

      .plot.visited {
        border-color: var(--accent);
        background: var(--surface);
      }

      .plot.visited plant-sprite {
        --sway-state: running;
      }

      .dots {
        display: flex;
        justify-content: center;
        gap: 6px;
        min-height: 8px;
      }

      .dot {
        width: 6px;
        height: 6px;
        padding: 0;
        border: 0;
        border-radius: var(--r-pill);
        background: var(--border-strong);
        transition:
          width var(--dur-base) var(--ease-out),
          background var(--dur-base) var(--ease-out);
      }

      .dot[aria-current='true'] {
        width: 18px;
        background: var(--accent);
      }

      .empty {
        flex: 1;
        display: grid;
        place-items: center;
        padding: var(--sp-6) var(--sp-4);
        border-radius: var(--r-lg);
        background: var(--surface-2);
        text-align: center;
        color: var(--fg-muted);
      }

      @media (prefers-reduced-motion: reduce) {
        .plot,
        .dot {
          transition: none;
        }
      }
    `,
  ];

  declare bed: GardenBed<PlayableItem>;
  declare perPage: number;
  declare page: number;

  readonly #resize = new ResizeObserver((entries) => this.#measure(entries[0]?.contentRect));
  /** Page to scroll to once the plants are laid out, e.g. when coming back from a plant. */
  #pendingPage: number | null = null;
  #observed: Element | null = null;

  constructor() {
    super();
    this.perPage = 0;
    this.page = 0;
  }

  override disconnectedCallback(): void {
    this.#resize.disconnect();
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    if (gardenMemory.deckPage !== null && gardenMemory.deckId === this.bed.deckId) {
      this.#pendingPage = gardenMemory.deckPage;
    }

    gardenMemory.deckPage = null;
  }

  protected override updated(changed: PropertyValues<this>): void {
    const pager = this.renderRoot.querySelector<HTMLElement>('.pager');

    // The pager only exists once the bed has plants.
    if (pager !== null && pager !== this.#observed) {
      this.#resize.observe(pager);
      this.#observed = pager;
    }

    if (!changed.has('perPage') || this.#pendingPage === null || this.perPage === 0) {
      return;
    }

    if (pager !== null) {
      // The scroll event that follows sets `page`.
      pager.scrollTo({ left: this.#pendingPage * pager.clientWidth, behavior: 'instant' });
    }

    this.#pendingPage = null;
  }

  protected override render(): TemplateResult {
    const plants = this.bed.plants;

    if (plants.length === 0) {
      return html`<p class="empty">Ingen planter her ennå. Hver nye oppgave du løser, blir et frø i denne hagen.</p>`;
    }

    const pages = this.perPage === 0 ? [] : chunk(plants, this.perPage);

    return html`
      <div class="pager" aria-label="Planter" @scroll=${this.#onScroll}>
        ${pages.map((entries, index) =>
          Math.abs(index - this.page) <= PAGES_AROUND
            ? html`<ul class="page" aria-label=${`Side ${index + 1} av ${pages.length}`}>
                ${entries.map((entry) => this.#renderPlot(entry))}
              </ul>`
            : html`<div class="page" aria-hidden="true"></div>`,
        )}
      </div>
      ${pages.length > 1 ? this.#renderDots(pages.length) : html`<div class="dots"></div>`}
    `;
  }

  #renderPlot(entry: GardenPlant<PlayableItem>): TemplateResult {
    const sentence = solutionText(entry.item);
    const thirsty = entry.thirsty ? ', tørst' : '';

    return html`<li>
      <a
        class=${entry.item.id === gardenMemory.visitedId ? 'plot visited' : 'plot'}
        href=${plantHref(entry.item.id)}
        aria-label=${`${plantLabel(entry.plant)}${thirsty}: ${sentence}`}
        @click=${() => this.#remember(entry.item.id)}
      >
        <plant-sprite
          style=${swayDelay(entry.item.id)}
          .plant=${entry.plant}
          .species=${entry.species}
          .size=${40}
          .thirsty=${entry.thirsty}
        ></plant-sprite>
      </a>
    </li>`;
  }

  #renderDots(count: number): TemplateResult {
    return html`<div class="dots">
      ${Array.from(
        { length: count },
        (_unused, index) => html`<button
          class="dot"
          aria-label=${`Side ${index + 1}`}
          aria-current=${index === this.page ? 'true' : 'false'}
          @click=${() => this.#goTo(index)}
        ></button>`,
      )}
    </div>`;
  }

  #measure(rect: DOMRectReadOnly | undefined): void {
    if (rect === undefined || rect.width === 0 || rect.height === 0) {
      return;
    }

    const columns = Math.max(1, Math.floor(rect.width / PLOT_PX));
    const rows = Math.max(1, Math.floor(rect.height / PLOT_PX));
    const perPage = columns * rows;

    if (perPage !== this.perPage) {
      // Keep the first visible plant in view when the page size changes.
      this.#pendingPage ??= this.perPage === 0 ? null : Math.floor((this.page * this.perPage) / perPage);
      this.perPage = perPage;
    }
  }

  #onScroll = (event: Event): void => {
    const pager = event.currentTarget;

    if (!(pager instanceof HTMLElement) || pager.clientWidth === 0) {
      return;
    }

    this.page = Math.round(pager.scrollLeft / pager.clientWidth);
  };

  #goTo(index: number): void {
    const pager = this.renderRoot.querySelector<HTMLElement>('.pager');

    pager?.scrollTo({ left: index * pager.clientWidth, behavior: 'smooth' });
  }

  #remember(id: string): void {
    gardenMemory.visitedId = id;
    gardenMemory.deckId = this.bed.deckId;
    gardenMemory.deckPage = this.page;
  }
}

customElements.define('garden-bed', GardenBedView);

declare global {
  interface HTMLElementTagNameMap {
    'garden-bed': GardenBedView;
  }
}
