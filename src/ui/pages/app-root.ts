/** Base page: navigation, routing, theme, the live region and the store lifecycle. */
import { LitElement, css, html, nothing, type SVGTemplateResult, type TemplateResult } from 'lit';

import { STORAGE_KEY, type ThemePreference } from '../../core/storage.ts';
import { homeIcon, settingsIcon, statsIcon } from '../components/icons.ts';
import { sharedStyles } from '../components/styles/shared.ts';
import { ANNOUNCE_EVENT } from '../modules/shared/announce.ts';
import { TOUR_REQUESTED_EVENT, tourDone } from '../modules/onboarding/tour-state.ts';
import { StoreController, store } from '../modules/shared/store.ts';
import { startUpdateWatch } from '../modules/update/app-update.ts';
import { ROUTE_TITLES, currentRoute, navigate, type Route } from './router.ts';

import '../modules/onboarding/welcome-tour.ts';
import '../modules/update/update-banner.ts';
import './home-page.ts';
import './legal-page.ts';
import './practice-page.ts';
import './settings-page.ts';
import './stats-page.ts';

interface Tab {
  readonly route: Route;
  readonly label: string;
  readonly icon: () => SVGTemplateResult;
}

const TABS: readonly Tab[] = [
  { route: 'hjem', label: 'Hjem', icon: homeIcon },
  { route: 'statistikk', label: 'Statistikk', icon: statsIcon },
  { route: 'innstillinger', label: 'Innstillinger', icon: settingsIcon },
];

/** Browser chrome colour per theme, kept in sync with `--bg`. */
const THEME_COLORS = { light: '#F4F6F9', dark: '#0D1420' } as const;

export class AppRoot extends LitElement {
  static override properties = {
    route: { state: true },
    message: { state: true },
    touring: { state: true },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        grid-template-rows: 1fr auto;
        min-height: 100dvh;
      }

      .skip-link {
        position: absolute;
        top: var(--sp-2);
        left: var(--sp-2);
        z-index: 10;
        padding: var(--sp-2) var(--sp-4);
        border-radius: var(--r-md);
        background: var(--surface);
        transform: translateY(-200%);
      }

      .skip-link:focus {
        transform: none;
      }

      main {
        min-width: 0;
        padding-top: env(safe-area-inset-top);
        padding-left: max(var(--gutter), env(safe-area-inset-left));
        padding-right: max(var(--gutter), env(safe-area-inset-right));
      }

      main:focus {
        outline: none;
      }

      main.immersive {
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
      }

      nav {
        position: sticky;
        bottom: 0;
        z-index: 5;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
        padding-bottom: env(safe-area-inset-bottom);
        border-top: 1px solid var(--border);
        background: var(--surface);
      }

      nav a {
        display: grid;
        justify-items: center;
        align-content: center;
        gap: 2px;
        min-height: var(--hit);
        color: var(--fg-muted);
        font-size: var(--fs-xs);
        font-weight: 600;
        text-decoration: none;
      }

      nav a .pill {
        display: grid;
        place-items: center;
        width: 64px;
        height: 32px;
        border-radius: var(--r-pill);
        transition: background-color var(--dur-fast) var(--ease-out);
      }

      nav a[aria-current='page'] {
        color: var(--accent);
      }

      nav a[aria-current='page'] .pill {
        background: var(--accent-soft);
      }

