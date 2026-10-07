/**
 * Builds a sequence from a pool of word tiles: tapping a pool tile appends it
 * to the answer line, tapping a placed tile sends it back. Tiles are tracked
 * by pool index, so repeated words stay distinct. Emits `tiles-submit` with
 * the chosen words in order once every tile is placed.
 */
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';

import { sharedStyles } from './styles/shared.ts';

/** Digits 1–9 are the only single-key shortcuts there are. */
const SHORTCUT_COUNT = 9;

function capitalise(word: string): string {
  return `${word.charAt(0).toLocaleUpperCase()}${word.slice(1)}`;
}

export class TilePicker extends LitElement {
  static override properties = {
    tiles: { attribute: false },
    placed: { state: true },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        gap: var(--sp-4);
      }

      .answer,
      .pool {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sp-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .answer {
        align-content: flex-start;
        min-height: calc(var(--hit) + 2 * var(--sp-2));
        padding-bottom: var(--sp-2);
        border-bottom: 2px solid var(--border-strong);
      }

      .tile {
        display: inline-flex;
        align-items: center;
        gap: var(--sp-2);
        min-width: var(--hit);
        min-height: var(--hit);
        padding: 0 var(--sp-3);
        border: 1.5px solid var(--option-border);
        border-radius: var(--r-md);
        background: var(--surface);
        box-shadow: var(--shadow-1);
        color: var(--fg);
        font: 600 var(--fs-lg) / var(--lh-tight) var(--font-ui);
        cursor: pointer;
        transition:
          background-color var(--dur-fast) var(--ease-out),
          border-color var(--dur-fast) var(--ease-out),
          transform var(--dur-instant) var(--ease-out);
      }

      .tile:active {
        transform: scale(0.96);
      }

      .answer .tile {
        border-color: var(--accent);
        background: var(--accent-soft);
        animation: place var(--dur-base) var(--ease-out);
      }

      /* Keeps the slot of a placed tile so the pool never reflows. */
      .tile.placeholder {
        border-style: dashed;
        border-color: var(--border);
        background: var(--surface-2);
        box-shadow: none;
        color: transparent;
        cursor: default;
      }

      .tile.placeholder kbd {
        visibility: hidden;
      }

      @media (hover: hover) {
        .pool button.tile:hover {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
      }

      .button[aria-disabled='true'] {
        opacity: 0.45;
        cursor: not-allowed;
      }

      @keyframes place {
        from {
          opacity: 0;
          transform: scale(0.85);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .tile {
          transition: none;
        }

        .answer .tile {
          animation: none;
        }

        .tile:active {
          transform: none;
        }
      }
    `,
  ];

  declare tiles: readonly string[];
  /** Pool indices in the order the learner placed them. */
  declare placed: readonly number[];

  constructor() {
    super();
    this.tiles = [];
    this.placed = [];
  }

  get complete(): boolean {
    return this.tiles.length > 0 && this.placed.length === this.tiles.length;
  }

  /** Appends the pool tile at `poolIndex`; ignored when it is already placed or out of range. */
  pick(poolIndex: number): void {
    if (poolIndex < 0 || poolIndex >= this.tiles.length || this.placed.includes(poolIndex)) {
      return;
    }

    this.placed = [...this.placed, poolIndex];
  }

  /** Sends the last placed tile back to the pool. */
  undo(): void {
    this.placed = this.placed.slice(0, -1);
  }

  submit(): void {
    if (!this.complete) {
      return;
    }

    const words = this.placed.flatMap((poolIndex) => {
      const word = this.tiles[poolIndex];

      return word === undefined ? [] : [word];
    });

    this.dispatchEvent(new CustomEvent<string[]>('tiles-submit', { detail: words, bubbles: true, composed: true }));
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('tiles')) {
      this.placed = [];
    }
  }

  protected override render(): TemplateResult {
    return html`
      <ol class="answer" aria-label="Din setning">
        ${this.placed.map((poolIndex, position) => this.#renderPlaced(poolIndex, position))}
      </ol>
      <div class="pool" role="group" aria-label="Ord">
        ${this.tiles.map((word, poolIndex) => this.#renderPoolTile(word, poolIndex))}
      </div>
      <button
        class="button primary block submit"
        aria-disabled=${this.complete ? 'false' : 'true'}
        aria-keyshortcuts="Enter"
        @click=${this.submit}
      >
        Sjekk
      </button>
    `;
  }

  #renderPlaced(poolIndex: number, position: number): TemplateResult {
    const word = this.tiles[poolIndex] ?? '';
    const shown = position === 0 ? capitalise(word) : word;

    return html`<li>
      <button class="tile" data-position=${position} @click=${(event: Event) => this.#remove(position, event)}>
        ${shown}<span class="sr-only">, fjern</span>
      </button>
    </li>`;
  }

  #renderPoolTile(word: string, poolIndex: number): TemplateResult {
    const shortcut = poolIndex < SHORTCUT_COUNT ? String(poolIndex + 1) : null;
    const key = shortcut === null ? nothing : html`<kbd aria-hidden="true">${shortcut}</kbd>`;

    if (this.placed.includes(poolIndex)) {
      return html`<span class="tile placeholder" aria-hidden="true">${key}${word}</span>`;
    }

    return html`<button
      class="tile"
      data-pool=${poolIndex}
      aria-keyshortcuts=${shortcut ?? nothing}
      @click=${(event: Event) => this.#add(poolIndex, event)}
    >
      ${key}${word}
    </button>`;
  }

  #add(poolIndex: number, event: Event): void {
    const hadFocus = this.#isFocused(event.currentTarget);

    this.pick(poolIndex);

    if (hadFocus) {
      void this.updateComplete.then(() => {
        this.#focusAfterAdd(poolIndex);
      });
    }
  }

  #remove(position: number, event: Event): void {
    const hadFocus = this.#isFocused(event.currentTarget);
    const poolIndex = this.placed[position];

    this.placed = [...this.placed.slice(0, position), ...this.placed.slice(position + 1)];

    if (hadFocus && poolIndex !== undefined) {
      void this.updateComplete.then(() => {
        this.#focusAfterRemove(position, poolIndex);
      });
    }
  }

  /** Touch browsers often never focus a tapped button; only keyboard users need focus carried on. */
  #isFocused(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && this.shadowRoot?.activeElement === target;
  }

  /** The tapped tile is gone; continue with the next free one, or the check button once all are placed. */
  #focusAfterAdd(poolIndex: number): void {
    const free = [...this.renderRoot.querySelectorAll<HTMLButtonElement>('.pool button.tile')];
    const next = free.find((button) => Number(button.dataset['pool']) > poolIndex) ?? free[0];
    const target = next ?? this.renderRoot.querySelector<HTMLButtonElement>('.submit');

    target?.focus();
  }

  /** Stays on the answer line where possible, else follows the tile back into the pool. */
  #focusAfterRemove(position: number, poolIndex: number): void {
    const placed = [...this.renderRoot.querySelectorAll<HTMLButtonElement>('.answer .tile')];
    const neighbour = placed[position] ?? placed[position - 1];
    const target = neighbour ?? this.renderRoot.querySelector<HTMLButtonElement>(`.pool [data-pool="${poolIndex}"]`);

    target?.focus();
  }
}

customElements.define('ui-tile-picker', TilePicker);

declare global {
  interface HTMLElementTagNameMap {
    'ui-tile-picker': TilePicker;
  }
}
