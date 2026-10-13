/**
 * Money with its coin. A new value is counted up or down to instead of
 * jumping, and a gain flips the coin. With `memory`, the last value shown is
 * kept across pages, so the balance on the home page counts up after a
 * session.
 */
import { LitElement, css, html, type PropertyValues, type TemplateResult } from 'lit';

import type { CoinIcon } from '../../components/coin-icon.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { formatNumber } from '../shared/format.ts';

import '../../components/coin-icon.ts';

const COUNT_MS = 900;

/** Last value shown per `memory` key, for this page visit. */
const remembered = new Map<string, number>();

function reducedMotion(): boolean {
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class MoneyAmount extends LitElement {
  static override properties = {
    value: { type: Number },
    from: { attribute: false },
    sign: { type: Boolean },
    memory: { type: String },
    shown: { state: true },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: 0.3em;
        white-space: nowrap;
      }

      .number {
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  declare value: number;
  /** Value to count from on first render, e.g. 0 for what a session earned. */
  declare from: number | null;
  /** Shows a plus sign in front of a positive amount. */
  declare sign: boolean;
  declare memory: string | null;
  declare shown: number;

  #frame = 0;

  constructor() {
    super();
    this.value = 0;
    this.from = null;
    this.sign = false;
    this.memory = null;
    this.shown = 0;

    // Tapping the number, not only the coin, makes the coin hop.
    this.addEventListener('pointerdown', (event) => {
      if (event.target === this) {
        this.renderRoot.querySelector<CoinIcon>('ui-coin')?.hop();
      }
    });
  }

  override disconnectedCallback(): void {
    cancelAnimationFrame(this.#frame);
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('value')) {
      return;
    }

    const recalled = this.memory === null ? undefined : remembered.get(this.memory);
    const start = this.hasUpdated ? this.shown : (this.from ?? recalled ?? this.value);

    if (this.memory !== null) {
      remembered.set(this.memory, this.value);
    }

    this.#countTo(start, this.value);
  }

  protected override render(): TemplateResult {
    const plus = this.sign && this.value > 0 ? '+' : '';

    return html`
      <ui-coin></ui-coin>
      <span class="number" aria-hidden="true">${plus}${formatNumber(Math.round(this.shown))}</span>
      <span class="sr-only">${plus}${formatNumber(this.value)} kroner</span>
    `;
  }

  #countTo(start: number, end: number): void {
    cancelAnimationFrame(this.#frame);

    if (start === end || reducedMotion()) {
      this.shown = end;

      return;
    }

    this.shown = start;

    if (end > start) {
      void this.updateComplete.then(() => this.renderRoot.querySelector<CoinIcon>('ui-coin')?.spin());
    }

    const startedAt = performance.now();
    const step = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / COUNT_MS);
      const eased = 1 - (1 - progress) ** 3;

      this.shown = start + (end - start) * eased;

      if (progress < 1) {
        this.#frame = requestAnimationFrame(step);
      }
    };

    this.#frame = requestAnimationFrame(step);
  }
}

customElements.define('money-amount', MoneyAmount);

declare global {
  interface HTMLElementTagNameMap {
    'money-amount': MoneyAmount;
  }
}
