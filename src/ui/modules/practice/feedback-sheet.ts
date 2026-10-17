/**
 * Result of one answer: verdict, solution, other accepted answers,
 * explanation, translation and the continue button. Sits in the thumb zone where the options were.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { badgeById } from '../../../core/badges.ts';
import { XP_GOAL_BONUS } from '../../../core/gamification.ts';
import { gapParts, isCorrect, normalizeAnswer, solutionText } from '../../../core/checker.ts';
import { Grade } from '../../../core/srs.ts';
import type { Feedback } from '../../../core/store.ts';
import { TranslationLanguage } from '../../../core/storage.ts';
import { ExerciseKind } from '../../../core/types.ts';
import { checkIcon, crossIcon, speakerIcon } from '../../components/icons.ts';
import { speak } from '../audio/speech.ts';
import { VoiceController } from '../audio/voice-controller.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { plantNews } from '../garden/plant-news.ts';
import { PRACTICE_NOTE, PRACTICE_PLANT_NEWS } from '../shared/session-start.ts';
import { formatComesBack, pluralTimes } from '../shared/format.ts';
import { translationStyles } from './practice-styles.ts';
import { pickTranslation } from './translation.ts';

import '../../components/coin-icon.ts';
import '../gamification/badge-medal.ts';
import '../gamification/goal-ring.ts';
import '../garden/plant-sprite.ts';

/** The grade says something about speed only when the app set it; a learner's own rating is not praise or blame. */
function headline(feedback: Feedback, manualRating: boolean): string {
  if (!feedback.correct) {
    return 'Ikke helt';
  }

  if (manualRating) {
    return 'Riktig!';
  }

  switch (feedback.grade) {
    case Grade.Easy: {
      return 'Lynraskt!';
    }

    case Grade.Hard: {
      return 'Riktig – men tok litt tid';
    }

    default: {
      return 'Riktig!';
    }
  }
}

/** A built word order is shown as a sentence: capital letter and a full stop, like the solution. */
function givenText(feedback: Feedback): string {
  if (feedback.exercise.kind !== ExerciseKind.WordOrder || feedback.given === '') {
    return feedback.given;
  }

  const sentence = `${feedback.given.charAt(0).toLocaleUpperCase('nb-NO')}${feedback.given.slice(1)}`;
  const ending = /[.!?]$/u.exec(feedback.exercise.answer)?.[0] ?? '.';

  return `${sentence}${ending}`;
}

export class FeedbackSheet extends LitElement {
  static override properties = {
    feedback: { attribute: false },
    translationLanguage: { attribute: false },
    dailyGoal: { attribute: false },
    practice: { type: Boolean },
    manualRating: { type: Boolean },
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
        display: inline-flex;
        align-items: center;
        gap: 4px;
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

      .plant-row {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        padding: var(--sp-2) var(--sp-3);
        border-radius: var(--r-lg);
        background: var(--surface);
      }

      .plant-news {
        font-weight: 700;
      }

      .plant-facts {
        font-size: var(--fs-sm);
        color: var(--fg-muted);
      }

      .banner.goal {
        background: var(--surface);
        color: var(--correct);
      }

      .banner.badge {
        background: var(--surface);
        color: var(--fg);
        font-weight: 600;
        animation: banner-in 500ms var(--ease-spring) both;
      }

      @keyframes banner-in {
        from {
          opacity: 0;
          transform: scale(0.85);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .banner.badge {
          animation: none;
        }
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

      .also-correct ul {
        margin: var(--sp-1) 0 0;
        padding: 0;
        list-style: none;
        font-family: var(--font-prompt);
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

      @media (prefers-reduced-motion: reduce) {
        .sheet {
          animation: fade var(--dur-fast) linear;
        }

        .xp::after {
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
  /** A practice answer leaves the plant alone; its due date and reps say nothing new. */
  declare practice: boolean;
  /** The learner rated the answer, so its grade says nothing about speed. */
  declare manualRating: boolean;

  constructor() {
    super();
    this.translationLanguage = TranslationLanguage.German;
    this.dailyGoal = 20;
    this.practice = false;
    this.manualRating = false;
  }

  /** An answer can be right in more than one way; show the ones the learner did not use. */
  #renderAlsoCorrect(): TemplateResult | typeof nothing {
    const exercise = this.feedback.exercise;

    switch (exercise.kind) {
      case ExerciseKind.MultipleChoice: {
        return nothing;
      }

      case ExerciseKind.TypeIn: {
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

      case ExerciseKind.WordOrder: {
        // Checked against one sentence at a time, so the comparison is exactly the grader's.
        const others = (exercise.alternatives ?? []).filter(
          (sentence) => !isCorrect({ ...exercise, answer: sentence, alternatives: [] }, this.feedback.given),
        );

        if (others.length === 0) {
          return nothing;
        }

        return html`<div class="also-correct">
          Også riktig:
          <ul lang="nb">
            ${others.map((sentence) => html`<li>${sentence}</li>`)}
          </ul>
        </div>`;
      }
    }
  }

  focusContinue(): void {
    this.renderRoot.querySelector<HTMLButtonElement>('.continue')?.focus({ preventScroll: true });
  }

  protected override render(): TemplateResult {
    const feedback = this.feedback;
    const exercise = feedback.exercise;
    const translation = pickTranslation(exercise, this.translationLanguage);

    return html`
      <section class=${`sheet ${feedback.correct ? 'correct' : 'wrong'}`} aria-labelledby="verdict">
        ${feedback.goalJustReached
          ? html`<div class="banner goal">
              <goal-ring compact .value=${this.dailyGoal} .goal=${this.dailyGoal}></goal-ring>
              <span>Dagsmål nådd! <ui-coin spin></ui-coin> +${XP_GOAL_BONUS}</span>
            </div>`
          : nothing}

        <h2 id="verdict" class="headline">
          ${feedback.correct ? checkIcon(24) : crossIcon(24)}
          <span>${headline(feedback, this.manualRating)}</span>
          ${feedback.xpGained > 0
            ? html`<span class="xp" data-xp=${`+${feedback.xpGained}`} aria-hidden="true"><ui-coin spin></ui-coin>+${feedback.xpGained}</span>`
            : nothing}
        </h2>

        <div class="plant-row">
          <plant-sprite
            .from=${feedback.plantBefore}
            .plant=${feedback.plantAfter}
            .species=${feedback.species}
            .size=${56}
          ></plant-sprite>
          ${this.practice
            ? html`<div>
                <p class="plant-news">${PRACTICE_PLANT_NEWS}</p>
                <p class="plant-facts">${PRACTICE_NOTE}</p>
              </div>`
            : html`<div>
                <p class="plant-news">${plantNews(feedback.plantBefore, feedback.plantAfter)}</p>
                <p class="plant-facts">
                  Kommer igjen ${formatComesBack(feedback.nextDue, Date.now())} · øvd ${pluralTimes(feedback.reps)}
                </p>
              </div>`}
        </div>

        ${feedback.correct
          ? nothing
          : html`<p class="given">Ditt svar: <del lang="nb">${givenText(feedback)}</del></p>`}
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
                <badge-medal .badge=${badge} pop .delay=${200} .size=${40}></badge-medal>
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