      @media (min-width: 900px) {
        :host {
          grid-template-columns: var(--rail-w) 1fr;
          grid-template-rows: none;
        }

        :host([immersive]) {
          grid-template-columns: 1fr;
        }

        nav {
          grid-column: 1;
          grid-row: 1;
          top: 0;
          align-self: start;
          grid-template-columns: none;
          grid-auto-rows: min-content;
          gap: var(--sp-4);
          height: 100dvh;
          padding: calc(var(--sp-6) + env(safe-area-inset-top)) 0 var(--sp-6);
          border-top: 0;
          border-right: 1px solid var(--border);
        }

        main {
          grid-column: 2;
          grid-row: 1;
        }

        :host([immersive]) main {
          grid-column: 1;
        }
      }
    `,
  ];

  declare route: Route;
  declare message: string;
  declare touring: boolean;

  protected readonly storeController = new StoreController(this);
  readonly #darkQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    super();
    this.route = currentRoute();
    this.message = '';
    this.touring = !tourDone();
  }

  override connectedCallback(): void {
    super.connectedCallback();

    globalThis.addEventListener('hashchange', this.#onHashChange);
    globalThis.addEventListener('storage', this.#onStorage);
    globalThis.addEventListener('pagehide', this.#flush);
    document.addEventListener('visibilitychange', this.#onVisibilityChange);
    this.#darkQuery.addEventListener('change', this.#applyTheme);
    this.addEventListener(ANNOUNCE_EVENT, this.#onAnnounce);
    this.addEventListener(TOUR_REQUESTED_EVENT, this.#onTourRequested);

    void store.init();
    startUpdateWatch();
  }

  override disconnectedCallback(): void {
    globalThis.removeEventListener('hashchange', this.#onHashChange);
    globalThis.removeEventListener('storage', this.#onStorage);
    globalThis.removeEventListener('pagehide', this.#flush);
    document.removeEventListener('visibilitychange', this.#onVisibilityChange);
    this.#darkQuery.removeEventListener('change', this.#applyTheme);
    this.removeEventListener(ANNOUNCE_EVENT, this.#onAnnounce);
    this.removeEventListener(TOUR_REQUESTED_EVENT, this.#onTourRequested);

    super.disconnectedCallback();
  }

  #appliedTheme: ThemePreference | null = null;

  protected override willUpdate(): void {
    // Store changes arrive on every answer; touching the document root each time would restyle the page.
    if (store.state.settings.theme !== this.#appliedTheme) {
      this.#applyTheme();
    }

    this.toggleAttribute('immersive', this.route === 'ovelse');
    document.title = `${ROUTE_TITLES[this.route]} · Norskinator`;
  }

  protected override render(): TemplateResult {
    const immersive = this.route === 'ovelse';

    return html`
      <a class="skip-link" href="#innhold" @click=${this.#skipToContent}>Hopp til innhold</a>
      <main id="innhold" tabindex="-1" class=${immersive ? 'immersive' : ''}>${this.#renderRoute()}</main>
      ${immersive ? nothing : this.#renderNav()}
      <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">${this.message}</div>
      <update-banner ?quiet=${immersive}></update-banner>
      ${this.touring ? html`<welcome-tour @tour-closed=${this.#onTourClosed}></welcome-tour>` : nothing}
    `;
  }

  #renderRoute(): TemplateResult {
    switch (this.route) {
      case 'hjem': {
        return html`<home-page></home-page>`;
      }

      case 'ovelse': {
        return html`<practice-page></practice-page>`;
      }

      case 'statistikk': {
        return html`<stats-page></stats-page>`;
      }

      case 'innstillinger': {
        return html`<settings-page></settings-page>`;
      }

      case 'impressum': {
        return html`<legal-page></legal-page>`;
      }
    }
  }

  #renderNav(): TemplateResult {
    return html`
      <nav aria-label="Hovedmeny">
        ${TABS.map(
          (tab) => html`
            <a href=${`#${tab.route}`} aria-current=${tab.route === this.route ? 'page' : 'false'}>
              <span class="pill">${tab.icon()}</span>
              <span>${tab.label}</span>
            </a>
          `,
        )}
      </nav>
    `;
  }

  #onTourRequested = (): void => {
    this.touring = true;
  };

  #onTourClosed = (event: Event): void => {
    this.touring = false;

    const wantsToStart = event instanceof CustomEvent && event.detail?.start === true;

    if (wantsToStart) {
      void this.#startFirstSession();
    }
  };

  /** The tour can finish before the exercise bundle has loaded. */
  async #startFirstSession(): Promise<void> {
    await whenLoaded();

    store.startSession();

    if (store.state.session !== null) {
      navigate('ovelse');
    }
  }

  /** Hash links would otherwise be read as routes. */
  #skipToContent = (event: Event): void => {
    event.preventDefault();
    this.renderRoot.querySelector<HTMLElement>('main')?.focus();
  };

  #onHashChange = (): void => {
    this.route = currentRoute();
    globalThis.scrollTo({ top: 0 });

    // Tells screen-reader users the page changed; practice moves focus itself.
    if (this.route !== 'ovelse') {
      void this.updateComplete.then(() => {
        this.renderRoot.querySelector<HTMLElement>('main')?.focus({ preventScroll: true });
      });
    }
  };

  /** Another tab wrote progress; adopt it instead of overwriting it on our next save. */
  #onStorage = (event: StorageEvent): void => {
    if (event.storageArea !== globalThis.localStorage) {
      return;
    }

    if (event.key === STORAGE_KEY || event.key === null) {
      store.reloadFromStorage();
    }
  };

  #onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.#flush();
    }
  };

  #flush = (): void => {
    store.flush();
  };

  #onAnnounce = (event: Event): void => {
    if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') {
      return;
    }

    // Clearing first makes screen readers repeat an identical message.
    this.message = '';

    requestAnimationFrame(() => {
      this.message = event.detail;
    });
  };

  #applyTheme = (): void => {
    const preference: ThemePreference = store.state.settings.theme;
    const root = document.documentElement;

    this.#appliedTheme = preference;

    if (preference === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', preference);
    }

    const resolved = preference === 'auto' ? (this.#darkQuery.matches ? 'dark' : 'light') : preference;

    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = THEME_COLORS[resolved];
    }
  };
}

function whenLoaded(): Promise<void> {
  return new Promise((resolve) => {
    const settled = (): boolean => store.state.status === 'ready' || store.state.status === 'error';

    if (settled()) {
      resolve();

      return;
    }

    const unsubscribe = store.subscribe(() => {
      if (settled()) {
        unsubscribe();
        resolve();
      }
    });
  });
}

customElements.define('app-root', AppRoot);

declare global {
  interface HTMLElementTagNameMap {
    'app-root': AppRoot;
  }
}
