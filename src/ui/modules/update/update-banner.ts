/**
 * Tells the learner about a new app version. A waiting update stays quiet
 * during practice; data from a newer version always shows, because this build
 * has stopped saving and progress would otherwise be lost silently.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { sharedStyles } from '../../components/styles/shared.ts';
import { StoreController, store } from '../shared/store.ts';
import { UpdateController, installUpdate } from './app-update.ts';

export class UpdateBanner extends LitElement {
  static override properties = {
    quiet: { type: Boolean },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        position: fixed;
        top: calc(var(--sp-3) + env(safe-area-inset-top));
        left: 50%;
        z-index: 20;
        width: min(calc(100% - 2 * var(--sp-4)), var(--w-practice));
        transform: translateX(-50%);
      }

      .banner {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
        border-radius: var(--r-lg);
        background: var(--surface);
        box-shadow: var(--shadow-2);
        animation: drop var(--dur-slow) var(--ease-out);
      }

      .banner.warning {
        border: 1.5px solid var(--wrong-border);
        background: var(--wrong-bg);
      }

      p {
        flex: 1;
        font-size: var(--fs-sm);
      }

      .button {
        min-height: var(--hit);
        padding: 0 var(--sp-4);
        font-size: var(--fs-md);
      }

      @keyframes drop {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .banner {
          animation: none;
        }
      }
    `,
  ];

  /** Set during practice: a waiting update must not interrupt a session. */
  declare quiet: boolean;

  protected readonly storeController = new StoreController(this);
  readonly #update = new UpdateController(this);

  constructor() {
    super();
    this.quiet = false;
  }

  protected override render(): TemplateResult | typeof nothing {
    if (store.state.newerVersionStored) {
      return html`
        <div class="banner warning" role="alert">
          <p>En nyere versjon av appen er åpnet. Last inn siden på nytt, ellers lagres ikke fremgangen.</p>
          <button class="button primary" @click=${this.#reload}>Last inn</button>
        </div>
      `;
    }

    if (!this.#update.ready || this.quiet) {
      return nothing;
    }

    return html`
      <div class="banner" role="status">
        <p>En ny versjon av Norskinator er klar.</p>
        <button class="button primary" @click=${installUpdate}>Oppdater</button>
      </div>
    `;
  }

  #reload = (): void => {
    if (this.#update.ready) {
      installUpdate();

      return;
    }

    globalThis.location.reload();
  };
}

customElements.define('update-banner', UpdateBanner);

declare global {
  interface HTMLElementTagNameMap {
    'update-banner': UpdateBanner;
  }
}
