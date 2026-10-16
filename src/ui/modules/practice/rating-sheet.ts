/**
 * A right answer waiting for the learner's own rating (hard, good, easy),
 * each with the time until the item comes back. Takes the place of the
 * feedback sheet until a button is pressed.
 */
import { LitElement, css, html, type TemplateResult } from 'lit';

import { gapParts, solutionText } from '../../../core/checker.ts';
import type { RatingOption } from '../../../core/srs.ts';
import type { Feedback } from '../../../core/store.ts';
import { checkIcon } from '../../components/icons.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { formatComesBack } from '../shared/format.ts';

const LABELS: Readonly<Record<RatingOption['grade'], string>> = {
  hard: 'Vanskelig',
  good: 'Bra',
  easy: 'Lett',
};

export class RatingSheet extends LitElement {
  static override properties = {
    feedback: { attribute: false },
    options: { attribute: false },
  };

  static override styles = [
    sharedStyles,
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
        background: var(--correct-bg);
        box-shadow: var(--shadow-sheet);
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
        color: var(--correct);
        font-size: var(--fs-xl);
        font-weight: 700;
        line-height: var(--lh-tight);
      }

      .solution {
        font: 400 var(--fs-lg) / var(--lh-prompt) var(--font-prompt);
      }

      .solution strong {
        font-weight: 600;
        text-decoration: underline 2px var(--correct);
        text-underline-offset: 0.2em;
      }

      .question {
        font-weight: 600;
      }

      .ratings {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
        gap: var(--sp-3);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .rating {
        display: grid;
        width: 100%;
        gap: 2px;
        justify-items: center;
        min-height: var(--hit);
        padding: var(--sp-3);
        border: 2px solid var(--accent);
        border-radius: var(--r-lg);
        background: var(--surface);
        color: var(--fg);
        font: inherit;
        cursor: pointer;
      }

      .rating.good {
        background: var(--accent);
        color: var(--accent-fg);
      }

      .rating:focus-visible {
        outline-offset: 3px;
      }

      .rating .label {
        font-weight: 700;
      }

      .rating .delay {
        font-size: var(--fs-sm);
      }
    `,
  ];

  declare feedback: Feedback;
  declare options: readonly RatingOption[];

  constructor() {
    super();
    this.options = [];
  }

  focusDefault(): void {
    this.renderRoot.querySelector<HTMLButtonElement>('.rating.good')?.focus({ preventScroll: true });
  }

  protected override render(): TemplateResult {
    const now = Date.now();
    const parts = gapParts(this.feedback.exercise);

    return html`
      <section class="sheet" aria-labelledby="verdict">
        <h2 id="verdict" class="headline">${checkIcon(24)}<span>Riktig!</span></h2>

        <p class="solution" lang="nb">
          ${parts === null
            ? solutionText(this.feedback.exercise)
            : html`${parts.before}<strong>${parts.filled}</strong>${parts.after}`}
        </p>

        <p id="rating-question" class="question">Hvor lett var det?</p>
        <ul class="ratings" aria-labelledby="rating-question">
          ${this.options.map(
            (option, position) => html`<li>
              <button
                class=${`rating ${option.grade}`}
                aria-keyshortcuts=${String(position + 1)}
                @click=${() => {
                  this.#rate(option.grade);
                }}
              >
                <span class="label">${LABELS[option.grade]}</span>
                <span class="delay">${formatComesBack(now + option.delayMs, now)}</span>
                <kbd aria-hidden="true">${position + 1}</kbd>
              </button>
            </li>`,
          )}
        </ul>
      </section>
    `;
  }

  #rate(grade: RatingOption['grade']): void {
    this.dispatchEvent(new CustomEvent('rate', { detail: grade, bubbles: true, composed: true }));
  }
}

customElements.define('rating-sheet', RatingSheet);

declare global {
  interface HTMLElementTagNameMap {
    'rating-sheet': RatingSheet;
  }
}
