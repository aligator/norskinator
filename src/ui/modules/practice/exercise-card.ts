/**
 * Renders one exercise: the prompt with its gap, an optional translation hint
 * and the answer input for the exercise's kind. Word order is the exception:
 * its Norwegian sentence is the answer, so the translation is the prompt until
 * the learner has answered. Emits `answer` with the learner's choice; grading
 * happens in the store.
 *
 * Adding an exercise kind: add a case to `#renderInput`.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { gapParts, solutionText, type GapParts } from '../../../core/checker.ts';
import type { Feedback } from '../../../core/store.ts';
import type { TranslationLanguage } from '../../../core/storage.ts';
import type { Exercise } from '../../../core/types.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import type { TilePicker } from '../../components/tile-picker.ts';
import { translationStyles } from './practice-styles.ts';
import { pickTranslation, promptTranslation } from './translation.ts';

import '../../components/tile-picker.ts';
import './exercise-credits.ts';

/** Above this length options get a full row each instead of a 2×2 grid. */
const LONG_OPTION = 12;

/** Gap width for typed answers: as wide as the longest common answer («gjennom»). */
const TYPED_GAP = 7;

const NORWEGIAN_LETTERS = ['æ', 'ø', 'å'] as const;

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

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

      .meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-2);
      }

      .prompt {
        max-width: 32ch;
        font: 400 var(--fs-prompt) / var(--lh-prompt) var(--font-prompt);
        text-wrap: pretty;
      }

      .gap {
        display: inline-block;
        min-width: 4ch;
        padding: 0 var(--sp-1);
        border-bottom: 2px solid var(--border-strong);
        text-align: center;
      }

      .gap .hint {
        color: var(--fg-subtle);
        font: 400 var(--fs-sm) / 1 var(--font-ui);
        white-space: nowrap;
      }

      .instruction {
        color: var(--fg-muted);
        font-weight: 600;
      }

      .prompt .lang-tag {
        vertical-align: middle;
        color: var(--fg-muted);
      }

      .sentence.filled {
        padding: 0 var(--sp-1);
        border-radius: var(--r-sm);
        background: var(--correct-bg);
        color: var(--correct);
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
        animation: settle var(--dur-base) var(--ease-out);
      }

      .gap.filled {
        border-radius: var(--r-sm);
        border-bottom-color: transparent;
        background: var(--correct-bg);
        color: var(--correct);
        /* Same weight as the empty gap: bold glyphs are wider and would change its ch-based width. */
        animation: settle var(--dur-base) var(--ease-out);
      }

      .spacer {
        flex: 1;
      }

      fieldset,
      .input-area {
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

      input[type='text']::placeholder {
        color: var(--fg-subtle);
      }

      /* Colour and opacity only: anything that moves would shift the sentence. */
      @keyframes settle {
        from {
          opacity: 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .gap.filled,
        .sentence.filled {
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

  /** Focuses the text field of a type-in exercise; false when there is none. */
  focusAnswerField(): boolean {
    const input = this.renderRoot.querySelector<HTMLInputElement>('input[type="text"]');

    input?.focus({ preventScroll: true });

    return input !== null;
  }

  /** Keyboard shortcuts of a word-order exercise, called by the practice view. */
  pickTile(index: number): void {
    this.#tilePicker()?.pick(index);
  }

  undoTile(): void {
    this.#tilePicker()?.undo();
  }

  submitTiles(): void {
    this.#tilePicker()?.submit();
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
        <div class="meta">
          <p class="eyebrow">${eyebrow}</p>
          ${this.exercise.source === undefined
            ? nothing
            : html`<exercise-credits .source=${this.exercise.source}></exercise-credits>`}
        </div>
        ${this.exercise.kind === 'word-order' ? this.#renderSentencePrompt() : this.#renderClozePrompt()}
      </div>
      <div class="spacer"></div>
      ${this.feedback === null ? this.#renderInput() : nothing}
    `;
  }

  /**
   * The gap is as wide as the longest option from the start, so filling in the
   * answer never re-wraps the sentence.
   */
  #gapWidth(parts: GapParts): string {
    // Without options the gap would otherwise give away the answer's length.
    const floor = this.exercise.kind === 'type-in' ? TYPED_GAP : 3;
    const hint = this.exercise.hint?.length ?? 0;
    const longest = Math.max(parts.filled.length, hint, ...this.options.map((option) => option.length), floor);

    return `min-width: ${longest + 1}ch`;
  }

  #renderClozePrompt(): TemplateResult {
    return html`
      <p class="prompt" lang="nb">${this.#renderGap()}</p>
      ${this.#renderTranslation()}
    `;
  }

  /** Before answering only the translation shows; afterwards the sentence the learner had to build. */
  #renderSentencePrompt(): TemplateResult | typeof nothing {
    if (this.feedback !== null) {
      return html`<p class="prompt" lang="nb"><span class="sentence filled">${solutionText(this.exercise)}</span></p>`;
    }

    const translation = promptTranslation(this.exercise, this.translationLanguage);

    return html`
      <p class="instruction">Sett ordene i riktig rekkefølge</p>
      ${translation === null
        ? nothing
        : html`<p class="prompt" lang=${translation.lang}>
            <span class="lang-tag">${translation.lang.toUpperCase()}</span>${translation.text}
          </p>`}
    `;
  }

  #renderGap(): TemplateResult {
    const parts = gapParts(this.exercise);

    if (parts === null) {
      return html`${this.exercise.prompt}`;
    }

    if (this.feedback === null) {
      const hint = this.exercise.hint;
      const shown = hint === undefined ? html`&nbsp;` : html`<span class="hint" aria-hidden="true">${hint}</span>`;

      return html`${parts.before}<span class="gap" style=${this.#gapWidth(parts)}
          ><span class="sr-only">${this.#gapLabel()}</span>${shown}</span
        >${parts.after}`;
    }

    return html`${parts.before}<span class="gap filled" style=${this.#gapWidth(parts)}>${parts.filled}</span>${parts.after}`;
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

      case 'word-order': {
        return this.#renderWordOrder();
      }
    }
  }

  /** How screen readers announce the empty gap, with the hint the sighted learner sees in it. */
  #gapLabel(): string {
    const hint = this.exercise.hint;

    return hint === undefined ? 'luke' : `luke, grunnform ${hint}`;
  }

  #legend(): TemplateResult {
    const hint = this.exercise.hint;
    // Parentheses mark where the hint ends and the sentence goes on.
    const gap = hint === undefined ? 'luke' : `luke (grunnform ${hint})`;

    return html`<legend class="sr-only">${this.exercise.prompt.replace('___', gap)}</legend>`;
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
            placeholder=${this.exercise.hint ?? nothing}
            .value=${this.typed}
            @input=${this.#onInput}
          />
          <button class="button primary block" type="submit" ?disabled=${this.typed.trim() === ''}>Sjekk</button>
        </form>
      </fieldset>
    `;
  }

  #renderWordOrder(): TemplateResult {
    return html`
      <div class="input-area">
        <ui-tile-picker lang="nb" .tiles=${this.options} @tiles-submit=${this.#onTilesSubmit}></ui-tile-picker>
      </div>
    `;
  }

  #tilePicker(): TilePicker | null {
    return this.renderRoot.querySelector('ui-tile-picker');
  }

  #onTilesSubmit = (event: Event): void => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const words: unknown = event.detail;

    if (isStringList(words)) {
      this.#emit(words.join(' '));
    }
  };

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
