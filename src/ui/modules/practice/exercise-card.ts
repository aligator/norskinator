/**
 * Renders one exercise: the prompt with its gap, an optional translation hint
 * and the answer input for the exercise's kind. Emits `answer` with the
 * learner's choice; grading happens in the store.
 *
 * Adding an exercise kind: add a case to `#renderInput`.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { gapParts } from '../../../core/checker.ts';
import type { Feedback } from '../../../core/store.ts';
import type { TranslationLanguage } from '../../../core/storage.ts';
import type { Exercise } from '../../../core/types.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { translationStyles } from './practice-styles.ts';
import { pickTranslation } from './translation.ts';

/** Above this length options get a full row each instead of a 2×2 grid. */
const LONG_OPTION = 12;

const NORWEGIAN_LETTERS = ['æ', 'ø', 'å'] as const;

export class ExerciseCard extends LitElement {
  static override properties = {
    exercise: { attribute: false },
    options: { attribute: false },
    feedback: { attribute: false },
    translationLanguage: { attribute: false },
    tagLabel: { attribute: false },
    showTranslation: { state: true },
    typed: { state: true },
  };

  static override styles = [
    sharedStyles,
    translationStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
      }

      .prompt-block {
        display: grid;
        align-content: start;
        gap: var(--sp-4);
        padding: var(--sp-6) var(--sp-4) var(--sp-4);
      }

      .prompt {
        max-width: 32ch;
        font: 400 var(--fs-prompt) / var(--lh-prompt) var(--font-prompt);
        text-wrap: pretty;
      }

      .gap {
        display: inline-block;
        min-width: 4ch;
        border-bottom: 2px solid var(--border-strong);
        text-align: center;
      }

      .gap.filled {
        padding: 0 var(--sp-1);
        border-radius: var(--r-sm);
        border-bottom-color: transparent;
        background: var(--correct-bg);
        color: var(--correct);
        font-weight: 600;
        animation: settle var(--dur-base) var(--ease-out);
      }

      .given {
        color: var(--wrong);
        text-decoration-thickness: 2px;
      }

      .spacer {
        flex: 1;
      }

      fieldset {
        margin: 0;
        padding: var(--sp-4) var(--sp-4) calc(var(--sp-4) + env(safe-area-inset-bottom));
        border: 0;
      }

