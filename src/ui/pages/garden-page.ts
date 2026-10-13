import { LitElement, css, html, type TemplateResult } from 'lit';

import { GARDEN_INFO_HREF, SHOP_HREF } from '../modules/shared/links.ts';
import { SESSION_STARTED_EVENT } from '../modules/shared/session-start.ts';
import { pageStyles } from './page-styles.ts';
import { navigate } from './router.ts';

import '../modules/garden/garden-view.ts';

/** Exactly one screen high: the bed pages sideways, the page never scrolls. */
export class GardenPage extends LitElement {
  static override styles = [
    pageStyles,
    css`
      :host {
        box-sizing: border-box;
        height: calc(100dvh - var(--tabbar-h) - env(safe-area-inset-bottom) - env(safe-area-inset-top));
        gap: var(--sp-3);
        padding-block: var(--sp-4) var(--sp-3);
      }

      @media (min-width: 900px) {
        :host {
          height: calc(100dvh - env(safe-area-inset-top));
          padding-block: var(--sp-6);
        }
      }

      header {
        display: flex;
        flex: none;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-4);
      }

      .links {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
      }

      .links a {
        display: inline-flex;
        align-items: center;
        min-height: 40px;
        padding: 0 var(--sp-3);
        border-radius: var(--r-pill);
        font-size: var(--fs-sm);
        font-weight: 600;
        text-decoration: none;
      }

      .shop {
        background: var(--gold-bg);
        color: var(--gold);
      }

      .info {
        min-width: 40px;
        justify-content: center;
        background: var(--surface-2);
      }

      garden-view {
        flex: 1;
        min-height: 0;
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('wide', '');
    this.addEventListener(SESSION_STARTED_EVENT, this.#onSessionStarted);
  }

  override disconnectedCallback(): void {
    this.removeEventListener(SESSION_STARTED_EVENT, this.#onSessionStarted);
    super.disconnectedCallback();
  }

  protected override render(): TemplateResult {
    return html`
      <header>
        <h1>Hagen</h1>
        <div class="links">
          <a class="shop" href=${SHOP_HREF}>🌱 Frøbutikk</a>
          <a class="info" href=${GARDEN_INFO_HREF} aria-label="Slik vokser hagen">?</a>
        </div>
      </header>
      <garden-view></garden-view>
    `;
  }

  #onSessionStarted = (): void => {
    navigate('ovelse');
  };
}

customElements.define('garden-page', GardenPage);

declare global {
  interface HTMLElementTagNameMap {
    'garden-page': GardenPage;
  }
}
