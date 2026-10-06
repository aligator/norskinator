/**
 * Runs a practice session: question → feedback → … → summary, including the
 * keyboard model and screen-reader announcements. Emits `exit` when the
 * learner leaves; the page decides where to go.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';

import { badgeById } from '../../../core/gamification.ts';
import { solutionText } from '../../../core/checker.ts';
import { EXTRA_SESSION_NEW } from '../../../core/session.ts';
import type { Feedback } from '../../../core/store.ts';
import { deckById } from '../../../decks/registry.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { playSound, type SoundKind } from '../audio/sound-effects.ts';
import { speak, stopSpeaking } from '../audio/speech.ts';
import { announce } from '../shared/announce.ts';
import { StoreController, store } from '../shared/store.ts';
import type { ExerciseCard } from './exercise-card.ts';
import type { FeedbackSheet } from './feedback-sheet.ts';
import { COMBO_VISIBLE_FROM } from './session-top-bar.ts';
import type { SessionSummary } from './session-summary.ts';

import './exercise-card.ts';
import './feedback-sheet.ts';
import './session-summary.ts';
import './session-top-bar.ts';

/**
 * A quick second tap or key press right after answering must not skip the
 * feedback unread — the Fortsett button rises exactly where the option was.
 */
const CONTINUE_GUARD_MS = 400;

/** One sound per answer; the rarer celebration wins over plain right/wrong. */
function soundFor(feedback: Feedback): SoundKind {
  if (feedback.levelAfter > feedback.levelBefore) {
    return 'level-up';
  }

  if (feedback.goalJustReached) {
    return 'goal';
  }

  return feedback.correct ? 'correct' : 'wrong';
}

export class PracticeSession extends LitElement {
  static override properties = {
    confirmingQuit: { state: true },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100dvh;
        /* The feedback sheet slides in from below; without clipping, its start
           position extends the page and the browser scrolls to it. */
        overflow: clip;
      }

      exercise-card {
        flex: 1;
      }

      .quit {
        display: grid;
        gap: var(--sp-3);
        margin: var(--sp-4);
        padding: var(--sp-5);
        border-radius: var(--r-xl);
        background: var(--surface);
        box-shadow: var(--shadow-2);
      }