      .options {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--sp-3);
      }

      .options.single {
        grid-template-columns: 1fr;
      }

      .option {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        min-height: var(--option-h);
        padding: 0 var(--sp-4);
        border: 1.5px solid var(--option-border);
        border-radius: var(--r-lg);
        background: var(--surface);
        box-shadow: var(--shadow-1);
        color: var(--fg);
        font: 600 var(--fs-lg) / var(--lh-tight) var(--font-ui);
        text-align: left;
        cursor: pointer;
        transition:
          background-color var(--dur-fast) var(--ease-out),
          border-color var(--dur-fast) var(--ease-out),
          opacity var(--dur-fast) var(--ease-out),
          transform var(--dur-instant) var(--ease-out);
      }

      .option:active {
        transform: scale(0.98);
      }

      .option .label {
        flex: 1;
      }

      @media (hover: hover) {
        .option:hover {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
      }

      .type-in {
        display: grid;
        gap: var(--sp-3);
      }

      .letters {
        display: flex;
        gap: var(--sp-2);
      }

      .letters button {
        width: var(--hit);
        height: var(--hit);
        border: 1.5px solid var(--option-border);
        border-radius: var(--r-md);
        background: var(--surface);
        color: var(--fg);
        font: 600 var(--fs-lg) var(--font-ui);
        cursor: pointer;
      }

      input[type='text'] {
        width: 100%;
        height: 56px;
        padding: 0 var(--sp-4);
        border: 1.5px solid var(--option-border);
        border-radius: var(--r-lg);
        background: var(--surface);
        color: var(--fg);
        font: 400 var(--fs-lg) var(--font-ui);
      }

      @keyframes settle {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .gap.filled {
          animation: none;
        }
      }
    `,
  ];

  declare exercise: Exercise;
  declare options: readonly string[];
  declare feedback: Feedback | null;
  declare translationLanguage: TranslationLanguage;
  declare tagLabel: string;
  declare showTranslation: boolean;
  declare typed: string;

  constructor() {
    super();
    this.options = [];
    this.feedback = null;
    this.translationLanguage = 'de';
    this.tagLabel = '';
    this.showTranslation = false;
    this.typed = '';
  }

  /** Called by the practice view for the `T` shortcut. */
  toggleTranslation(): void {
    this.showTranslation = !this.showTranslation;
  }

  protected override render(): TemplateResult {
    const level = `Vanskelighet ${this.exercise.level}`;
    const eyebrow = this.tagLabel === '' ? level : `${this.tagLabel} · ${level}`;

    return html`
      <div class="prompt-block">
        <p class="eyebrow">${eyebrow}</p>
        <p class="prompt" lang="nb">${this.#renderPrompt()}</p>
        ${this.#renderTranslation()}
      </div>
      <div class="spacer"></div>
      ${this.feedback === null ? this.#renderInput() : nothing}
    `;
  }

  #renderPrompt(): TemplateResult {
    const parts = gapParts(this.exercise);

    if (parts === null) {
      return html`${this.exercise.prompt}`;
    }

    if (this.feedback === null) {
      return html`${parts.before}<span class="gap"><span class="sr-only">luke</span>&nbsp;</span>${parts.after}`;
    }

    const wrongGiven = this.feedback.correct
      ? nothing
      : html`<del class="given"><span class="sr-only">ditt svar: </span>${this.feedback.given}</del> `;
    const correctLabel = this.feedback.correct ? nothing : html`<span class="sr-only">riktig: </span>`;

    return html`${parts.before}${wrongGiven}<span class="gap filled">${correctLabel}${parts.filled}</span>${parts.after}`;
  }

  #renderTranslation(): TemplateResult | typeof nothing {
    // After answering, the feedback sheet shows the translation instead.
    if (this.feedback !== null) {
      return nothing;
    }

    const translation = pickTranslation(this.exercise, this.translationLanguage);

    if (translation === null) {
      return nothing;
    }

    return html`
      <div>
        <button
          class="text-button"
          aria-expanded=${this.showTranslation ? 'true' : 'false'}
          aria-keyshortcuts="T"
          @click=${this.toggleTranslation}
        >
          ${this.showTranslation ? 'Skjul oversettelse' : 'Vis oversettelse'} <kbd aria-hidden="true">T</kbd>
        </button>
        ${this.showTranslation
          ? html`<p class="translation" lang=${translation.lang}>
              <span class="lang-tag">${translation.lang.toUpperCase()}</span>${translation.text}
            </p>`
          : nothing}
      </div>
    `;
  }

  #renderInput(): TemplateResult {
    switch (this.exercise.kind) {
      case 'multiple-choice': {
        return this.#renderChoice();
      }

      case 'type-in': {
        return this.#renderTypeIn();
      }
    }
  }

  #legend(): TemplateResult {
    return html`<legend class="sr-only">${this.exercise.prompt.replace('___', 'luke')}</legend>`;
  }

  #optionsClass(): string {
    return this.options.some((option) => option.length > LONG_OPTION) ? 'options single' : 'options';
  }

  #renderChoice(): TemplateResult {
    return html`
      <fieldset>
        ${this.#legend()}
        <div class=${this.#optionsClass()}>
          ${this.options.map(
            (option, index) => html`
              <button class="option" lang="nb" aria-keyshortcuts=${String(index + 1)} @click=${() => this.#emit(option)}>
                <kbd aria-hidden="true">${index + 1}</kbd>
                <span class="label">${option}</span>
              </button>
            `,
          )}
        </div>
      </fieldset>
    `;
  }

  #renderTypeIn(): TemplateResult {
    return html`
      <fieldset>
        ${this.#legend()}
        <form class="type-in" @submit=${this.#submitTyped}>
          <div class="letters" role="group" aria-label="Norske bokstaver">
            ${NORWEGIAN_LETTERS.map(
              (letter) => html`<button type="button" @click=${() => this.#insertLetter(letter)}>${letter}</button>`,
            )}
          </div>
          <input
            type="text"
            lang="nb"
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
            aria-label="Ditt svar"
            .value=${this.typed}
            @input=${this.#onInput}
          />
          <button class="button primary block" type="submit" ?disabled=${this.typed.trim() === ''}>Sjekk</button>
        </form>
      </fieldset>
    `;
  }

  #onInput = (event: Event): void => {
    if (event.currentTarget instanceof HTMLInputElement) {
      this.typed = event.currentTarget.value;
    }
  };

  #insertLetter(letter: string): void {
    const input = this.renderRoot.querySelector<HTMLInputElement>('input[type="text"]');

    if (input === null) {
      this.typed += letter;

      return;
    }

    const start = input.selectionStart ?? this.typed.length;
    const end = input.selectionEnd ?? start;

    this.typed = `${this.typed.slice(0, start)}${letter}${this.typed.slice(end)}`;

    void this.updateComplete.then(() => {
      input.focus();
      input.setSelectionRange(start + 1, start + 1);
    });
  }

  #submitTyped = (event: SubmitEvent): void => {
    event.preventDefault();

    if (this.typed.trim() !== '') {
      this.#emit(this.typed);
    }
  };

  #emit(value: string): void {
    this.dispatchEvent(new CustomEvent<string>('answer', { detail: value, bubbles: true, composed: true }));
  }
}

customElements.define('exercise-card', ExerciseCard);

declare global {
  interface HTMLElementTagNameMap {
    'exercise-card': ExerciseCard;
  }
}
