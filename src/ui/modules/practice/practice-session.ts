/**
 * Runs a practice session: question → feedback → … → summary, including the
 * keyboard model and screen-reader announcements. Emits `exit` when the
 * learner leaves; the page decides where to go.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';

import { badgeById } from '../../../core/badges.ts';
import { PlantChange, plantChange } from '../../../core/garden.ts';
import { solutionText } from '../../../core/checker.ts';
import { SessionMode } from '../../../core/session.ts';
import type { RatingOption } from '../../../core/srs.ts';
import type { Feedback } from '../../../core/store.ts';
import { ExerciseKind } from '../../../core/types.ts';
import { deckById } from '../../../decks/registry.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { SoundKind, playSound } from '../audio/sound-effects.ts';
import { speak, stopSpeaking } from '../audio/speech.ts';
import { plantNews } from '../garden/plant-news.ts';
import { announce } from '../shared/announce.ts';
import { PRACTICE_PLANT_NEWS } from '../shared/session-start.ts';
import { StoreController, store } from '../shared/store.ts';
import type { ExerciseCard } from './exercise-card.ts';
import type { FeedbackSheet } from './feedback-sheet.ts';
import { overlayKeyboard } from './keyboard-overlay.ts';
import type { RatingSheet } from './rating-sheet.ts';
import { COMBO_VISIBLE_FROM } from './session-top-bar.ts';
import type { SessionSummary } from './session-summary.ts';

import './exercise-card.ts';
import './feedback-sheet.ts';
import './rating-sheet.ts';
import './session-summary.ts';
import './session-top-bar.ts';

/**
 * A quick second tap or key press right after answering must not skip the
 * feedback unread — the Fortsett button rises exactly where the option was.
 */
const CONTINUE_GUARD_MS = 400;