      .quit-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--sp-3);
      }

      .empty {
        display: grid;
        align-content: center;
        justify-items: center;
        gap: var(--sp-4);
        flex: 1;
        padding: var(--sp-8) var(--sp-4);
        text-align: center;
      }

      .empty h2 {
        font: 700 var(--fs-xl) var(--font-ui);
      }
    `,
  ];

  declare confirmingQuit: boolean;

  protected readonly storeController = new StoreController(this);

  #feedbackShownAt = 0;
  #lastFocusedKey = '';

  constructor() {
    super();
    this.confirmingQuit = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    globalThis.addEventListener('keydown', this.#onKeyDown);
  }

  override disconnectedCallback(): void {
    globalThis.removeEventListener('keydown', this.#onKeyDown);
    stopSpeaking();
    super.disconnectedCallback();
  }

  protected override render(): TemplateResult {
    const session = store.state.session;
    const exercise = store.currentExercise;

    if (session === null) {
      return this.#renderEmpty();
    }

    if (store.sessionFinished) {
      return html`<session-summary
        .session=${session}
        .progress=${store.state.progress}
        @home=${this.#exit}
        @more=${this.#practiseMore}
      ></session-summary>`;
    }

    if (exercise === null) {
      return this.#renderEmpty();
    }

    const feedback = store.state.feedback;
    const settings = store.state.settings;
    const answered = Math.min(session.index + (feedback === null ? 0 : 1), session.queue.length);

    return html`
      <session-top-bar
        .answered=${answered}
        .total=${session.queue.length}
        .combo=${store.state.progress.combo}
        ?inert=${this.confirmingQuit}
        @quit=${this.#askQuit}
      ></session-top-bar>
      <h2 class="sr-only" tabindex="-1" id="question-heading">
        Oppgave ${session.index + 1} av ${session.queue.length}
      </h2>
      ${this.confirmingQuit ? this.#renderQuitConfirm() : nothing}
      ${keyed(
        `${session.startedAt}:${session.index}`,
        html`<exercise-card
          ?inert=${this.confirmingQuit}
          .exercise=${exercise}
          .options=${session.options}
          .feedback=${feedback}
          .translationLanguage=${settings.translationLanguage}
          .tagLabel=${deckById(exercise.deckId)?.tagLabel ?? ''}
          @answer=${this.#onAnswer}
        ></exercise-card>`,
      )}
      ${feedback === null
        ? nothing
        : html`<feedback-sheet
            ?inert=${this.confirmingQuit}
            .feedback=${feedback}
            .translationLanguage=${settings.translationLanguage}
            .dailyGoal=${store.state.progress.dailyGoal}
            @continue=${this.#continue}
          ></feedback-sheet>`}
    `;
  }

  /** Moves focus once per question and once per feedback, never on unrelated re-renders. */
  protected override updated(): void {
    const session = store.state.session;

    if (session === null) {
      return;
    }

    if (this.confirmingQuit) {
      if (this.#lastFocusedKey !== 'quit') {
        this.#lastFocusedKey = 'quit';
        this.renderRoot.querySelector<HTMLButtonElement>('.quit .stay')?.focus({ preventScroll: true });
      }

      return;
    }

    const phase = store.sessionFinished ? 'summary' : store.state.feedback === null ? 'question' : 'feedback';
    const key = `${session.startedAt}:${session.index}:${session.queue.length}:${phase}`;

    if (key === this.#lastFocusedKey) {
      return;
    }

    this.#lastFocusedKey = key;

    switch (phase) {
      case 'summary': {
        const summary = this.renderRoot.querySelector<SessionSummary>('session-summary');

        void summary?.updateComplete.then(() => {
          summary.focusHeading();
        });

        return;
      }

      case 'feedback': {
        const sheet = this.renderRoot.querySelector<FeedbackSheet>('feedback-sheet');

        void sheet?.updateComplete.then(() => {
          sheet.focusContinue();
        });

        return;
      }

      case 'question': {
        // A new question always starts at the top, wherever the last feedback left the page.
        globalThis.scrollTo({ top: 0 });
        this.renderRoot.querySelector<HTMLElement>('#question-heading')?.focus({ preventScroll: true });
      }
    }
  }

  #renderQuitConfirm(): TemplateResult {
    return html`
      <div class="quit" role="alertdialog" aria-labelledby="quit-title">
        <p id="quit-title"><strong>Avslutte økta?</strong> Fremgangen er lagret.</p>
        <div class="quit-actions">
          <button class="button secondary stay" @click=${this.#cancelQuit}>Fortsett å øve</button>
          <button class="button primary" @click=${this.#quit}>Avslutt</button>
        </div>
      </div>
    `;
  }

  #renderEmpty(): TemplateResult {
    return html`
      <div class="empty">
        <h2>Ingen økt</h2>
        <p>Start en økt fra forsiden.</p>
        <button class="button primary block" @click=${this.#exit}>Til forsiden</button>
      </div>
    `;
  }

  #onAnswer = (event: Event): void => {
    if (event instanceof CustomEvent && typeof event.detail === 'string') {
      this.#submit(event.detail);
    }
  };

  #submit(value: string): void {
    if (store.state.feedback !== null) {
      return;
    }

    store.answer(value);
    this.#feedbackShownAt = performance.now();

    const feedback = store.state.feedback;

    if (feedback === null) {
      return;
    }

    announce(this, this.#describe(feedback));
    this.#playFeedbackAudio(feedback);
  }

  /** Runs inside the click/key handler on purpose: browsers only allow audio after a user gesture. */
  #playFeedbackAudio(feedback: Feedback): void {
    const settings = store.state.settings;

    if (settings.soundEffects) {
      playSound(soundFor(feedback));
    }

    if (settings.speakSolution) {
      speak(solutionText(feedback.exercise));
    }
  }

  #describe(feedback: Feedback): string {
    const parts: string[] = [];
    const combo = store.state.progress.combo;

    if (feedback.correct) {
      parts.push('Riktig.');

      if (feedback.xpGained > 0) {
        parts.push(`+${feedback.xpGained} XP.`);
      }

      if (combo >= COMBO_VISIBLE_FROM) {
        parts.push(`Kombo ${combo}.`);
      }
    } else {
      parts.push(`Feil. Riktig svar: ${feedback.exercise.answer}. ${solutionText(feedback.exercise)}`);

      if (feedback.exercise.explanation !== undefined) {
        parts.push(feedback.exercise.explanation);
      }
    }

    if (feedback.goalJustReached) {
      parts.push('Dagsmål nådd.');
    }

    for (const id of feedback.newBadges) {
      const badge = badgeById(id);

      if (badge !== undefined) {
        parts.push(`Nytt merke: ${badge.title}.`);
      }
    }

    if (feedback.levelAfter > feedback.levelBefore) {
      parts.push(`Nivå ${feedback.levelAfter}.`);
    }

    return parts.join(' ');
  }

  #continue = (): void => {
    if (performance.now() - this.#feedbackShownAt < CONTINUE_GUARD_MS) {
      return;
    }

    stopSpeaking();
    announce(this, '');
    store.next();
  };

  #askQuit = (): void => {
    if (store.state.session === null || store.sessionFinished) {
      this.#quit();

      return;
    }

    this.confirmingQuit = true;
  };

  #cancelQuit = (): void => {
    this.confirmingQuit = false;
    // Re-runs the focus logic for the current phase once the dialog is gone.
    this.#lastFocusedKey = '';
  };

  #quit = (): void => {
    this.confirmingQuit = false;
    this.#exit();
  };

  #exit = (): void => {
    store.endSession();
    this.dispatchEvent(new CustomEvent('exit', { bubbles: true, composed: true }));
  };

  #practiseMore = (): void => {
    store.startSession(store.state.session?.deckIds, { newPerSession: EXTRA_SESSION_NEW });

    if (store.state.session === null) {
      announce(this, 'Ingen flere oppgaver akkurat nå.');
      this.#exit();
    }
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (store.state.session === null || store.sessionFinished) {
      return;
    }

    if (this.confirmingQuit) {
      if (event.key === 'Escape') {
        this.#cancelQuit();
      }

      return;
    }

    if (event.key === 'Escape') {
      this.#askQuit();

      return;
    }

    if (store.state.feedback !== null) {
      this.#handleFeedbackKey(event);

      return;
    }

    // Typing into the type-in field must not trigger shortcuts.
    const typing = event.composedPath().some((target) => target instanceof HTMLInputElement);

    if (!typing) {
      this.#handleQuestionKey(event);
    }
  };

  #handleFeedbackKey(event: KeyboardEvent): void {
    const advances = event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight';

    if (!advances) {
      return;
    }

    // Enter on a link (the Tatoeba source) or another control must keep its own meaning.
    const onOtherControl = event
      .composedPath()
      .some(
        (target) =>
          target instanceof HTMLAnchorElement ||
          (target instanceof HTMLButtonElement && !target.classList.contains('continue')),
      );

    if (onOtherControl && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    this.#continue();
  }

  #handleQuestionKey(event: KeyboardEvent): void {
    if (event.key === 't' || event.key === 'T') {
      this.renderRoot.querySelector<ExerciseCard>('exercise-card')?.toggleTranslation();

      return;
    }

    const options = store.state.session?.options ?? [];
    const option = options[Number.parseInt(event.key, 10) - 1];

    if (option === undefined) {
      return;
    }

    event.preventDefault();
    this.#submit(option);
  }
}

customElements.define('practice-session', PracticeSession);

declare global {
  interface HTMLElementTagNameMap {
    'practice-session': PracticeSession;
  }
}
