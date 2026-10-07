/**
 * Result of one answer: verdict, solution, other accepted answers,
 * explanation, translation and the continue button. Sits in the thumb zone where the options were.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { XP_GOAL_BONUS, badgeById } from '../../../core/gamification.ts';
import { gapParts, normalizeAnswer, solutionText } from '../../../core/checker.ts';
import type { Feedback } from '../../../core/store.ts';
import type { TranslationLanguage } from '../../../core/storage.ts';
import { checkIcon, crossIcon, speakerIcon } from '../../components/icons.ts';
import { speak } from '../audio/speech.ts';
import { VoiceController } from '../audio/voice-controller.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { translationStyles } from './practice-styles.ts';
import { pickTranslation } from './translation.ts';

import '../gamification/goal-ring.ts';
import '../gamification/level-badge.ts';

function headline(feedback: Feedback): string {
  if (!feedback.correct) {
    return 'Ikke helt';
  }

  switch (feedback.grade) {
    case 'easy': {
      return 'Lynraskt!';
    }

    case 'hard': {
      return 'Riktig – men tok litt tid';
    }

    default: {
      return 'Riktig!';
    }
  }
}

export class FeedbackSheet extends LitElement {
  static override properties = {
    feedback: { attribute: false },
    translationLanguage: { attribute: false },
    dailyGoal: { attribute: false },
  };

  static override styles = [
    sharedStyles,
    translationStyles,
    css`
      :host {
        display: block;
      }

      .sheet {
        display: grid;
        gap: var(--sp-4);
        max-height: 60dvh;
        overflow-y: auto;
        padding: var(--sp-5) var(--sp-5) calc(var(--sp-5) + env(safe-area-inset-bottom));
        border-radius: var(--r-xl) var(--r-xl) 0 0;
        box-shadow: var(--shadow-sheet);
        animation: rise var(--dur-slow) var(--ease-out);
      }

      .sheet.correct {
        background: var(--correct-bg);
      }

      .sheet.wrong {
        background: var(--wrong-bg);
      }

      @media (min-width: 600px) {
        .sheet {
          margin: var(--sp-4);
          border-radius: var(--r-xl);
        }
      }

      .headline {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        font-size: var(--fs-xl);
        font-weight: 700;
        line-height: var(--lh-tight);
      }

      .correct .headline {
        color: var(--correct);
      }

      .wrong .headline {
        color: var(--wrong);
      }

      .xp {
        position: relative;
        margin-left: auto;
        padding: 2px var(--sp-3);
        border-radius: var(--r-pill);
        background: var(--surface);
        color: var(--accent);
        font: 700 var(--fs-sm) var(--font-num);
      }

      .xp::after {
        content: attr(data-xp);
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: var(--accent);
        animation: float 600ms var(--ease-out) 200ms forwards;
        opacity: 0;
        pointer-events: none;
      }

      .banner {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        padding: var(--sp-3) var(--sp-4);
        border-radius: var(--r-lg);
        font-weight: 700;
      }

      .banner.level {
        background: var(--gold-bg);
        color: var(--gold);
        font-size: var(--fs-xl);
      }

      .banner.level level-badge {
        animation: grow var(--dur-slow) var(--ease-spring);
      }

      .banner.goal {
        background: var(--surface);
        color: var(--correct);
      }

      .banner.badge {
        background: var(--surface);
        color: var(--fg);
        font-weight: 600;
      }

      .badge-icon {
        font-size: 28px;
      }

      .solution {
        font: 400 var(--fs-lg) / var(--lh-prompt) var(--font-prompt);
      }

      .solution strong {
        font-weight: 600;
        text-decoration: underline 2px;
        text-underline-offset: 0.2em;
      }

      .correct .solution strong {
        text-decoration-color: var(--correct);
      }

      .wrong .solution strong {
        text-decoration-color: var(--wrong);
      }

      .given {
        color: var(--fg-muted);
      }

      .given del {
        color: var(--wrong);
        font-weight: 600;
        text-decoration-thickness: 2px;
      }

      .solution-row {
        display: flex;
        align-items: flex-start;
        gap: var(--sp-2);
      }

      .solution-row .solution {
        flex: 1;
      }

      .listen {
        flex: none;
        color: var(--accent);
      }

      .explanation {
        max-width: 60ch;
      }

      .also-correct {
        color: var(--fg-muted);
      }

      @keyframes rise {
        from {
          transform: translateY(100%);
        }
      }

      @keyframes float {
        0% {
          opacity: 1;
          transform: translateY(0);
        }

        100% {
          opacity: 0;
          transform: translateY(-16px);
        }
      }

      @keyframes grow {
        from {
          transform: scale(0.6);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .sheet {
          animation: fade var(--dur-fast) linear;
        }

        .xp::after,
        .banner.level level-badge {
          animation: none;
        }

        @keyframes fade {
          from {
            opacity: 0;
          }
        }
      }
    `,
  ];

  readonly #voice = new VoiceController(this);

  declare feedback: Feedback;
  declare translationLanguage: TranslationLanguage;
  declare dailyGoal: number;

  constructor() {
    super();
    this.translationLanguage = 'de';
    this.dailyGoal = 20;
  }

  /** A typed answer can be right in more than one way; show the ones the learner did not use. */
  #renderAlsoCorrect(): TemplateResult | typeof nothing {
    const exercise = this.feedback.exercise;

    if (exercise.kind !== 'type-in') {
      return nothing;
    }

    // The solution line already shows the main answer, so it only repeats here when another word was accepted.
    const given = normalizeAnswer(this.feedback.given);
    const others = [exercise.answer, ...(exercise.alternatives ?? [])].filter(
      (word) => normalizeAnswer(word) !== given && (this.feedback.correct || word !== exercise.answer),
    );

    if (others.length === 0) {
      return nothing;
    }

    return html`<p class="also-correct">Også riktig: <span lang="nb">${others.join(', ')}</span></p>`;
  }

  focusContinue(): void {
    this.renderRoot.querySelector<HTMLButtonElement>('.continue')?.focus({ preventScroll: true });
  }

  protected override render(): TemplateResult {
    const feedback = this.feedback;
    const exercise = feedback.exercise;
    const translation = pickTranslation(exercise, this.translationLanguage);
    const levelUp = feedback.levelAfter > feedback.levelBefore;

    return html`
      <section class=${`sheet ${feedback.correct ? 'correct' : 'wrong'}`} aria-labelledby="verdict">
        ${levelUp
          ? html`<div class="banner level">
              <level-badge decorative .level=${feedback.levelAfter}></level-badge>
              <span>Nivå ${feedback.levelAfter}!</span>
            </div>`
          : nothing}
        ${feedback.goalJustReached
          ? html`<div class="banner goal">
              <goal-ring compact .value=${this.dailyGoal} .goal=${this.dailyGoal}></goal-ring>
              <span>Dagsmål nådd! +${XP_GOAL_BONUS} XP</span>
            </div>`
          : nothing}

        <h2 id="verdict" class="headline">
          ${feedback.correct ? checkIcon(24) : crossIcon(24)}
          <span>${headline(feedback)}</span>
          ${feedback.xpGained > 0
            ? html`<span class="xp" data-xp=${`+${feedback.xpGained}`} aria-hidden="true">+${feedback.xpGained} XP</span>`
            : nothing}
        </h2>

        ${feedback.correct
          ? nothing
          : html`<p class="given">Ditt svar: <del lang="nb">${feedback.given}</del></p>`}
        <div class="solution-row">
          <p class="solution" lang="nb">${this.#renderSolution()}</p>
          ${this.#voice.available
            ? html`<button class="icon-button listen" aria-label="Lytt til setningen" @click=${this.#listen}>
                ${speakerIcon()}
              </button>`
            : nothing}
        </div>
        ${this.#renderAlsoCorrect()}
        ${exercise.explanation === undefined
          ? nothing
          : html`<p id="explanation" class="explanation" lang="nb">${exercise.explanation}</p>`}
        ${translation === null
          ? nothing
          : html`<p class="translation" lang=${translation.lang}>
              <span class="lang-tag">${translation.lang.toUpperCase()}</span>${translation.text}
            </p>`}
        ${feedback.newBadges.map((id) => {
          const badge = badgeById(id);

          return badge === undefined
            ? nothing
            : html`<div class="banner badge">
                <span class="badge-icon" aria-hidden="true">${badge.icon}</span>
                <span>Nytt merke: ${badge.title}</span>
              </div>`;
        })}

        <button class="button primary block continue" aria-keyshortcuts="Enter" @click=${this.#continue}>
          Fortsett <kbd aria-hidden="true">Enter</kbd>
        </button>
      </section>
    `;
  }

  #renderSolution(): TemplateResult {
    const parts = gapParts(this.feedback.exercise);

    if (parts === null) {
      return html`${solutionText(this.feedback.exercise)}`;
    }

    return html`${parts.before}<strong>${parts.filled}</strong>${parts.after}`;
  }

  #listen = (): void => {
    speak(solutionText(this.feedback.exercise));
  };

  #continue = (): void => {
    this.dispatchEvent(new CustomEvent('continue', { bubbles: true, composed: true }));
  };
}

customElements.define('feedback-sheet', FeedbackSheet);

declare global {
  interface HTMLElementTagNameMap {
    'feedback-sheet': FeedbackSheet;
  }
}
