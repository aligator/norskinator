/** Today's work: goal ring, due and new counts, level and the start button. */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { answersToday, currentStreak, levelInfo, sessionCompletedToday } from '../../../core/gamification.ts';
import { EXTRA_SESSION_NEW, sessionPreview } from '../../../core/session.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { formatNumber } from '../shared/format.ts';
import { startSession } from '../shared/session-start.ts';
import { StoreController, store } from '../shared/store.ts';

import '../gamification/goal-ring.ts';
import '../gamification/level-badge.ts';
import '../gamification/xp-bar.ts';

/** «3 repetisjoner · 10 nye», leaving out a part that is zero. */
function startSummary(due: number, fresh: number): string {
  const parts: string[] = [];

  if (due > 0) {
    parts.push(`${formatNumber(due)} ${due === 1 ? 'repetisjon' : 'repetisjoner'}`);
  }

  if (fresh > 0) {
    parts.push(`${formatNumber(fresh)} ${fresh === 1 ? 'ny' : 'nye'}`);
  }

  return parts.join(' · ');
}

export class TodayCard extends LitElement {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        gap: var(--sp-6);
        padding: var(--sp-6);
        border-radius: var(--r-xl);
        background: var(--surface);
        box-shadow: var(--shadow-2);
      }

      .grid {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: var(--sp-6);
      }

      .figures {
        display: grid;
        gap: var(--sp-3);
        min-width: 0;
      }

      .figure {
        color: var(--fg-muted);
      }

      .figure strong {
        color: var(--fg);
        font: 700 var(--fs-xl) / 1 var(--font-num);
      }

      .level-row {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
      }

      .level-row xp-bar {
        flex: 1;
      }

      .cta {
        flex-direction: column;
        gap: 2px;
      }

      .cta small {
        font-size: var(--fs-sm);
        font-weight: 400;
        opacity: 0.85;
      }

      .streak-hint {
        font-size: var(--fs-sm);
        text-align: center;
        color: var(--flame);
      }

      .done {
        display: grid;
        gap: var(--sp-3);
        text-align: center;
        color: var(--fg-muted);
      }

      .error {
        padding: var(--sp-4);
        border-radius: var(--r-lg);
        background: var(--wrong-bg);
        color: var(--wrong);
      }

      @media (max-width: 359px) {
        .grid {
          grid-template-columns: 1fr;
          justify-items: center;
          text-align: center;
        }
      }
    `,
  ];

  protected readonly storeController = new StoreController(this);

  protected override render(): TemplateResult {
    const state = store.state;
    const now = Date.now();
    const info = levelInfo(state.progress.xp);

    const preview = sessionPreview(state.items, state.cards, state.settings.newPerSession, now);

    return html`
      <div class="grid">
        <goal-ring .value=${answersToday(state.progress, now)} .goal=${state.progress.dailyGoal}></goal-ring>
        <div class="figures">
          <p class="figure"><strong>${formatNumber(preview.totalDue)}</strong> til repetisjon</p>
          <p class="figure"><strong>${formatNumber(preview.fresh)}</strong> nye</p>
          <div class="level-row">
            <level-badge .level=${info.level}></level-badge>
            <xp-bar .xp=${state.progress.xp}></xp-bar>
          </div>
        </div>
      </div>
      ${this.#renderStart(preview.due, preview.fresh, preview.unseen)} ${this.#renderStreakHint(now)}
    `;
  }

  /** The streak only grows with a completed session, so say so until today's is done. */
  #renderStreakHint(now: number): TemplateResult | typeof nothing {
    const progress = store.state.progress;

    if (store.state.status !== 'ready' || sessionCompletedToday(progress, now)) {
      return nothing;
    }

    const streak = currentStreak(progress, now);
    const text = streak > 0 ? `Fullfør en økt i dag for å holde rekka på ${streak}.` : 'Fullfør en økt for å starte en rekke.';

    return html`<p class="streak-hint">${text}</p>`;
  }

  #renderStart(due: number, fresh: number, unseen: number): TemplateResult {
    const status = store.state.status;

    if (status === 'error') {
      return html`
        <p class="error" role="alert">Kunne ikke laste oppgavene: ${store.state.error}</p>
        <button class="button secondary block" @click=${() => void store.init()}>Prøv igjen</button>
      `;
    }

    if (status !== 'ready') {
      return html`<button class="button primary block cta" disabled aria-busy="true">Laster oppgaver …</button>`;
    }

    if (due === 0 && fresh === 0) {
      return html`
        <div class="done">
          <p>Alt er repetert for i dag.</p>
          ${unseen > 0
            ? html`<button class="button secondary block" @click=${() => startSession(this, undefined, EXTRA_SESSION_NEW)}>Øv ekstra</button>`
            : nothing}
        </div>
      `;
    }

    return html`
      <button class="button primary block cta" @click=${() => startSession(this)}>
        <span>Start økt</span>
        <small>${startSummary(due, fresh)}</small>
      </button>
    `;
  }
}

customElements.define('today-card', TodayCard);

declare global {
  interface HTMLElementTagNameMap {
    'today-card': TodayCard;
  }
}