/** One sound per answer; the rarer celebration wins over plain right/wrong. */
function soundFor(feedback: Feedback): SoundKind {
  if (plantChange(feedback.plantBefore, feedback.plantAfter) === PlantChange.Grown) {
    return SoundKind.Grow;
  }

  if (feedback.goalJustReached) {
    return SoundKind.Goal;
  }

  return feedback.correct ? SoundKind.Correct : SoundKind.Wrong;
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
        /* Room for the overlaid keyboard; animated so the answer field slides up with it. */
        padding-bottom: env(keyboard-inset-height, 0px);
        transition: padding-bottom var(--dur-slow) var(--ease-out);
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
  #restoreKeyboard = (): void => {};

  constructor() {
    super();
    this.confirmingQuit = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    globalThis.addEventListener('keydown', this.#onKeyDown);
    this.addEventListener('transitionend', this.#onKeyboardSpaceChanged);
    this.#restoreKeyboard = overlayKeyboard();
  }

  override disconnectedCallback(): void {
    globalThis.removeEventListener('keydown', this.#onKeyDown);
    this.removeEventListener('transitionend', this.#onKeyboardSpaceChanged);
    this.#restoreKeyboard();
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
      ${feedback?.ratingOptions
        ? html`<rating-sheet
            ?inert=${this.confirmingQuit}
            .feedback=${feedback}
            .options=${feedback.ratingOptions}
            @rate=${this.#onRate}
          ></rating-sheet>`
        : feedback === null
          ? nothing
          : html`<feedback-sheet
              ?inert=${this.confirmingQuit}
              .feedback=${feedback}
              .translationLanguage=${settings.translationLanguage}
              .dailyGoal=${store.state.progress.dailyGoal}
              ?practice=${session.mode === SessionMode.Practice}
              ?manualRating=${settings.manualRating}
              @continue=${this.#continue}
            ></feedback-sheet>`}
    `;
  }

  #phase(): 'summary' | 'question' | 'rating' | 'feedback' {
    if (store.sessionFinished) {
      return 'summary';
    }

    const feedback = store.state.feedback;

    if (feedback === null) {
      return 'question';
    }

    return feedback.ratingOptions === null ? 'feedback' : 'rating';
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

    const phase = this.#phase();
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

      case 'rating': {
        const sheet = this.renderRoot.querySelector<RatingSheet>('rating-sheet');

        void sheet?.updateComplete.then(() => {
          sheet.focusDefault();
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

        // Typing needs the field focused (and the keyboard up on phones); choices start at the heading.
        const card = this.renderRoot.querySelector<ExerciseCard>('exercise-card');
        const focusHeading = (): void => {
          this.renderRoot.querySelector<HTMLElement>('#question-heading')?.focus({ preventScroll: true });
        };

        if (card === null) {
          focusHeading();

          return;
        }

        void card.updateComplete.then(() => {
          if (!card.focusAnswerField()) {
            focusHeading();
          }
        });
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
    const alreadyAnswered = store.state.feedback !== null;

    if (alreadyAnswered) {
      return;
    }

    store.answer(value);
    this.#feedbackShownAt = performance.now();

    const feedback = store.state.feedback;

    if (feedback === null) {
      return;
    }

    if (feedback.ratingOptions !== null) {
      announce(this, 'Riktig. Hvor lett var det? Velg vanskelig, bra eller lett.');

      return;
    }

    announce(this, this.#describe(feedback));
    this.#playFeedbackAudio(feedback);
  }

  #onRate = (event: Event): void => {
    const options = store.state.feedback?.ratingOptions;
    const option = options?.find((candidate) => event instanceof CustomEvent && candidate.grade === event.detail);

    if (option !== undefined) {
      this.#rate(option.grade);
    }
  };

  #rate(grade: RatingOption['grade']): void {
    store.rate(grade);
    this.#feedbackShownAt = performance.now();

    const feedback = store.state.feedback;

    if (feedback === null || feedback.ratingOptions !== null) {
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
        parts.push(`+${feedback.xpGained} kroner.`);
      }

      if (combo >= COMBO_VISIBLE_FROM) {
        parts.push(`Kombo ${combo}.`);
      }
    } else {
      const exercise = feedback.exercise;

      // A word-order answer is the whole sentence; saying it twice adds nothing.
      parts.push(
        exercise.kind === ExerciseKind.WordOrder
          ? `Feil. Riktig svar: ${solutionText(exercise)}`
          : `Feil. Riktig svar: ${exercise.answer}. ${solutionText(exercise)}`,
      );

      if (exercise.explanation !== undefined) {
        parts.push(exercise.explanation);
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

    const news =
      store.state.session?.mode === SessionMode.Practice
        ? PRACTICE_PLANT_NEWS
        : plantNews(feedback.plantBefore, feedback.plantAfter);

    parts.push(news.endsWith('!') ? news : `${news}.`);

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
    store.startSession(store.state.session?.deckIds);

    if (store.state.session === null) {
      announce(this, 'Ingen flere oppgaver akkurat nå.');
      this.#exit();
    }
  };

  /** An overlaid keyboard doesn't scroll for us; on short screens the field can end up beneath it. */
  #onKeyboardSpaceChanged = (event: TransitionEvent): void => {
    if (event.target !== this || event.propertyName !== 'padding-bottom') {
      return;
    }

    this.renderRoot.querySelector<ExerciseCard>('exercise-card')?.revealAnswerField();
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

    const feedback = store.state.feedback;

    if (feedback?.ratingOptions) {
      this.#handleRatingKey(event, feedback.ratingOptions);

      return;
    }

    if (feedback !== null) {
      this.#handleFeedbackKey(event);

      return;
    }

    // Typing into the type-in field must not trigger shortcuts.
    const typing = event.composedPath().some((target) => target instanceof HTMLInputElement);

    if (!typing) {
      this.#handleQuestionKey(event);
    }
  };

  /** Digits pick the n-th button; Enter and Space stay with the focused button. */
  #handleRatingKey(event: KeyboardEvent, options: readonly RatingOption[]): void {
    const option = options[Number.parseInt(event.key, 10) - 1];

    if (option === undefined) {
      return;
    }

    event.preventDefault();
    this.#rate(option.grade);
  }

  #handleFeedbackKey(event: KeyboardEvent): void {
    const advances = event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight';

    if (!advances) {
      return;
    }

    // Enter on a link (a Tatoeba source) or another control must keep its own meaning.
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
    const card = this.renderRoot.querySelector<ExerciseCard>('exercise-card');
    const exercise = store.currentExercise;

    if (card === null || exercise === null) {
      return;
    }

    switch (exercise.kind) {
      case ExerciseKind.MultipleChoice: {
        this.#handleChoiceKey(event, card);

        return;
      }

      case ExerciseKind.TypeIn: {
        this.#handleTranslationKey(event, card);

        return;
      }

      case ExerciseKind.WordOrder: {
        this.#handleWordOrderKey(event, card);
      }
    }
  }

  /** True when the key toggled the translation. */
  #handleTranslationKey(event: KeyboardEvent, card: ExerciseCard): boolean {
    if (event.key !== 't' && event.key !== 'T') {
      return false;
    }

    card.toggleTranslation();

    return true;
  }

  #handleChoiceKey(event: KeyboardEvent, card: ExerciseCard): void {
    if (this.#handleTranslationKey(event, card)) {
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

  /** Digits pick the n-th pool tile, Backspace takes the last one back, Enter checks. */
  #handleWordOrderKey(event: KeyboardEvent, card: ExerciseCard): void {
    const digit = Number.parseInt(event.key, 10);

    if (digit >= 1 && digit <= 9) {
      event.preventDefault();
      card.pickTile(digit - 1);

      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      card.undoTile();

      return;
    }

    // Enter on a focused tile or link already does what that control means.
    const onControl = event
      .composedPath()
      .some((target) => target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement);

    if (event.key === 'Enter' && !onControl) {
      event.preventDefault();
      card.submitTiles();
    }
  }
}

customElements.define('practice-session', PracticeSession);

declare global {
  interface HTMLElementTagNameMap {
    'practice-session': PracticeSession;
  }
}
