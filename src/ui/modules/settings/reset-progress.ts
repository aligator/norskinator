/** Danger zone: wipe all progress, behind an inline confirmation. */
import { LitElement, css, html, type TemplateResult } from 'lit';

import { sharedStyles } from '../../components/styles/shared.ts';
import { announce } from '../shared/announce.ts';
import { clearSeenBadges } from '../gamification/badge-grid.ts';
import { store } from '../shared/store.ts';

export class ResetProgress extends LitElement {
  static override properties = {
    confirming: { state: true },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        gap: var(--sp-3);
      }

      .confirm {
        display: grid;
        gap: var(--sp-3);
        padding: var(--sp-4);
        border: 1.5px solid var(--wrong-border);
        border-radius: var(--r-lg);
        background: var(--wrong-bg);
      }

      .actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--sp-3);
      }
    `,
  ];

  declare confirming: boolean;

  constructor() {
    super();
    this.confirming = false;
  }

  protected override render(): TemplateResult {
    return html`
      <h2 class="eyebrow">Faresone</h2>
      ${this.confirming
        ? html`
            <div class="confirm" role="alertdialog" aria-labelledby="reset-text">
              <p id="reset-text">Dette sletter XP, rekker, merker og all repetisjonshistorikk. Innstillingene og dagsmålet beholdes. Kan ikke angres.</p>
              <div class="actions">
                <button class="button secondary" @click=${this.#cancel}>Avbryt</button>
                <button class="button danger-filled" @click=${this.#reset}>Slett alt</button>
              </div>
            </div>
          `
        : html`<button class="button danger block" @click=${this.#ask}>Nullstill all fremgang</button>`}
    `;
  }

  #ask = (): void => {
    this.confirming = true;
    this.#focusAfterRender('.confirm .secondary');
  };

  #cancel = (): void => {
    this.confirming = false;
    this.#focusAfterRender('.danger');
  };

  #reset = (): void => {
    store.resetProgress();
    clearSeenBadges();
    this.confirming = false;
    this.#focusAfterRender('.danger');
    announce(this, 'All fremgang er slettet.');
  };

  /** The clicked button disappears on re-render; without this, focus falls to <body>. */
  #focusAfterRender(selector: string): void {
    void this.updateComplete.then(() => {
      const target = this.renderRoot.querySelector<HTMLElement>(selector);

      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }
}

customElements.define('reset-progress', ResetProgress);

declare global {
  interface HTMLElementTagNameMap {
    'reset-progress': ResetProgress;
  }
}
