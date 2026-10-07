/**
 * Small © button on an exercise that opens who wrote its sentence and
 * translations, and under which licence. CC BY asks for the author of every
 * corpus sentence; tucking it behind a button keeps the exercise uncluttered.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import {
  LANGUAGE_CODES,
  type ExerciseSource,
  type LanguageCode,
  type SourceCredit,
  type TranslationCredit,
} from '../../../core/types.ts';
import { creditIcon } from '../../components/icons.ts';
import { sharedStyles } from '../../components/styles/shared.ts';

const LANGUAGE_NAMES: Readonly<Record<LanguageCode, string>> = { de: 'Tysk', en: 'Engelsk' };

export class ExerciseCredits extends LitElement {
  static override properties = {
    source: { attribute: false },
    open: { state: true },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        position: relative;
        display: inline-block;
      }

      /* Full hit area, but the negative margin keeps it from growing the row it sits in. */
      .toggle {
        margin: calc(var(--sp-3) * -1) calc(var(--sp-3) * -1) calc(var(--sp-3) * -1) 0;
        color: var(--fg-subtle);
      }

      .toggle[aria-expanded='true'] {
        color: var(--accent);
      }

      .panel {
        position: absolute;
        top: calc(100% + var(--sp-2));
        right: 0;
        z-index: 2;
        width: min(22rem, calc(100vw - 2 * var(--sp-4)));
        padding: var(--sp-3) var(--sp-4);
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        background: var(--surface);
        box-shadow: var(--shadow-2);
        color: var(--fg-muted);
        font-size: var(--fs-xs);
        line-height: 1.5;
      }

      dl {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--sp-1) var(--sp-3);
        margin: 0;
      }

      dt {
        font-weight: 600;
        color: var(--fg);
      }

      dd {
        margin: 0;
        overflow-wrap: anywhere;
      }

      a {
        color: inherit;
      }

      .note {
        margin-top: var(--sp-2);
      }
    `,
  ];

  declare source: ExerciseSource;
  declare open: boolean;

  constructor() {
    super();
    this.open = false;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this.#onOutsidePointer);
  }

  protected override updated(): void {
    // Listening only while open keeps idle exercises free of document handlers.
    if (this.open) {
      document.addEventListener('pointerdown', this.#onOutsidePointer);
    } else {
      document.removeEventListener('pointerdown', this.#onOutsidePointer);
    }
  }

  protected override render(): TemplateResult {
    return html`
      <button
        class="icon-button toggle"
        aria-label="Kilde og lisens"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-controls="credits"
        @click=${this.#toggle}
        @keydown=${this.#onKeyDown}
      >
        ${creditIcon()}
      </button>
      ${this.open ? this.#renderPanel() : nothing}
    `;
  }

  #renderPanel(): TemplateResult {
    const translations = this.source.translations ?? {};

    return html`
      <div id="credits" class="panel" role="group" aria-label="Kilde og lisens" @keydown=${this.#onKeyDown}>
        <dl>
          <dt>Norsk</dt>
          <dd>${this.#renderCredit(this.source)}</dd>
          ${LANGUAGE_CODES.map((lang) => {
            const credit = translations[lang];

            return credit === undefined
              ? nothing
              : html`<dt>${LANGUAGE_NAMES[lang]}</dt>
                  <dd>${this.#renderTranslationCredit(credit)}</dd>`;
          })}
        </dl>
        ${this.source.url === undefined
          ? nothing
          : html`<p class="note">Setningen vises med en luke i stedet for det ordet du skal finne.</p>`}
      </div>
    `;
  }

  #renderTranslationCredit(credit: TranslationCredit): TemplateResult {
    if ('machine' in credit) {
      return html`KI-oversettelse av den norske setningen`;
    }

    return this.#renderCredit(credit);
  }

  /** Corpus sentences are named by id and linked; the project's own ones by name only. */
  #renderCredit(credit: SourceCredit): TemplateResult {
    const link =
      credit.url === undefined
        ? this.source.name
        : html`<a href=${credit.url} target="_blank" rel="noopener">${this.source.name} #${credit.id}</a>`;
    const author = credit.author === undefined ? nothing : html` av <span translate="no">${credit.author}</span>`;
    const license = credit.license === undefined ? nothing : html` · ${credit.license}`;

    return html`${link}${author}${license}`;
  }

  #toggle = (): void => {
    this.open = !this.open;
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.open) {
      return;
    }

    // Escape would otherwise also reach the session and ask to quit.
    event.stopPropagation();
    this.open = false;
    this.renderRoot.querySelector<HTMLButtonElement>('.toggle')?.focus();
  };

  #onOutsidePointer = (event: PointerEvent): void => {
    if (!event.composedPath().includes(this)) {
      this.open = false;
    }
  };
}

customElements.define('exercise-credits', ExerciseCredits);

declare global {
  interface HTMLElementTagNameMap {
    'exercise-credits': ExerciseCredits;
  }
}
