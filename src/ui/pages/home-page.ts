import { LitElement, css, html, type TemplateResult } from 'lit';

import { currentStreak, streakBroken } from '../../core/gamification.ts';
import { greeting } from '../modules/shared/format.ts';
import { SESSION_STARTED_EVENT } from '../modules/shared/session-start.ts';
import { StoreController, store } from '../modules/shared/store.ts';
import { pageStyles } from './page-styles.ts';
import { navigate } from './router.ts';

import '../modules/decks/deck-list.ts';
import '../modules/gamification/streak-chip.ts';
import '../modules/practice/today-card.ts';

export class HomePage extends LitElement {
  static override styles = [
    pageStyles,
    css`
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-4);
      }
    `,
  ];

  protected readonly storeController = new StoreController(this);

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener(SESSION_STARTED_EVENT, this.#onSessionStarted);
  }

  override disconnectedCallback(): void {
    this.removeEventListener(SESSION_STARTED_EVENT, this.#onSessionStarted);
    super.disconnectedCallback();
  }

  protected override render(): TemplateResult {
    const progress = store.state.progress;
    const now = Date.now();

    return html`
      <header>
        <h1>${greeting(new Date())}!</h1>
        <streak-chip .days=${currentStreak(progress, now)} ?broken=${streakBroken(progress, now)}></streak-chip>
      </header>
      <today-card role="region" aria-label="I dag"></today-card>
      <deck-list></deck-list>
    `;
  }

  #onSessionStarted = (): void => {
    navigate('ovelse');
  };
}

customElements.define('home-page', HomePage);

declare global {
  interface HTMLElementTagNameMap {
    'home-page': HomePage;
  }
}
