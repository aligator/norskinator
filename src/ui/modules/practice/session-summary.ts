/** End-of-session screen: result, XP, best combo and badges earned. */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { badgeById, type Progress } from '../../../core/gamification.ts';
import type { SessionState } from '../../../core/store.ts';
import { flameIcon } from '../../components/icons.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { formatNumber, pluralDays } from '../shared/format.ts';

export class SessionSummary extends LitElement {
  static override properties = {
    session: { attribute: false },
    progress: { attribute: false },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 100dvh;
        padding: var(--sp-8) var(--sp-4) calc(var(--sp-4) + env(safe-area-inset-bottom));
        text-align: center;
      }

      .result {
        display: grid;
        align-content: center;
        justify-items: center;
        gap: var(--sp-6);
        flex: 1;
      }

      h2 {
        font: 700 var(--fs-hero) / var(--lh-tight) var(--font-ui);
      }

      .stats {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .stats li {
        padding: 0 var(--sp-4);
        border-left: 1px solid var(--border);
      }

      .stats li:first-child {
        border-left: 0;
      }

      .stats strong {
        display: block;
        font: 700 var(--fs-xl) var(--font-num);
      }

      .stats span {
        font-size: var(--fs-sm);
        color: var(--fg-muted);
      }

      .earned {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: var(--sp-3);
      }

      .earned span {
        padding: var(--sp-2) var(--sp-3);
        border-radius: var(--r-lg);
        background: var(--gold-bg);
        font-weight: 600;
      }

      .streak {
        display: inline-flex;
        align-items: center;
        gap: var(--sp-2);
        padding: var(--sp-2) var(--sp-4);
        border-radius: var(--r-pill);
        background: var(--flame-bg);
        color: var(--flame);
        font-weight: 700;
      }

      .actions {
        display: grid;
        gap: var(--sp-3);
        width: 100%;
      }
    `,
  ];

  declare session: SessionState;
  declare progress: Progress;

  focusHeading(): void {
    this.renderRoot.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }

  protected override render(): TemplateResult {
    const session = this.session;
    const badges = session.badgesEarned.map((id) => badgeById(id)).filter((badge) => badge !== undefined);

    return html`
      <div class="result">
        <h2 tabindex="-1">Ferdig!</h2>
        <ul class="stats">
          <li><strong>${session.correct}/${session.answered}</strong> <span>riktig</span></li>
          <li><strong>+${formatNumber(session.xpEarned)}</strong> <span>XP</span></li>
          <li><strong>${session.bestCombo}</strong> <span>beste kombo</span></li>
        </ul>
        ${this.session.streakExtended
          ? html`<p class="streak">${flameIcon()}<span>${this.#streakText()}</span></p>`
          : nothing}
        ${badges.length === 0
          ? nothing
          : html`<div class="earned" role="group" aria-label="Nye merker">
              ${badges.map((badge) => html`<span>${badge.icon} ${badge.title}</span>`)}
            </div>`}
      </div>
      <div class="actions">
        <button class="button primary block" @click=${() => this.#emit('home')}>Tilbake til hjem</button>
        <button class="button secondary block" @click=${() => this.#emit('more')}>Øv ekstra</button>
      </div>
    `;
  }

  #streakText(): string {
    const days = this.progress.streakDays;

    return days === 1 ? 'Rekka er i gang – kom tilbake i morgen!' : `${pluralDays(days)} på rad!`;
  }

  #emit(name: 'home' | 'more'): void {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  }
}

customElements.define('session-summary', SessionSummary);

declare global {
  interface HTMLElementTagNameMap {
    'session-summary': SessionSummary;
  }
}
