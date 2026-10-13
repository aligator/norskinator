/** Today's work: goal ring, due and new counts, a glance at the garden, XP and the start button. */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { answersToday, currentStreak, sessionCompletedToday } from '../../../core/gamification.ts';
import { PLANT_STAGES, PLANT_STAGE_LABELS, gardenBeds, totalCounts, type StageCounts } from '../../../core/garden.ts';
import { sessionOptions, sessionPreview, type SessionPreview } from '../../../core/session.ts';
import { spendableXp } from '../../../core/species.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { formatNumber } from '../shared/format.ts';
import { startSession } from '../shared/session-start.ts';
import { StoreController, store } from '../shared/store.ts';

import '../gamification/goal-ring.ts';
import '../gamification/money-amount.ts';
import '../garden/plant-sprite.ts';

const GROWN_STAGES = PLANT_STAGES.filter((stage) => stage !== 'seed');

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

      .glance {
        display: flex;
        justify-content: space-around;
        gap: var(--sp-2);
        padding: var(--sp-2);
        border-radius: var(--r-lg);
        background: var(--surface-2);
        color: var(--fg);
        text-decoration: none;
        transition: background var(--dur-fast) var(--ease-out);
      }

      .glance:hover {
        background: var(--correct-bg);
      }

      .glance span {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        font: 600 var(--fs-sm) var(--font-num);
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
    const counts = totalCounts(gardenBeds(state.items, state.cards, now));

    const preview = sessionPreview(state.items, state.cards, sessionOptions(state.settings), now);

    return html`
      <div class="grid">
        <goal-ring .value=${answersToday(state.progress, now)} .goal=${state.progress.dailyGoal}></goal-ring>
        <div class="figures">
          <p class="figure"><strong>${formatNumber(preview.totalDue)}</strong> til repetisjon</p>
          <p class="figure"><strong>${formatNumber(preview.fresh)}</strong> nye</p>
          <p class="figure">
            <strong><money-amount .value=${spendableXp(state.progress.xp, state.garden)} memory="balance"></money-amount></strong>
          </p>
        </div>
      </div>
      ${this.#renderGlance(counts)}
      ${this.#renderStart(preview)} ${this.#renderStreakHint(now)}
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

  #renderGlance(counts: StageCounts): TemplateResult {
    const label = GROWN_STAGES.map((stage) => `${PLANT_STAGE_LABELS[stage]}: ${formatNumber(counts[stage])}`).join(', ');

    return html`<a class="glance" href="#hage" aria-label=${`Til hagen. ${label}`}>
      ${GROWN_STAGES.map(
        (stage) => html`<span>
          <plant-sprite .plant=${{ stage, wilted: false, growth: 1 }} .size=${32}></plant-sprite>${formatNumber(counts[stage])}
        </span>`,
      )}
    </a>`;
  }

  #renderStart({ due, fresh, unseen, seedRoom }: SessionPreview): TemplateResult {
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
          ${unseen > 0 && seedRoom > 0
            ? html`<button class="button secondary block" @click=${() => startSession(this)}>Øv ekstra</button>`
            : nothing}
          ${unseen > 0 && seedRoom === 0
            ? html`<p>Nye frø kommer når spirene i <a href="#hage">hagen</a> har vokst.</p>`
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
